import { Router } from 'express';
import {compareRoster} from '../services/roster';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { attendancePhotoDeliveryUrl } from '../services/cloudinary';

const router = Router();

const startSessionSchema = z.object({
  classId: z.string().uuid(),
});

router.get('/', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const query = supabaseAdmin.from('attendance_sessions').select('*, class:class_id(course_code,class_name,room), faculty:faculty_id(full_name)').order('created_at', { ascending: false }).limit(200);
  if (user.role !== 'admin') query.eq('faculty_id', user.profileId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Could not load attendance sessions.' });
  return res.json((data || []).map((s: any) => ({ id:s.id, classId:s.class_id, facultyId:s.faculty_id, facultyName:s.faculty?.full_name || '', courseCode:s.class?.course_code || '', className:s.class?.class_name || '', room:s.class?.room || '', date:s.date, startTime:s.start_time || '', endTime:s.end_time || '', status:s.status, currentToken:'', tokenExpiresAt:0, tokenRotationCount:s.token_rotation_count, createdAt:s.created_at, closedAt:s.closed_at })));
});

/**
 * Generates a cryptographically secure QR token string.
 */
function generateQRToken(courseCode: string, sequence: number): string {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `ATT-${courseCode}-${sequence}-${randomHex}-${timestamp}`;
}

/**
 * Creates a new QR token record in the database.
 */
async function createQRTokenRecord(sessionId: string, courseCode: string, sequence: number) {
  const ttl = parseInt(env.QR_TOKEN_TTL_SECONDS, 10) || 25;
  const token = generateQRToken(courseCode, sequence);
  const nonce = crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('qr_tokens')
    .insert({
      session_id: sessionId,
      token,
      nonce,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to create QR token');
    throw error;
  }

  return data;
}

/**
 * POST /api/sessions
 * Faculty starts a new attendance session for a class they manage.
 * Closes any prior active session for the same faculty.
 */
router.post('/', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const parsed = startSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'classId is required' });
  }

  const { classId } = parsed.data;

  // Verify faculty owns this class
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, course_code, class_name, room, faculty_id, start_time, end_time')
    .eq('id', classId)
    .single();

  if (!cls) {
    return res.status(404).json({ error: 'Class not found' });
  }

  if (user.role === 'faculty' && cls.faculty_id !== user.profileId) {
    return res.status(403).json({ error: 'You do not manage this class' });
  }

  // Close any existing active sessions for this faculty
  await supabaseAdmin
    .from('attendance_sessions')
    .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
    .eq('faculty_id', user.profileId)
    .eq('status', 'ACTIVE');

  // Create the new session
  const { data: session, error: sessError } = await supabaseAdmin
    .from('attendance_sessions')
    .insert({
      class_id: classId,
      faculty_id: user.profileId,
      date: new Date().toISOString().split('T')[0],
      start_time: cls.start_time,
      end_time: cls.end_time,
      status: 'ACTIVE',
      token_rotation_count: 1,
    })
    .select()
    .single();

  if (sessError) {
    logger.error({ err: sessError }, 'Failed to create session');
    return res.status(500).json({ error: 'Failed to start session' });
  }

  // Generate the first QR token
  const tokenRecord = await createQRTokenRecord(session.id, cls.course_code, 1);

  return res.status(201).json({
    id: session.id,
    classId: cls.id,
    courseCode: cls.course_code,
    className: cls.class_name,
    room: cls.room || '',
    facultyId: session.faculty_id,
    facultyName: user.fullName,
    date: session.date,
    startTime: session.start_time,
    endTime: session.end_time,
    status: session.status,
    currentToken: tokenRecord.token,
    tokenExpiresAt: new Date(tokenRecord.expires_at).getTime(),
    tokenRotationCount: session.token_rotation_count,
    createdAt: session.created_at,
  });
});

/**
 * GET /api/sessions/active
 * Returns the current active session for the authenticated faculty.
 */
router.get('/active', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;

  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('faculty_id', user.profileId)
    .in('status', ['ACTIVE', 'AWAITING_VERIFICATION'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return res.json(null);
  }

  // Get class info
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('course_code, class_name, room')
    .eq('id', session.class_id)
    .single();

  // Get current (latest) active token
  const { data: latestToken } = await supabaseAdmin
    .from('qr_tokens')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return res.json({
    id: session.id,
    classId: session.class_id,
    courseCode: cls?.course_code || '',
    className: cls?.class_name || '',
    room: cls?.room || '',
    facultyId: session.faculty_id,
    facultyName: user.fullName,
    date: session.date,
    startTime: session.start_time,
    endTime: session.end_time,
    status: session.status,
    currentToken: latestToken?.token || '',
    tokenExpiresAt: latestToken ? new Date(latestToken.expires_at).getTime() : 0,
    tokenRotationCount: session.token_rotation_count,
    createdAt: session.created_at,
    closedAt: session.closed_at,
  });
});

