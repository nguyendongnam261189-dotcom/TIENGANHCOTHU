import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  User as FirebaseUser
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
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  // ✅ thêm lại để tương thích code cũ (TeacherDashboard thường dùng)
  orderBy,
  limit
} from 'firebase/firestore';
import { Exam, Room, Submission, User, Role, Question, AccessMode } from '../types';

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
  apiKey: 'AIzaSyCaOg2WjE07yqzW75lvQ74pKVODtKCjK6U',
  authDomain: 'dethitienganh-3a359.firebaseapp.com',
  projectId: 'dethitienganh-3a359',
  storageBucket: 'dethitienganh-3a359.firebasestorage.app',
  messagingSenderId: '384518159133',
  appId: '1:384518159133:web:c00cbb29f3528af5373ff4',
  measurementId: 'G-VD2ZMH4NMM'
};

// Initialize Firebase
console.log('🔄 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
console.log('✅ Firebase App created');

export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
console.log('✅ Auth & Firestore initialized');

// ============ HELPER FUNCTIONS ============

const toDate = (timestamp: Timestamp | Date | undefined | null): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return undefined;
};

const buildUserFromFirebase = (firebaseUser: FirebaseUser, fallbackRole: Role): User => ({
  id: firebaseUser.uid,
  name: firebaseUser.displayName || 'Unknown',
  email: firebaseUser.email || undefined,
  avatar: firebaseUser.photoURL || undefined,
  role: fallbackRole,
  createdAt: new Date()
});

const ensureUserDoc = async (user: User, options?: { force?: boolean }): Promise<User> => {
  const userRef = doc(db, 'users', user.id);
  const snap = await getDoc(userRef);

  if (!snap.exists() || options?.force) {
    await setDoc(
      userRef,
      {
        ...user,
        createdAt: snap.exists() ? snap.data().createdAt ?? serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return user;
  }

  const data = snap.data();
  return {
    id: snap.id,
    name: data.name || user.name || '',
    email: data.email ?? user.email,
    avatar: data.avatar ?? user.avatar,
    role: data.role || user.role,
    status: data.status,
    isApproved: data.isApproved ?? user.isApproved,
    classIds: data.classIds,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
};

// ============ AUTH FUNCTIONS ============

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const hasUsers = await hasAnyUsers();
      const isFirstUser = !hasUsers;

      const newUser: User = {
        ...buildUserFromFirebase(firebaseUser, isFirstUser ? Role.ADMIN : Role.TEACHER),
        role: isFirstUser ? Role.ADMIN : Role.TEACHER,
        isApproved: isFirstUser,
        createdAt: new Date()
      };

      await setDoc(userRef, { ...newUser, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

      console.log(isFirstUser ? '👑 User đầu tiên - tự động thành Admin!' : '⏳ User mới - chờ duyệt');
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
      classIds: userData.classIds,
      createdAt: toDate(userData.createdAt),
      updatedAt: toDate(userData.updatedAt)
    };
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

export const signInStudentWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const newStudent: User = {
        ...buildUserFromFirebase(firebaseUser, Role.STUDENT),
        role: Role.STUDENT,
        isApproved: false,
        createdAt: new Date()
      };

      await setDoc(userRef, { ...newStudent, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      console.log('🧑‍🎓 Student mới - chờ duyệt');
      return newStudent;
    }

    const data = snap.data();
    return {
      id: snap.id,
      name: data.name || firebaseUser.displayName || '',
      email: data.email ?? firebaseUser.email ?? undefined,
      avatar: data.avatar ?? firebaseUser.photoURL ?? undefined,
      role: data.role || Role.STUDENT,
      isApproved: data.isApproved ?? false,
      classIds: data.classIds,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  } catch (error) {
    console.error('Student Google sign in error:', error);
    throw error;
  }
};

export const signOutUser = () => signOut(auth);

// ===== Anonymous/Guest sign-in =====
let anonymousSignInPromise: Promise<void> | null = null;

export const ensureGuestSignedIn = async (): Promise<void> => {
  if (auth.currentUser) return;

  if (!anonymousSignInPromise) {
    anonymousSignInPromise = signInAnonymously(auth)
      .then(async (cred) => {
        const u = cred.user;
        const guestUser: User = {
          id: u.uid,
          name: 'Khách',
          role: Role.GUEST,
          isApproved: true,
          createdAt: new Date()
        };
        await ensureUserDoc(guestUser);
      })
      .then(() => {})
      .finally(() => {
        anonymousSignInPromise = null;
      });
  }

  await anonymousSignInPromise;
};

// Backward compatible
export const ensureSignedIn = ensureGuestSignedIn;

export const hasAnyUsers = async (): Promise<boolean> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return !snapshot.empty;
};

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
      classIds: userData.classIds,
      createdAt: toDate(userData.createdAt),
      updatedAt: toDate(userData.updatedAt)
    };
  }
  return null;
};

