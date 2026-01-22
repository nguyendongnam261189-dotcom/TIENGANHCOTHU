import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc,
  updateDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { Exam, Room, Submission, StudentInfo, User, Role, Question } from '../types';

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
  apiKey: "AIzaSyDf7Dhnd3AWaODDoB-m_ujMr41NlmwVsbA",
  authDomain: "stuchat-project.firebaseapp.com",
  projectId: "stuchat-project",
  storageBucket: "stuchat-project.firebasestorage.app",
  messagingSenderId: "473666271454",
  appId: "1:473666271454:web:7e74020e1e643bfaaeaa4f",
  measurementId: "G-VH1FCP9HZ1"
};

// Initialize Firebase
console.log("🔄 Initializing Firebase...");
const app = initializeApp(firebaseConfig);
console.log("✅ Firebase App created");

export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
console.log("✅ Auth & Firestore initialized");

// ============ HELPER FUNCTIONS ============

const toDate = (timestamp: Timestamp | Date | undefined | null): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return undefined;
};

// ============ AUTH FUNCTIONS ============

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    
    // Check/create user in Firestore
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // Kiểm tra xem có user nào trong hệ thống chưa
      const hasUsers = await hasAnyUsers();
      
      // User đầu tiên sẽ tự động thành ADMIN và được approve
      const isFirstUser = !hasUsers;
      
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Unknown',
        email: firebaseUser.email || undefined,
        avatar: firebaseUser.photoURL || undefined,
        role: isFirstUser ? Role.ADMIN : Role.TEACHER, // User đầu tiên là ADMIN
        isApproved: isFirstUser, // User đầu tiên được auto approve
        createdAt: new Date()
      };
      
      await setDoc(userRef, {
        ...newUser,
        createdAt: serverTimestamp()
      });
      
      console.log(isFirstUser 
        ? '👑 User đầu tiên - tự động thành Admin!' 
        : '⏳ User mới - chờ duyệt');
      
      return newUser;
    }
    
    const userData = userSnap.data();
    return {
      id: userSnap.id,
      name: userData.name || '',
      email: userData.email,
      avatar: userData.avatar,
      role: userData.role || Role.TEACHER,
      isApproved: userData.isApproved ?? false,
      createdAt: toDate(userData.createdAt)
    };
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

export const signOutUser = () => signOut(auth);

// Đảm bảo có đăng nhập (Anonymous) cho học sinh trước khi ghi Firestore
let anonymousSignInPromise: Promise<void> | null = null;

export const ensureSignedIn = async (): Promise<void> => {
  if (auth.currentUser) return;

  // Tránh gọi signInAnonymously nhiều lần đồng thời
  if (!anonymousSignInPromise) {
    anonymousSignInPromise = signInAnonymously(auth)
      .then(() => {})
      .finally(() => {
        anonymousSignInPromise = null;
      });
  }

  await anonymousSignInPromise;
};

// Kiểm tra có user nào trong hệ thống chưa
export const hasAnyUsers = async (): Promise<boolean> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return !snapshot.empty;
};

// Kiểm tra user có phải admin không (dựa vào role trong database)
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const role = userSnap.data().role;
    return role === Role.ADMIN || role === Role.LEADER;
  }
  return false;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data();
    return {
      id: userSnap.id,
      name: userData.name || '',
      email: userData.email,
      avatar: userData.avatar,
      role: userData.role || Role.TEACHER,
      isApproved: userData.isApproved ?? false,
      createdAt: toDate(userData.createdAt)
    };
  }
  return null;
};

// ============ USER MANAGEMENT (Admin) ============

export const getAllUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      email: data.email,
      avatar: data.avatar,
      role: data.role || Role.TEACHER,
      isApproved: data.isApproved ?? false,
      createdAt: toDate(data.createdAt)
    };
  });
};

export const getPendingUsers = async (): Promise<User[]> => {
  const q = query(
    collection(db, 'users'),
    where('isApproved', '==', false)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      email: data.email,
      avatar: data.avatar,
      role: data.role || Role.TEACHER,
      isApproved: false,
      createdAt: toDate(data.createdAt)
    };
  });
};