/**
 * POST /api/sessions/:id/rotate-token
 * Rotates the QR token for an active session. Faculty must own the session.
 */
router.post('/:id/rotate-token', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*, classes:class_id(course_code)')
    .eq('id', id)
    .single();

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.faculty_id !== user.profileId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized for this session' });
  }
  if (session.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Session is not active' });
  }

  const nextCount = session.token_rotation_count + 1;
  const courseCode = (session as any).classes?.course_code || 'ATT';
  const tokenRecord = await createQRTokenRecord(id, courseCode, nextCount);

  // Update session rotation count
  await supabaseAdmin
    .from('attendance_sessions')
    .update({ token_rotation_count: nextCount })
    .eq('id', id);

  return res.json({
    currentToken: tokenRecord.token,
    tokenExpiresAt: new Date(tokenRecord.expires_at).getTime(),
    tokenRotationCount: nextCount,
  });
});

/**
 * PUT /api/sessions/:id/end
 * Ends an active session. If pending records exist, moves to AWAITING_VERIFICATION.
 */
router.put('/:id/end', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.faculty_id !== user.profileId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized for this session' });
  }

  // Check for pending records
  const { count: pendingCount } = await supabaseAdmin
    .from('attendance_records')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', id)
    .eq('status', 'PENDING');

  const newStatus = (pendingCount || 0) > 0 ? 'AWAITING_VERIFICATION' : 'CLOSED';

  const { data: updated, error } = await supabaseAdmin
    .from('attendance_sessions')
    .update({
      status: newStatus,
      closed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    id: updated.id,
    status: updated.status,
    closedAt: updated.closed_at,
  });
});

/**
 * PUT /api/sessions/:id/finalize
 * Finalizes a session — marks all remaining PENDING records as REJECTED and
 * sets status to CLOSED. Only after this can the Excel report be generated.
 */
router.put('/:id/finalize', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.faculty_id !== user.profileId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized for this session' });
  }

  // Reject remaining PENDING submissions
  await supabaseAdmin
    .from('attendance_records')
    .update({
      status: 'REJECTED',
      rejection_reason: 'Session finalized — unverified submission',
      verified_by: user.profileId,
      verified_at: new Date().toISOString(),
    })
    .eq('session_id', id)
    .eq('status', 'PENDING');

  // Close the session
  const { data: updated, error } = await supabaseAdmin
    .from('attendance_sessions')
    .update({
      status: 'CLOSED',
      closed_at: session.closed_at || new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    id: updated.id,
    status: updated.status,
    closedAt: updated.closed_at,
  });
});

/**
 * GET /api/sessions/:id/records
 * Returns all attendance records for a session.
 */
router.get('/:id/records', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  // Verify faculty owns the session
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('faculty_id')
    .eq('id', id)
    .single();

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.faculty_id !== user.profileId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized for this session' });
  }

  const { data: records, error } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      *,
      student:student_id (
        id,
        full_name,
        roll_number,
        class_roll_number,
        section,
        avatar_url,
        email,
        degree,
        semester
      )
    `)
    .eq('session_id', id)
    .order('submitted_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const formatted = (records || []).sort((a:any,b:any)=>compareRoster(a.student||{},b.student||{})).map((r: any) => ({
    id: r.id,
    sessionId: r.session_id,
    classId: r.class_id,
    studentId: r.student?.id || r.student_id,
    studentName: r.student?.full_name || '',
    studentRollNumber: r.student?.roll_number || '',
    studentClassRollNumber:r.student?.class_roll_number || '',
    studentSection:r.student?.section || '',
    studentAvatarUrl: r.student?.avatar_url || '',
    verificationPhotoUrl: attendancePhotoDeliveryUrl(r.verification_photo_url),
    submittedAt: r.submitted_at,
    status: r.status,
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at,
    rejectionReason: r.rejection_reason,
    checkinLocation:r.checkin_location || null,
  }));

  return res.json(formatted);
});

export default router;