// ============ USER MANAGEMENT ============

export const getAllUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      email: data.email,
      avatar: data.avatar,
      role: data.role || Role.TEACHER,
      isApproved: data.isApproved ?? false,
      classIds: data.classIds,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  });
};

export const getPendingUsers = async (): Promise<User[]> => {
  const q = query(collection(db, 'users'), where('isApproved', '==', false));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      email: data.email,
      avatar: data.avatar,
      role: data.role || Role.TEACHER,
      isApproved: false,
      classIds: data.classIds,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  });
};

export const approveUser = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { isApproved: true, updatedAt: serverTimestamp() });
};

export const rejectUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', userId));
};

export const updateUserRole = async (userId: string, role: Role): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role, updatedAt: serverTimestamp() });
};

// ============ EXAM FUNCTIONS ============

export const createExam = async (examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const examRef = await addDoc(collection(db, 'exams'), {
    ...examData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
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
      images: data.images || [],
      createdBy: data.createdBy || '',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  }
  return null;
};

export const getExamsByTeacher = async (teacherId: string): Promise<Exam[]> => {
  const q = query(collection(db, 'exams'), where('createdBy', '==', teacherId));
  const snapshot = await getDocs(q);

  const exams = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      title: data.title || '',
      description: data.description,
      timeLimit: data.timeLimit || 45,
      questions: data.questions || [],
      sections: data.sections || [],
      answers: data.answers || {},
      images: data.images || [],
      createdBy: data.createdBy || '',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt)
    };
  });

  exams.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  return exams;
};

export const deleteExam = async (examId: string): Promise<void> => {
  await deleteDoc(doc(db, 'exams', examId));
};

// ============ ROOM FUNCTIONS ============

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
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
  accessMode?: AccessMode;
  classId?: string;
  className?: string;
  settings?: {
    allowLateJoin?: boolean;
    showResultAfterSubmit?: boolean;
    shuffleQuestions?: boolean;
    maxAttempts?: number;
  };
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
    accessMode: roomData.accessMode ?? 'public',
    classId: roomData.classId,
    className: roomData.className,
    status: 'waiting',
    timeLimit: roomData.timeLimit,
    allowLateJoin: roomData.settings?.allowLateJoin ?? true,
    showResultAfterSubmit: roomData.settings?.showResultAfterSubmit ?? true,
    shuffleQuestions: roomData.settings?.shuffleQuestions ?? true,
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

const parseRoomData = (id: string, data: DocumentData): Room => ({
  id,
  code: data.code || '',
  examId: data.examId || '',
  examTitle: data.examTitle || '',
  teacherId: data.teacherId || '',
  teacherName: data.teacherName || '',
  accessMode: (data.accessMode as AccessMode | undefined) ?? 'public',
  classId: data.classId,
  className: data.className,
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
});

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
  if (!roomSnap.exists()) return null;
  return parseRoomData(roomSnap.id, roomSnap.data());
};

