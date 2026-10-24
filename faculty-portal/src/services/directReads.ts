import { supabase } from './supabase';
import type { AttendanceSession, ClassItem } from '../types';

// Direct database reads for the hottest faculty pages. Supabase row-level
// security restricts each signed-in teacher to their own rows, so these skip
// the Render hop entirely (browser -> database in one request). Privileged
// operations — writes, photo signing, reports — stay on the backend.
// Every function falls back to the backend path on any problem.

type DirectResult<T> = { ok: true; value: T } | { ok: false };

// Minimal row shapes for the untyped supabase-js client (snake_case columns).
interface ClassRow {
  id: string; course_code: string; class_name: string; department: string; semester: string | null;
  room: string | null; schedule_info: string | null; start_time: string | null; end_time: string | null;
  class_type: ClassItem['classType'] | null; credits: number | null; enrollment_code: string;
  faculty_id: string; teacher_name: string | null; description: string | null;
  is_active: boolean | null; created_at: string; geofence: ClassItem['geofence'] | null;
  class_enrollments: { count: number }[];
}
interface SessionRow {
  id: string; class_id: string; faculty_id: string; date: string; start_time: string; end_time: string;
  status: AttendanceSession['status']; token_rotation_count: number; created_at: string;
  closed_at?: string; finalized_at?: string | null;
  class: { course_code?: string; class_name?: string; room?: string } | null;
  qr_tokens: TokenRow[];
}
interface TokenRow { token: string; expires_at: string; }

function cachedFaculty(): { id: string; name: string } | null {
  // AuthContext persists the resolved identity; only faculty use direct reads
  // (admins need the backend's all-classes view).
  try {
    const user = JSON.parse(localStorage.getItem('faculty_portal_current_user_v1') || 'null');
    if (user?.role === 'faculty' && user?.id) return { id: user.id, name: user.name || '' };
  } catch { /* fall back to backend */ }
  return null;
}

// A failed direct read (missing grant, policy change) must not repeat on every
// poll: back off for five minutes and use the backend path, which always works.
const COOLDOWN_MS = 5 * 60_000;
const cooldowns = { classes: 0, activeSession: 0 };
function cooledDown(key: keyof typeof cooldowns) { return Date.now() >= cooldowns[key]; }
function tripCooldown(key: keyof typeof cooldowns) { cooldowns[key] = Date.now() + COOLDOWN_MS; }

export async function getClassesDirect(): Promise<DirectResult<ClassItem[]>> {
  const faculty = cachedFaculty();
  if (!faculty || !cooledDown('classes')) return { ok: false };
  const classesRes = await supabase.from('classes')
    .select('*, class_enrollments(count)')
    .eq('faculty_id', faculty.id)
    .eq('class_enrollments.status', 'active')
    .order('created_at', { ascending: false }) as { data: ClassRow[] | null; error: { message: string } | null };
  if (classesRes.error || !classesRes.data) { tripCooldown('classes'); return { ok: false }; }
  return {
    ok: true,
    value: classesRes.data.map(cls => ({
      id: cls.id,
      courseCode: cls.course_code,
      className: cls.class_name,
      department: cls.department,
      semester: cls.semester || '',
      room: cls.room || '',
      scheduleInfo: cls.schedule_info || '',
      startTime: cls.start_time || '',
      endTime: cls.end_time || '',
      classType: cls.class_type || 'Theory',
      credits: cls.credits || 4,
      enrollmentCode: cls.enrollment_code,
      facultyId: cls.faculty_id,
      facultyName: cls.teacher_name || faculty.name,
      description: cls.description || '',
      enrolledStudentsCount: cls.class_enrollments[0]?.count || 0,
      isActive: cls.is_active ?? true,
      createdAt: cls.created_at,
      geofence: cls.geofence || { enabled: false },
    })),
  };
}

export async function getActiveSessionDirect(): Promise<DirectResult<AttendanceSession | null>> {
  const faculty = cachedFaculty();
  if (!faculty || !cooledDown('activeSession')) return { ok: false };
  const sessionRes = (await supabase
    .from('attendance_sessions')
    .select('*, class:class_id(course_code, class_name, room), qr_tokens(token, expires_at)')
    .eq('faculty_id', faculty.id)
    .in('status', ['ACTIVE', 'AWAITING_VERIFICATION'])
    .order('created_at', { ascending: false })
    .order('created_at', { ascending: false, referencedTable: 'qr_tokens' })
    .limit(1, { referencedTable: 'qr_tokens' })
    .limit(1)
    .maybeSingle()) as { data: SessionRow | null; error: { message: string } | null };
  if (sessionRes.error) { tripCooldown('activeSession'); return { ok: false }; }
  const session = sessionRes.data;
  if (!session) return { ok: true, value: null };
  const token = session.qr_tokens[0];
  const cls = session.class || {};
  return {
    ok: true,
    value: {
      id: session.id,
      classId: session.class_id,
      courseCode: cls.course_code || '',
      className: cls.class_name || '',
      room: cls.room || '',
      facultyId: session.faculty_id,
      facultyName: faculty.name,
      date: session.date,
      startTime: session.start_time,
      endTime: session.end_time,
      status: session.status,
      currentToken: token?.token || '',
      tokenExpiresAt: token ? new Date(token.expires_at).getTime() : 0,
      tokenRotationCount: session.token_rotation_count,
      createdAt: session.created_at,
      closedAt: session.closed_at,
      finalizedAt: session.finalized_at || null,
    },
  };
}
