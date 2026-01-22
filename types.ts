// ============ ENUMS ============

export enum Role {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  MEMBER = 'member',
  DEPUTY = 'deputy',
  LEADER = 'leader'
}

// ============ QUESTION TYPES ============

export type QuestionType = 
  | 'multiple_choice'   // Trắc nghiệm nhiều lựa chọn (PHẦN 1)
  | 'true_false'        // Đúng sai (PHẦN 2)
  | 'short_answer'      // Trả lời ngắn (PHẦN 3)
  | 'writing'           // Viết (cho Tiếng Anh)
  | 'unknown';

// ============ IMAGE DATA ============

export interface ImageData {
  id: string;           // ID duy nhất (vd: img_0, img_1)
  filename: string;     // Tên file gốc (image1.png, etc.)
  base64: string;       // Dữ liệu base64
  contentType: string;  // MIME type (image/png, image/jpeg, etc.)
  rId?: string;         // Relationship ID trong Word (rId4, rId5...)
}

// ============ USER ============

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: Role;
  status?: 'online' | 'offline' | 'busy';
  isApproved?: boolean;
  createdAt?: Date;
}

// ============ QUESTION & OPTIONS ============

export interface QuestionOption {
  letter: string;         // A, B, C, D hoặc a, b, c, d
  text: string;           // Nội dung option (có thể chứa LaTeX)
  textWithUnderline?: string;  // Text với HTML underline (cho Tiếng Anh)
  isCorrect?: boolean;    // Đáp án đúng
}

export interface SectionInfo {
  letter: string;         // 1, 2, 3 hoặc A, B, C
  name: string;           // Tên phần
  points: string;         // Điểm
}

export interface Question {
  number: number;                    // Số thứ tự câu hỏi (101, 102... cho PHẦN 1)
  text: string;                      // Nội dung câu hỏi (có thể chứa LaTeX)
  type: QuestionType;                // Loại câu hỏi
  options: QuestionOption[];         // Các đáp án lựa chọn
  correctAnswer: string | null;      // Đáp án đúng (A/B/C/D, a,b,c hoặc số)
  section?: SectionInfo;             // Thông tin section
  part?: string;                     // Phần (PHẦN 1, 2, 3)
  passage?: string;                  // Đoạn văn đọc hiểu
  solution?: string;                 // Lời giải chi tiết
  images?: ImageData[];              // Hình ảnh trong câu hỏi
  tfStatements?: { [key: string]: string };  // Các mệnh đề đúng sai (a, b, c, d)
}

// ============ EXAM SECTION ============

export interface ExamSection {
  name: string;
  description: string;
  points: string;
  readingPassage?: string;
  questions: Question[];
  sectionType?: QuestionType;  // Loại câu hỏi của section
}

// ============ EXAM DATA (for parsing) ============

export interface ExamData {
  title: string;
  subject?: 'math' | 'english' | 'other';  // Môn học
  timeLimit?: number;
  sections: ExamSection[];
  questions: Question[];
  answers: { [key: number]: string };
  images?: ImageData[];  // Tất cả hình ảnh trong đề
}

// ============ EXAM (stored in Firebase) ============

export interface Exam {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  timeLimit: number;
  questions: Question[];
  sections: ExamSection[];
  answers: { [key: number]: string };
  images?: ImageData[];
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============ ROOM ============

export interface Room {
  id: string;
  code: string;
  examId: string;
  examTitle: string;
  teacherId: string;
  teacherName: string;
  status: 'waiting' | 'active' | 'closed';
  startTime?: Date;
  endTime?: Date;
  timeLimit: number;
  allowLateJoin: boolean;
  showResultAfterSubmit: boolean;
  shuffleQuestions: boolean;
  maxAttempts: number;
  totalStudents: number;
  submittedCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============ STUDENT INFO ============

export interface StudentInfo {
  id: string;
  name: string;
  className?: string;
  studentId?: string;
}

// ============ SUBMISSION ============

export interface Submission {
  id: string;
  roomId: string;
  roomCode: string;
  examId: string;
  student: StudentInfo;
  answers: { [questionNumber: number]: string };
  score: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  percentage: number;
  startedAt?: Date;
  submittedAt?: Date;
  duration: number;
  status: 'in_progress' | 'submitted' | 'graded';
}

// ============ ROOM WITH EXAM ============

export interface RoomWithExam extends Room {
  exam: Exam;
}

// ============ LEADERBOARD ============

export interface LeaderboardEntry {
  rank: number;
  student: StudentInfo;
  score: number;
  percentage: number;
  duration: number;
  submittedAt?: Date;
}
