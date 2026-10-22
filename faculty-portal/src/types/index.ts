export type UserRole = 'faculty' | 'student' | 'admin';

export interface FacultyUser {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string;
  avatarUrl?: string;
  role: 'faculty';
}

export interface StudentProfile {
  id: string;
  fullName: string;
  rollNumber: string; // USN or Roll Number
  email: string;
  degree: string;
  semester: string;
  avatarUrl: string;
  enrolledAt?: string;
  overallAttendanceRate?: number;
}

export interface ClassItem {
  id: string;
  courseCode: string;
  className: string;
  department: string;
  semester: string;
  room: string;
  scheduleInfo: string;
  startTime: string; // "10:00 AM" or "10:00"
  endTime: string;   // "11:30 AM" or "11:30"
  classType: 'Theory' | 'Practical' | 'Seminar';
  credits: number;
  enrollmentCode: string;
  facultyId: string;
  facultyName: string;
  description?: string;
  enrolledStudentsCount: number;
  isActive: boolean;
  createdAt: string;
}

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'AWAITING_VERIFICATION' | 'CLOSED';

export interface AttendanceSession {
  id: string;
  classId: string;
  courseCode: string;
  className: string;
  room: string;
  facultyId: string;
  facultyName: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: SessionStatus;
  currentToken: string;
  tokenExpiresAt: number; // epoch ms
  tokenRotationCount: number;
  createdAt: string;
  closedAt?: string;
}

export type AttendanceRecordStatus = 'PRESENT' | 'ABSENT' | 'PENDING' | 'REJECTED';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentAvatarUrl: string;
  verificationPhotoUrl: string;
  submittedAt: string;
  status: AttendanceRecordStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface QRTokenPayload {
  sessionId: string;
  classId: string;
  courseCode: string;
  token: string;
  timestamp: number;
  expiresAt: number;
  nonce: string;
}
