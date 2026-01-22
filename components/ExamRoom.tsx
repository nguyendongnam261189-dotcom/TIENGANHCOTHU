import React, { useState, useEffect, useMemo } from 'react';
import { Room, Exam, StudentInfo, Submission, Question, QuestionOption, SectionInfo } from '../types';
import { getExam, createSubmission, submitExam, subscribeToRoom } from '../services/firebaseService';

interface ExamRoomProps {
  room: Room;
  student: StudentInfo;
  existingSubmissionId?: string;
  onSubmitted: (submission: Submission) => void;
  onExit: () => void;
}

const ExamRoom: React.FC<ExamRoomProps> = ({ 
  room, 
  student, 
  existingSubmissionId,
  onSubmitted, 
  onExit 
}) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(existingSubmissionId || null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [timeLeft, setTimeLeft] = useState(room.timeLimit * 60);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [roomStatus, setRoomStatus] = useState(room.status);

  // Load exam data
  useEffect(() => {
    const loadExam = async () => {
      try {
        const examData = await getExam(room.examId);
        if (examData) {
          setExam(examData);
          
          // Create submission if not exists
          if (!submissionId) {
            const newSubmissionId = await createSubmission({
              roomId: room.id,
              roomCode: room.code,
              examId: room.examId,
              student,
              answers: {},
              score: 0,
              correctCount: 0,
              wrongCount: 0,
              totalQuestions: examData.questions.length,
              percentage: 0,
              startedAt: new Date(),
              submittedAt: new Date(),
              duration: 0,
              status: 'in_progress'
            });
            setSubmissionId(newSubmissionId);
          }
        }
      } catch (err) {
        console.error('Error loading exam:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadExam();
  }, [room.examId, room.id, student, submissionId]);

  // Subscribe to room status changes
  useEffect(() => {
    const unsubscribe = subscribeToRoom(room.id, (updatedRoom) => {
      if (updatedRoom) {
        setRoomStatus(updatedRoom.status);
        if (updatedRoom.status === 'closed') {
          // Auto submit when room closes
          handleSubmit(true);
        }
      }
    });

    return () => unsubscribe();
  }, [room.id]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleSubmit = async (force: boolean = false) => {
    if (!force && !showConfirmSubmit) {
      setShowConfirmSubmit(true);
      return;
    }

    if (!exam || !submissionId) return;

    setIsSubmitting(true);
    setShowConfirmSubmit(false);

    try {
      const result = await submitExam(submissionId, userAnswers, exam);
      onSubmitted(result);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Có lỗi khi nộp bài. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(userAnswers).filter(k => userAnswers[parseInt(k)]).length;
  const totalQuestions = exam?.questions.length || 0;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Group questions by section
  const groupedQuestions = useMemo(() => {
    if (!exam) return [];
    
    const groups: {
      section: SectionInfo | null;
      part: string | null;
      passage: string | null;
      questions: Question[];
    }[] = [];

    let currentSection: SectionInfo | null = null;
    let currentPart: string | null = null;
    let currentPassage: string | null = null;
    let currentGroup: Question[] = [];
    const printedPassages = new Set<string>();

    exam.questions.forEach((q, idx) => {
      const sectionChanged = JSON.stringify(q.section) !== JSON.stringify(currentSection);
      const partChanged = q.part !== currentPart;

      if (sectionChanged || partChanged) {
        if (currentGroup.length > 0) {
          groups.push({
            section: currentSection,
            part: currentPart,
            passage: currentPassage,
            questions: currentGroup
          });
        }
        currentSection = q.section || null;
        currentPart = q.part || null;
        currentPassage = q.passage && !printedPassages.has(q.passage) ? q.passage : null;
        if (q.passage) printedPassages.add(q.passage);
        currentGroup = [q];
      } else {
        currentGroup.push(q);
      }

      if (idx === exam.questions.length - 1 && currentGroup.length > 0) {
        groups.push({
          section: currentSection,
          part: currentPart,
          passage: currentPassage,
          questions: currentGroup
        });
      }
    });

    return groups;
  }, [exam]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto mb-4"></div>
          <p className="text-teal-700 text-lg">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-red-600 text-lg">Không tìm thấy đề thi</p>
          <button onClick={onExit} className="mt-4 text-teal-600 underline">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' }}>
      {/* CSS for underlined parts */}
      <style>{`
        .underlined-part {
          text-decoration: underline;
          text-decoration-thickness: 2px;
          font-weight: bold;
        }
        .blank {
          display: inline-block;
          min-width: 120px;
          border-bottom: 2px dashed #2dd4bf;
          margin: 0 5px;
        }
      `}</style>

      {/* Header - Sticky */}
      <div 
        className="text-white p-4 shadow-lg sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                👤
              </div>
              <div>
                <p className="font-bold">{student.name}</p>
                <p className="text-sm text-teal-100">
                  {student.className && `Lớp ${student.className} • `}
                  Mã phòng: {room.code}
                </p>
              </div>
            </div>
            
            {/* Timer */}
            <div className={`text-center px-6 py-2 rounded-xl ${
              timeLeft < 60 ? 'bg-red-500 animate-pulse' : 'bg-white/20'
            }`}>
              <div className="text-sm opacity-90">⏱ Còn lại</div>
              <div className="text-2xl font-bold font-mono">{formatTime(timeLeft)}</div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Tiến độ: {answeredCount}/{totalQuestions} câu</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-teal-300 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => setShowConfirmSubmit(true)}
              disabled={isSubmitting}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold transition"
            >
              📤 Nộp bài
            </button>
          </div>
        </div>
      </div>

      {/* Room Closed Warning */}
      {roomStatus === 'closed' && (
        <div className="bg-red-500 text-white text-center py-2 font-bold">
          ⚠️ Phòng thi đã đóng! Bài làm của bạn đang được nộp tự động...
        </div>
      )}

      {/* Questions */}
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-teal-900 mb-6">{exam.title}</h1>

        {groupedQuestions.map((group, gIdx) => (
          <div key={gIdx} className="mb-8">
            {/* Section Header */}
            {group.section && (
              <div 
                className="text-white p-4 rounded-t-2xl"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)' }}
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold uppercase">
                    SECTION {group.section.letter}. {group.section.name}
                  </h2>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                    {group.section.points}
                  </span>
                </div>
              </div>
            )}

            {/* Part Header */}
            {group.part && (
              <div 
                className="p-3 border-l-4 border-orange-500 italic font-medium text-sm"
                style={{ background: 'linear-gradient(90deg, #ffedd5, #fff7ed)', color: '#9a3412' }}
              >
                {group.part}
              </div>
            )}

            {/* Reading Passage */}
            {group.passage && (
              <div 
                className="p-5 my-3 rounded-xl border-l-4 border-orange-500"
                style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, white 100%)' }}
              >
                {group.passage.split('\n').map((line, i) => (
                  i === 0 ? (
                    <h3 key={i} className="text-orange-700 font-bold text-center mb-3">{line}</h3>
                  ) : (
                    <p key={i} className="text-teal-900 leading-relaxed text-sm">{line}</p>
                  )
                ))}
              </div>
            )}

            {/* Questions */}
            <div className="bg-white rounded-b-2xl shadow-lg overflow-hidden">
              {group.questions.map((question, qIdx) => (
                <QuestionItem
                  key={question.number}
                  question={question}
                  userAnswer={userAnswers[question.number]}
                  onAnswerChange={handleAnswerChange}
                  isLast={qIdx === group.questions.length - 1}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Bottom Submit Button */}
        <div className="sticky bottom-6 flex justify-center">
          <button
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isSubmitting}
            className="px-10 py-4 rounded-full font-bold text-lg text-white shadow-2xl transition transform hover:scale-105 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
          >
            {isSubmitting ? '⏳ Đang nộp...' : '📤 Nộp bài'}
          </button>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">📝</div>
              <h3 className="text-xl font-bold text-gray-900">Xác nhận nộp bài?</h3>
              <p className="text-gray-600 mt-2">
                Bạn đã trả lời <strong className="text-teal-600">{answeredCount}/{totalQuestions}</strong> câu hỏi.
                {answeredCount < totalQuestions && (
                  <span className="block text-orange-600 mt-1">
                    ⚠️ Còn {totalQuestions - answeredCount} câu chưa trả lời!
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 border-2 border-gray-300 hover:bg-gray-50 transition"
              >
                Tiếp tục làm
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-bold text-white transition"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
              >
                {isSubmitting ? '⏳ Đang nộp...' : '✓ Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Question Item Component
interface QuestionItemProps {
  question: Question;
  userAnswer?: string;
  onAnswerChange: (questionNumber: number, answer: string) => void;
  isLast: boolean;
}

const QuestionItem: React.FC<QuestionItemProps> = ({
  question,
  userAnswer,
  onAnswerChange,
  isLast
}) => {
  const isPhonetics = question.section?.name?.toLowerCase().includes('phonetics');
  
  const getQuestionStem = (): string => {
    if (!question.text) return '';
    if (question.type === 'multiple_choice') {
      const re = /([A-D])[\.\)]/;
      const m = re.exec(question.text);
      if (m && m.index <= 2) {
        return question.text.slice(0, m.index).trim();
      }
    }
    return question.text;
  };

  const formatQuestionText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/_+/g, '<span class="blank"></span>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div className={`p-5 hover:bg-teal-50 transition ${!isLast ? 'border-b border-teal-100' : ''}`}>
      <div className="flex items-start gap-3 mb-3">
        <div 
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
            userAnswer ? 'bg-green-500 text-white' : 'bg-teal-500 text-white'
          }`}
        >
          {question.number}
        </div>
        <div className="flex-1">
          <p 
            className="text-gray-800"
            dangerouslySetInnerHTML={{ __html: formatQuestionText(getQuestionStem()) }}
          />
        </div>
      </div>

      {question.type === 'multiple_choice' && question.options && (
        <div className="grid grid-cols-2 gap-3 ml-12">
          {question.options.map((option: QuestionOption) => {
            const isSelected = userAnswer?.toUpperCase() === option.letter.toUpperCase();
            const displayText = isPhonetics && option.textWithUnderline 
              ? option.textWithUnderline 
              : option.text;

            return (
              <label
                key={option.letter}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                  isSelected 
                    ? 'border-teal-600 bg-teal-100' 
                    : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                <input
                  type="radio"
                  name={`q${question.number}`}
                  value={option.letter}
                  checked={isSelected}
                  onChange={(e) => onAnswerChange(question.number, e.target.value)}
                  className="hidden"
                />
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isSelected ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {option.letter}
                </span>
                <span 
                  className="flex-1 text-gray-700 text-sm"
                  dangerouslySetInnerHTML={{ __html: displayText }}
                />
              </label>
            );
          })}
        </div>
      )}

      {question.type === 'writing' && (
        <div className="ml-12">
          <input
            type="text"
            value={userAnswer || ''}
            onChange={(e) => onAnswerChange(question.number, e.target.value)}
            placeholder="Nhập câu trả lời..."
            className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
};

export default ExamRoom;
