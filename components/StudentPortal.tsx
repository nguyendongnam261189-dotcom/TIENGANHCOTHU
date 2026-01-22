import React, { useState } from 'react';
import { Room, StudentInfo } from '../types';
import { getRoomByCode, getStudentSubmission } from '../services/firebaseService';

interface StudentPortalProps {
  onJoinRoom: (room: Room, student: StudentInfo, existingSubmissionId?: string) => void;
}

const StudentPortal: React.FC<StudentPortalProps> = ({ onJoinRoom }) => {
  const [step, setStep] = useState<'code' | 'info'>('code');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckRoom = async () => {
    if (!roomCode.trim()) {
      setError('Vui lòng nhập mã phòng thi');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const foundRoom = await getRoomByCode(roomCode.trim());

      if (!foundRoom) {
        setError('Không tìm thấy phòng thi với mã này');
        setIsLoading(false);
        return;
      }

      if (foundRoom.status === 'closed') {
        setError('Phòng thi đã đóng');
        setIsLoading(false);
        return;
      }

      if (foundRoom.status === 'waiting') {
        setError('Phòng thi chưa bắt đầu. Vui lòng đợi giáo viên mở phòng.');
        setIsLoading(false);
        return;
      }

      setRoom(foundRoom);
      setStep('info');
    } catch (err) {
      console.error(err);
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!studentName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }

    if (!room) return;

    setIsLoading(true);
    setError('');

    try {
      // Student ID ổn định: ưu tiên mã HS nhập vào, nếu không có thì dùng timestamp
      const sId = studentId.trim() || `S${Date.now()}`;

      // ⚠️ Firestore KHÔNG chấp nhận undefined -> chỉ thêm field khi có giá trị
      const student: StudentInfo = {
        id: sId,
        name: studentName.trim(),
        ...(studentClass.trim() ? { className: studentClass.trim() } : {}),
        ...(studentId.trim() ? { studentId: studentId.trim() } : {})
      };

      // Kiểm tra xem học sinh đã làm bài chưa
      const existingSubmission = await getStudentSubmission(room.id, sId);

      if (existingSubmission && existingSubmission.status === 'submitted') {
        setError('Bạn đã nộp bài thi này rồi!');
        setIsLoading(false);
        return;
      }

      onJoinRoom(room, student, existingSubmission?.id);
    } catch (err) {
      console.error(err);
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-3xl font-bold text-teal-900">Phòng Thi Online</h1>
          <p className="text-teal-600 mt-2">Nhập mã phòng để bắt đầu làm bài</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {step === 'code' ? (
            <>
              <div className="mb-6">
                <label className="block text-teal-800 font-semibold mb-2">Mã phòng thi</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="VD: ABC123"
                  maxLength={6}
                  className="w-full px-4 py-4 text-2xl text-center font-bold tracking-widest border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckRoom()}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                  {error}
                </div>
              )}

              <button
                onClick={handleCheckRoom}
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-bold text-lg text-white transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Đang kiểm tra...
                  </span>
                ) : (
                  'Tiếp tục →'
                )}
              </button>
            </>
          ) : (
            <>
              {/* Room Info */}
              <div className="mb-6 p-4 bg-teal-50 rounded-xl border border-teal-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-white text-xl">📚</div>
                  <div>
                    <p className="text-sm text-teal-600">Phòng thi</p>
                    <p className="font-bold text-teal-900">{room?.examTitle}</p>
                    <p className="text-sm text-teal-600">
                      Mã: <span className="font-mono font-bold">{room?.code}</span> • Thời gian: {room?.timeLimit} phút
                    </p>
                  </div>
                </div>
              </div>

              {/* Student Info Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-teal-800 font-semibold mb-2">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-4 py-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-teal-800 font-semibold mb-2">Lớp</label>
                    <input
                      type="text"
                      value={studentClass}
                      onChange={(e) => setStudentClass(e.target.value)}
                      placeholder="VD: 6A1"
                      className="w-full px-4 py-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-teal-800 font-semibold mb-2">Mã học sinh</label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="VD: HS001"
                      className="w-full px-4 py-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('code');
                    setError('');
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold text-teal-600 border-2 border-teal-300 hover:bg-teal-50 transition"
                >
                  ← Quay lại
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                  className="flex-[2] py-3 rounded-xl font-bold text-white transition transform hover:scale-105 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
                >
                  {isLoading ? 'Đang vào...' : '🚀 Vào phòng thi'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-teal-600 mt-6 text-sm">Liên hệ giáo viên nếu bạn chưa có mã phòng thi</p>
      </div>
    </div>
  );
};

export default StudentPortal;