export const approveUser = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { isApproved: true });
};

export const rejectUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', userId));
};

export const updateUserRole = async (userId: string, role: Role): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role });
};

// ============ EXAM FUNCTIONS ============

export const createExam = async (examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  console.log('📝 createExam called with:', {
    title: examData.title,
    createdBy: examData.createdBy,
    questionsCount: examData.questions?.length
  });
  
  const examRef = await addDoc(collection(db, 'exams'), {
    ...examData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  console.log('📝 Exam created with ID:', examRef.id);
  return examRef.id;
};

export const getExam = async (examId: string): Promise<Exam | null> => {
  const examRef = doc(db, 'exams', examId);
  const examSnap = await getDoc(examRef);
  
  if (examSnap.exists()) {
    const data = examSnap.data();
    return { 
      id: examSnap.id, 
      title: data.title || '',
      description: data.description,
      timeLimit: data.timeLimit || 45,
      questions: data.questions || [],
      sections: data.sections || [],
      answers: data.answers || {},
      createdBy: data.createdBy || '',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  }
  return null;
};

export const getExamsByTeacher = async (teacherId: string): Promise<Exam[]> => {
  console.log('📚 getExamsByTeacher called with teacherId:', teacherId);
  
  // Query đơn giản không cần index
  const q = query(
    collection(db, 'exams'),
    where('createdBy', '==', teacherId)
  );
  
  const snapshot = await getDocs(q);
  console.log('📚 Found exams:', snapshot.size);
  
  const exams = snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    console.log('📚 Exam data:', docSnap.id, data.title);
    return { 
      id: docSnap.id, 
      title: data.title || '',
      description: data.description,
      timeLimit: data.timeLimit || 45,
      questions: data.questions || [],
      sections: data.sections || [],
      answers: data.answers || {},
      createdBy: data.createdBy || '',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  });
  
  // Sort trong JavaScript thay vì Firestore
  exams.sort((a, b) => {
    const dateA = a.createdAt?.getTime() || 0;
    const dateB = b.createdAt?.getTime() || 0;
    return dateB - dateA;
  });
  
  return exams;
};

export const deleteExam = async (examId: string): Promise<void> => {
  await deleteDoc(doc(db, 'exams', examId));
};

// ============ ROOM FUNCTIONS ============

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const isRoomCodeUnique = async (code: string): Promise<boolean> => {
  const q = query(collection(db, 'rooms'), where('code', '==', code));
  const snapshot = await getDocs(q);
  return snapshot.empty;
};

export const createRoom = async (roomData: {
  examId: string;
  examTitle: string;
  teacherId: string;
  teacherName: string;
  timeLimit: number;
  settings?: {
    allowLateJoin?: boolean;
    showResultAfterSubmit?: boolean;
    shuffleQuestions?: boolean;
    maxAttempts?: number;
  }
}): Promise<Room> => {
  let code = generateRoomCode();
  let attempts = 0;
  while (!(await isRoomCodeUnique(code)) && attempts < 10) {
    code = generateRoomCode();
    attempts++;
  }
  
  const room: Omit<Room, 'id'> = {
    code,
    examId: roomData.examId,
    examTitle: roomData.examTitle,
    teacherId: roomData.teacherId,
    teacherName: roomData.teacherName,
    status: 'waiting',
    timeLimit: roomData.timeLimit,
    allowLateJoin: roomData.settings?.allowLateJoin ?? true,
    showResultAfterSubmit: roomData.settings?.showResultAfterSubmit ?? true,
    shuffleQuestions: roomData.settings?.shuffleQuestions ?? false,
    maxAttempts: roomData.settings?.maxAttempts ?? 1,
    totalStudents: 0,
    submittedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const roomRef = await addDoc(collection(db, 'rooms'), {
    ...room,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return { id: roomRef.id, ...room };
};

const parseRoomData = (id: string, data: DocumentData): Room => {
  return {
    id,
    code: data.code || '',
    examId: data.examId || '',
    examTitle: data.examTitle || '',
    teacherId: data.teacherId || '',
    teacherName: data.teacherName || '',
    status: data.status || 'waiting',
    startTime: toDate(data.startTime),
    endTime: toDate(data.endTime),
    timeLimit: data.timeLimit || 45,
    allowLateJoin: data.allowLateJoin ?? true,
    showResultAfterSubmit: data.showResultAfterSubmit ?? true,
    shuffleQuestions: data.shuffleQuestions ?? false,
    maxAttempts: data.maxAttempts ?? 1,
    totalStudents: data.totalStudents || 0,
    submittedCount: data.submittedCount || 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
};

export const getRoomByCode = async (code: string): Promise<Room | null> => {
  const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const docSnap = snapshot.docs[0];
  return parseRoomData(docSnap.id, docSnap.data());
};

export const getRoom = async (roomId: string): Promise<Room | null> => {
  const roomRef = doc(db, 'rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (roomSnap.exists()) {
    return parseRoomData(roomSnap.id, roomSnap.data());
  }
  return null;
};

export const getRoomsByTeacher = async (teacherId: string): Promise<Room[]> => {
  console.log('🏠 getRoomsByTeacher called with teacherId:', teacherId);
  
  const q = query(
    collection(db, 'rooms'),
    where('teacherId', '==', teacherId)
  );
  
  const snapshot = await getDocs(q);
  console.log('🏠 Found rooms:', snapshot.size);
  
  const rooms = snapshot.docs.map(docSnap => parseRoomData(docSnap.id, docSnap.data()));
  
  // Sort trong JavaScript
  rooms.sort((a, b) => {
    const dateA = a.createdAt?.getTime() || 0;
    const dateB = b.createdAt?.getTime() || 0;
    return dateB - dateA;
  });
  
  return rooms;
};

export const updateRoomStatus = async (roomId: string, status: Room['status']): Promise<void> => {
  const roomRef = doc(db, 'rooms', roomId);
  const updateData: Record<string, unknown> = { 
    status,
    updatedAt: serverTimestamp()
  };
  
  if (status === 'active') {
    updateData.startTime = serverTimestamp();
  } else if (status === 'closed') {
    updateData.endTime = serverTimestamp();
  }
  
  await updateDoc(roomRef, updateData);
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  const q = query(collection(db, 'submissions'), where('roomId', '==', roomId));
  const snapshot = await getDocs(q);
  
  const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
  await Promise.all(deletePromises);
  
  await deleteDoc(doc(db, 'rooms', roomId));
};

export const subscribeToRoom = (roomId: string, callback: (room: Room | null) => void) => {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(parseRoomData(docSnap.id, docSnap.data()));
    } else {
      callback(null);
    }
  });
};

// ============ SUBMISSION FUNCTIONS ============

const parseSubmissionData = (id: string, data: DocumentData): Submission => {
  return {
    id,
    roomId: data.roomId || '',
    roomCode: data.roomCode || '',
    examId: data.examId || '',
    student: data.student || { id: '', name: '' },
    answers: data.answers || {},
    score: data.score || 0,
    correctCount: data.correctCount || 0,
    wrongCount: data.wrongCount || 0,
    totalQuestions: data.totalQuestions || 0,
    percentage: data.percentage || 0,
    startedAt: toDate(data.startedAt),
    submittedAt: toDate(data.submittedAt),
    duration: data.duration || 0,
    status: data.status || 'in_progress'
  };
};

export const createSubmission = async (submission: Omit<Submission, 'id'>): Promise<string> => {
  const submissionRef = await addDoc(collection(db, 'submissions'), {
    ...submission,
    startedAt: serverTimestamp()
  });
  
  const roomRef = doc(db, 'rooms', submission.roomId);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) {
    const room = roomSnap.data();
    await updateDoc(roomRef, {
      totalStudents: (room.totalStudents || 0) + 1,
      updatedAt: serverTimestamp()
    });
  }
  
  return submissionRef.id;
};

export const updateSubmission = async (
  submissionId: string, 
  data: Partial<Submission>
): Promise<void> => {
  const submissionRef = doc(db, 'submissions', submissionId);
  await updateDoc(submissionRef, data as Record<string, unknown>);
};

export const submitExam = async (
  submissionId: string,
  answers: { [key: number]: string },
  exam: Exam
): Promise<Submission> => {
  const submissionRef = doc(db, 'submissions', submissionId);
  const submissionSnap = await getDoc(submissionRef);
  
  if (!submissionSnap.exists()) {
    throw new Error('Submission not found');
  }
  
  const submissionData = submissionSnap.data();
  
  // Calculate score
  let correctCount = 0;
  const totalQuestions = exam.questions.length;
  
  exam.questions.forEach((q: Question) => {
    const userAnswer = answers[q.number];
    const correctAnswer = q.correctAnswer;
    
    if (!userAnswer || !correctAnswer) return;
    
    if (q.type === 'writing') {
      const normalize = (text: string) => text
        .toLowerCase()
        .replace(/['']/g, "'")
        .replace(/\s+/g, ' ')
        .replace(/[.,!?;:]/g, '')
        .trim();
      
      if (normalize(userAnswer) === normalize(correctAnswer)) {
        correctCount++;
      }
    } else {
      if (userAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
        correctCount++;
      }
    }
  });
  
  const wrongCount = totalQuestions - correctCount;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  
  let startedAt: Date;
  if (submissionData.startedAt instanceof Timestamp) {
    startedAt = submissionData.startedAt.toDate();
  } else if (submissionData.startedAt) {
    startedAt = new Date(submissionData.startedAt);
  } else {
    startedAt = new Date();
  }
  
  const submittedAt = new Date();
  const duration = Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);
  
  const updatedData = {
    answers,
    score: correctCount,
    correctCount,
    wrongCount,
    totalQuestions,
    percentage,
    submittedAt: serverTimestamp(),
    duration,
    status: 'submitted' as const
  };
  
  await updateDoc(submissionRef, updatedData);
  
  // Update room submitted count
  const roomRef = doc(db, 'rooms', submissionData.roomId);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) {
    const room = roomSnap.data();
    await updateDoc(roomRef, {
      submittedCount: (room.submittedCount || 0) + 1,
      updatedAt: serverTimestamp()
    });
  }
  
  return {
    id: submissionId,
    roomId: submissionData.roomId,
    roomCode: submissionData.roomCode,
    examId: submissionData.examId,
    student: submissionData.student,
    answers,
    score: correctCount,
    correctCount,
    wrongCount,
    totalQuestions,
    percentage,
    startedAt,
    submittedAt,
    duration,
    status: 'submitted'
  };
};

