import React, { useState, useEffect } from 'react';
import StudentPortal from './components/StudentPortal';
import ExamRoom from './components/ExamRoom';
import ResultView from './components/ResultView';
import TeacherDashboard from './components/TeacherDashboard';
import PendingApproval from './components/PendingApproval';
import AdminUserPanel from './components/AdminUserPanel';
import { User, Role, Room, StudentInfo, Submission, Exam } from './types';
import { auth, signInWithGoogle, signOutUser, getCurrentUser, getExam, hasAnyUsers } from './services/firebaseService';

type AppView = 'landing' | 'student-portal' | 'exam-room' | 'result' | 'teacher-dashboard' | 'pending-approval' | 'admin-users';

// ⚠️ CẤU HÌNH ADMIN - Chỉ những email này được tự động duyệt và có quyền quản lý user
// Thêm email admin của bạn vào đây, ví dụ: 'admin@gmail.com'
const ADMIN_EMAILS: string[] = [
  // 'your-admin-email@gmail.com', // ← Thêm email admin vào đây
];

function App() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Student state
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentStudent, setCurrentStudent] = useState<StudentInfo | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [existingSubmissionId, setExistingSubmissionId] = useState<string | undefined>();
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);

  // Check if user is admin
  const isAdmin = currentUser && (
    currentUser.role === Role.ADMIN || 
    currentUser.role === Role.LEADER ||
    currentUser.role === Role.DEPUTY ||
    ADMIN_EMAILS.includes(currentUser.email || '')
  );

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const user = await getCurrentUser();
          if (user) {
            setCurrentUser(user);
            
            // Kiểm tra isApproved
            if (user.isApproved) {
              setCurrentView('teacher-dashboard');
            } else {
              // Kiểm tra nếu là admin email thì auto approve
              if (ADMIN_EMAILS.includes(user.email || '')) {
                // Auto approve cho admin
                setCurrentView('teacher-dashboard');
              } else {
                setCurrentView('pending-approval');
              }
            }
          }
        } catch (err) {
          console.error('Auth error:', err);
        }
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle teacher login
  const handleTeacherLogin = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        setCurrentUser(user);
        
        // Kiểm tra isApproved
        if (user.isApproved || ADMIN_EMAILS.includes(user.email || '')) {
          setCurrentView('teacher-dashboard');
        } else {
          setCurrentView('pending-approval');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Đăng nhập thất bại. Vui lòng thử lại.');
    }
  };

  // Handle teacher logout
  const handleTeacherLogout = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setCurrentView('landing');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle student joining room
  const handleJoinRoom = async (room: Room, student: StudentInfo, submissionId?: string) => {
    setCurrentRoom(room);
    setCurrentStudent(student);
    setExistingSubmissionId(submissionId);
    
    // Load exam data
    const exam = await getExam(room.examId);
    if (exam) {
      setCurrentExam(exam);
    }
    
    setCurrentView('exam-room');
  };

  // Handle exam submission
  const handleSubmitted = (submission: Submission) => {
    setCurrentSubmission(submission);
    setCurrentView('result');
  };

  // Handle exit from exam/result
  const handleExit = () => {
    setCurrentRoom(null);
    setCurrentStudent(null);
    setCurrentSubmission(null);
    setCurrentExam(null);
    setExistingSubmissionId(undefined);
    setCurrentView('landing');
  };

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ background: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)' }}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl">Đang kết nối...</p>
        </div>
      </div>
    );
  }

  // Render based on current view
  switch (currentView) {
    case 'student-portal':
      return <StudentPortal onJoinRoom={handleJoinRoom} />;
    
    case 'exam-room':
      if (!currentRoom || !currentStudent) {
        setCurrentView('landing');
        return null;
      }
      return (
        <ExamRoom
          room={currentRoom}
          student={currentStudent}
          existingSubmissionId={existingSubmissionId}
          onSubmitted={handleSubmitted}
          onExit={handleExit}
        />
      );
    
    case 'result':
      if (!currentSubmission || !currentRoom) {
        setCurrentView('landing');
        return null;
      }
      return (
        <ResultView
          submission={currentSubmission}
          room={currentRoom}
          exam={currentExam || undefined}
          showAnswers={currentRoom.showResultAfterSubmit}
          onExit={handleExit}
        />
      );
    
    case 'pending-approval':
      if (!currentUser) {
        setCurrentView('landing');
        return null;
      }
      return (
        <PendingApproval 
          user={currentUser} 
          onLogout={handleTeacherLogout}
        />
      );
    
    case 'admin-users':
      if (!currentUser || !isAdmin) {
        setCurrentView('teacher-dashboard');
        return null;
      }
      return (
        <AdminUserPanel
          currentUser={currentUser}
          onBack={() => setCurrentView('teacher-dashboard')}
        />
      );
    
    case 'teacher-dashboard':
      if (!currentUser) {
        setCurrentView('landing');
        return null;
      }
      return (
        <div>
          {/* Admin Button - hiển thị nếu là admin */}
          {isAdmin && (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={() => setCurrentView('admin-users')}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-full shadow-2xl transition transform hover:scale-105 flex items-center gap-2 font-semibold"
              >
                👥 Quản lý User
              </button>
            </div>
          )}
          <TeacherDashboard
            user={currentUser}
            onLogout={handleTeacherLogout}
          />
        </div>
      );
    
    default:
      // Landing page
      return (
        <div 
          className="min-h-screen flex items-center justify-center p-4"
          style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)' }}
        >
          <div className="max-w-lg w-full">
            {/* Logo */}
            <div className="text-center mb-10">
              <div className="text-8xl mb-4">📚</div>
              <h1 className="text-4xl font-bold text-teal-900 mb-2">Exam Online</h1>
              <p className="text-teal-600 text-lg">Hệ thống thi trực tuyến</p>
            </div>

            {/* Role Selection */}
            <div className="space-y-4">
              {/* Student Button */}
              <button
                onClick={() => setCurrentView('student-portal')}
                className="w-full bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition transform hover:scale-105 text-left flex items-center gap-5"
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
                >
                  🎓
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Học sinh</h2>
                  <p className="text-gray-500">Nhập mã phòng để vào thi</p>
                </div>
                <div className="text-teal-500 text-2xl">→</div>
              </button>

              {/* Teacher Button */}
              <button
                onClick={handleTeacherLogin}
                className="w-full bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition transform hover:scale-105 text-left flex items-center gap-5"
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
                >
                  👨‍🏫
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Giáo viên</h2>
                  <p className="text-gray-500">Đăng nhập để quản lý đề thi</p>
                </div>
                <div className="text-orange-500 text-2xl">→</div>
              </button>
            </div>

            {/* Features */}
            <div className="mt-10 grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/70 rounded-xl p-4">
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-sm text-gray-600">Nhanh chóng</p>
              </div>
              <div className="bg-white/70 rounded-xl p-4">
                <div className="text-2xl mb-2">🔒</div>
                <p className="text-sm text-gray-600">Bảo mật</p>
              </div>
              <div className="bg-white/70 rounded-xl p-4">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-sm text-gray-600">Thống kê</p>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-teal-600 mt-8 text-sm">
              Powered by Firebase • Made with ❤️
            </p>
          </div>
        </div>
      );
  }
}

export default App;