export const getRoomsByTeacher = async (teacherId: string): Promise<Room[]> => {
  const q = query(collection(db, 'rooms'), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);

  const rooms = snapshot.docs.map((docSnap) => parseRoomData(docSnap.id, docSnap.data()));
  rooms.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  return rooms;
};

export const updateRoomStatus = async (roomId: string, status: Room['status']): Promise<void> => {
  const roomRef = doc(db, 'rooms', roomId);
  const updateData: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (status === 'active') updateData.startTime = serverTimestamp();
  if (status === 'closed') updateData.endTime = serverTimestamp();
  await updateDoc(roomRef, updateData);
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  const q = query(collection(db, 'submissions'), where('roomId', '==', roomId));
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'rooms', roomId));
};

export const subscribeToRoom = (roomId: string, callback: (room: Room | null) => void) => {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (docSnap) => {
    if (docSnap.exists()) callback(parseRoomData(docSnap.id, docSnap.data()));
    else callback(null);
  });
};

// ============ SUBMISSION FUNCTIONS ============

const parseSubmissionData = (id: string, data: DocumentData): Submission => ({
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
});

export const createSubmission = async (submission: Omit<Submission, 'id'>): Promise<string> => {
  await ensureGuestSignedIn();

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

export const updateSubmission = async (submissionId: string, data: Partial<Submission>): Promise<void> => {
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

  if (!submissionSnap.exists()) throw new Error('Submission not found');
  const submissionData = submissionSnap.data();

  let correctCount = 0;
  const totalQuestions = exam.questions.length;

  exam.questions.forEach((q: Question) => {
    const userAnswer = answers[q.number];
    const correctAnswer = q.correctAnswer;
    if (!userAnswer || !correctAnswer) return;

    if (q.type === 'writing') {
      const normalize = (text: string) =>
        text
          .toLowerCase()
          .replace(/['']/g, "'")
          .replace(/\s+/g, ' ')
          .replace(/[.,!?;:]/g, '')
          .trim();

      if (normalize(userAnswer) === normalize(correctAnswer)) correctCount++;
    } else {
      if (userAnswer.toUpperCase() === correctAnswer.toUpperCase()) correctCount++;
    }
  });

  const wrongCount = totalQuestions - correctCount;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  let startedAt: Date;
  if (submissionData.startedAt instanceof Timestamp) startedAt = submissionData.startedAt.toDate();
  else if (submissionData.startedAt) startedAt = new Date(submissionData.startedAt);
  else startedAt = new Date();

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
  if (!submissionSnap.exists()) return null;
  return parseSubmissionData(submissionSnap.id, submissionSnap.data());
};

export const getSubmissionsByRoom = async (roomId: string): Promise<Submission[]> => {
  const q = query(collection(db, 'submissions'), where('roomId', '==', roomId));
  const snapshot = await getDocs(q);
  const submissions = snapshot.docs.map((docSnap) => parseSubmissionData(docSnap.id, docSnap.data()));
  return submissions.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
};

export const getStudentSubmission = async (roomId: string, studentId: string): Promise<Submission | null> => {
  const q = query(
    collection(db, 'submissions'),
    where('roomId', '==', roomId),
    where('student.id', '==', studentId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return parseSubmissionData(snapshot.docs[0].id, snapshot.docs[0].data());
};

export const subscribeToSubmissions = (roomId: string, callback: (submissions: Submission[]) => void) => {
  const q = query(collection(db, 'submissions'), where('roomId', '==', roomId));
  return onSnapshot(q, (snapshot) => {
    const submissions = snapshot.docs.map((docSnap) => parseSubmissionData(docSnap.id, docSnap.data()));
    submissions.sort((a, b) => {
      if ((b.percentage || 0) !== (a.percentage || 0)) return (b.percentage || 0) - (a.percentage || 0);
      return (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0);
    });
    callback(submissions);
  });
};

// ============ EXPORTS ============
// ✅ export thêm orderBy/limit để tương thích code cũ
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
