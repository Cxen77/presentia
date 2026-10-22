export type ScreenName = 'onboarding' | 'login' | 'register' | 'profile_setup' | 'qr_login' | 'main';
export type TabName = 'home' | 'classes' | 'attendance' | 'profile';

export type AttendanceStatus = 'Not Started' | 'Available' | 'Present' | 'Late' | 'Absent';

export interface StudentProfile {
  id: string;
  userId?: string;
  email?: string;
  name: string;
  firstName: string;
  degree: string;
  rollNumber: string;
  semester: string;
  avatarUrl: string;
  attendancePercent: number;
  totalClasses: number;
  presentToday: number;
}

export interface ClassScheduleItem {
  id: string;
  subject: string;
  courseCode: string;
  classType: string;
  timeSlot: string;
  room: string;
  iconName: 'monitor' | 'book' | 'users' | 'chart';
  isHighlighted?: boolean;
  status: AttendanceStatus;
  teacherName?: string;
  department?: string;
  enrollmentCode?: string;
  enrollmentId?: string;
}

export interface DatabaseClass {
  id: string;
  course_code: string;
  class_name: string;
  department: string;
  enrollment_code: string;
  teacher_name?: string;
  schedule_info?: string;
  room?: string;
  class_type?: string;
  credits?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface ClassEnrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  status?: string;
  classes?: DatabaseClass;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  courseCode: string;
  subjectName: string;
  facultyName: string;
  room: string;
  sessionToken: string;
  expiresAt: string;
  isActive: boolean;
  attendeesCount: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  sessionToken: string;
  markedAt: string;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
}