export const getSubmission = async (submissionId: string): Promise<Submission | null> => {
  const submissionRef = doc(db, 'submissions', submissionId);
  const submissionSnap = await getDoc(submissionRef);
  
  if (submissionSnap.exists()) {
    return parseSubmissionData(submissionSnap.id, submissionSnap.data());
  }
  return null;
};

export const getSubmissionsByRoom = async (roomId: string): Promise<Submission[]> => {
  const q = query(
    collection(db, 'submissions'),
    where('roomId', '==', roomId)
  );
  
  const snapshot = await getDocs(q);
  const submissions = snapshot.docs.map(docSnap => 
    parseSubmissionData(docSnap.id, docSnap.data())
  );
  
  return submissions.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
};

export const getStudentSubmission = async (
  roomId: string, 
  studentId: string
): Promise<Submission | null> => {
  const q = query(
    collection(db, 'submissions'),
    where('roomId', '==', roomId),
    where('student.id', '==', studentId)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const docSnap = snapshot.docs[0];
  return parseSubmissionData(docSnap.id, docSnap.data());
};

export const subscribeToSubmissions = (
  roomId: string, 
  callback: (submissions: Submission[]) => void
) => {
  const q = query(
    collection(db, 'submissions'),
    where('roomId', '==', roomId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const submissions = snapshot.docs.map(docSnap => 
      parseSubmissionData(docSnap.id, docSnap.data())
    );
    
    submissions.sort((a, b) => {
      if ((b.percentage || 0) !== (a.percentage || 0)) {
        return (b.percentage || 0) - (a.percentage || 0);
      }
      return (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0);
    });
    
    callback(submissions);
  });
};

// ============ EXPORTS ============

export {
  onAuthStateChanged,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
};
