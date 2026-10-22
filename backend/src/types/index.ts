// Shared backend type definitions

export interface ProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  first_name: string;
  roll_number: string;
  degree: string;
  semester: string;
  avatar_url: string | null;
  role: 'student' | 'faculty' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface ClassRow {
  id: string;
  course_code: string;
  class_name: string;
  department: string;
  enrollment_code: string;
  teacher_name: string | null;
  schedule_info: string | null;
  room: string | null;
  class_type: string | null;
  credits: number | null;
  is_active: boolean;
  faculty_id: string | null;
  description: string | null;
  semester: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  class_id: string;
  faculty_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: 'ACTIVE' | 'AWAITING_VERIFICATION' | 'CLOSED';
  token_rotation_count: number;
  created_at: string;
  closed_at: string | null;
}

export interface QRTokenRow {
  id: string;
  session_id: string;
  token: string;
  nonce: string;
  expires_at: string;
  is_used: boolean;
  created_at: string;
}

export interface AttendanceRecordRow {
  id: string;
  session_id: string;
  class_id: string;
  student_id: string;
  qr_token_id: string | null;
  verification_photo_url: string | null;
  status: 'PENDING' | 'PRESENT' | 'REJECTED';
  submitted_at: string;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
}
