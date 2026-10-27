import { Router } from 'express';
import {compareRoster} from '../services/roster';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { attendancePhotoDeliveryUrl, profilePhotoDeliveryUrl } from '../services/cloudinary';
import { batchReviewSchema, reviewDatabaseError } from '../services/batchReview';
import { cleanupFinalizedSelfies } from '../services/selfieCleanup';
import { wakeProxyAudit } from '../services/proxyAudit';
import { createQRTokenRecord, rotateSessionToken } from '../services/qrTokens';

const router = Router();

const startSessionSchema = z.object({
  classId: z.string().uuid(),
  collectionMinutes:z.number().int().min(1).max(180).optional(),
});

router.get('/', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const query = supabaseAdmin.from('attendance_sessions').select('*, class:class_id(course_code,class_name,room), faculty:faculty_id(full_name)').order('created_at', { ascending: false }).limit(200);
  if (user.role !== 'admin') query.eq('faculty_id', user.profileId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Could not load attendance sessions.' });
  return res.json((data || []).map((s: any) => ({ id:s.id, classId:s.class_id, facultyId:s.faculty_id, facultyName:s.faculty?.full_name || '', courseCode:s.class?.course_code || '', className:s.class?.class_name || '', room:s.class?.room || '', date:s.date, startTime:s.start_time || '', endTime:s.end_time || '', status:s.status, currentToken:'', tokenExpiresAt:0, tokenRotationCount:s.token_rotation_count, createdAt:s.created_at, closedAt:s.closed_at, finalizedAt:s.finalized_at || null })));
});

/**
 * Creates a new QR token record in the database.
 * (Implementation lives in services/qrTokens.ts, shared with the scan route.)
 */

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
    .update({ status: 'AWAITING_VERIFICATION', closed_at: new Date().toISOString() })
    .eq('faculty_id', user.profileId)
    .eq('status', 'ACTIVE');

  void wakeProxyAudit();

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
      submission_deadline:parsed.data.collectionMinutes ? new Date(Date.now()+parsed.data.collectionMinutes*60000).toISOString() : null,
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
    finalizedAt: session.finalized_at || null,
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

  const rotated = await rotateSessionToken(id);
  if (!rotated) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const { tokenRecord, nextCount } = rotated;

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

  const {data, error} = await supabaseAdmin.rpc('stop_attendance_for_review', {p_session_id:id, p_actor_id:user.profileId});
  if (error) {const failure = reviewDatabaseError(error); return res.status(failure.status).json({error:failure.error});}
  void wakeProxyAudit();
  return res.json(data);
});

/** Atomically accept all reviewed submissions except the teacher's exclusions. */
router.put('/:id/confirm-review', requireAuth, requireRole('faculty','admin'), async (req, res) => {
  const parsed = batchReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'Refresh the list and submit a complete class review.'});
  const {data, error} = await supabaseAdmin.rpc('confirm_attendance_review', {
    p_session_id:req.params.id, p_actor_id:req.user!.profileId, p_request_id:parsed.data.requestId,
    p_expected_records:parsed.data.expectedRecords, p_excluded_ids:parsed.data.excludedRecordIds,
  });
  if (error) {const failure = reviewDatabaseError(error); return res.status(failure.status).json({error:failure.error});}
  void cleanupFinalizedSelfies(req.params.id).catch(() => logger.warn({sessionId:req.params.id},'Selfie cleanup queued for retry'));
  return res.json({...data, selfieCleanup:'queued'});
});

router.get('/:id/audit',requireAuth,requireRole('faculty','admin'),async(req,res)=>{
  const {data:session,error}=await supabaseAdmin.from('attendance_sessions').select('faculty_id,audit_required,status').eq('id',req.params.id).maybeSingle();
  if(error)return res.status(503).json({error:'Could not load audit status.'});
  if(!session)return res.status(404).json({error:'Session not found.'});
  if(session.faculty_id!==req.user!.profileId&&req.user!.role!=='admin')return res.status(403).json({error:'Not authorized for this session.'});
  const {data:job,error:jobError}=await supabaseAdmin.from('attendance_audit_jobs').select('status,attempts,completed_at,last_error,retry_at').eq('session_id',req.params.id).maybeSingle();
  if(jobError)return res.status(503).json({error:'Could not load audit status.'});
  const {data:attempts,error:attemptError}=await supabaseAdmin.from('attendance_risk_attempts').select('student_id,reason,created_at,location,student:student_id(full_name,roll_number)').eq('session_id',req.params.id).order('created_at',{ascending:false}).limit(100);
  if(attemptError)return res.status(503).json({error:'Could not load rejected check-in signals.'});
  return res.json({required:session.audit_required,status:job?.status || (session.status==='ACTIVE'?'collecting':'not_required'),job,blockedAttempts:attempts});
});

router.get('/:id', requireAuth, requireRole('faculty','admin'), async (req, res) => {
  const {data:s,error} = await supabaseAdmin.from('attendance_sessions')
    .select('*,class:class_id(course_code,class_name,room),faculty:faculty_id(full_name)').eq('id',req.params.id).maybeSingle();
  if (error) return res.status(503).json({error:'Could not load this session.'});
  if (!s) return res.status(404).json({error:'Session not found.'});
  if (s.faculty_id !== req.user!.profileId && req.user!.role !== 'admin') return res.status(403).json({error:'Not authorized for this session.'});
  let cleanupPending = 0;
  if (s.finalized_at) {
    const {count,error:cleanupError} = await supabaseAdmin.from('attendance_records').select('id',{count:'exact',head:true})
      .eq('session_id',s.id).not('verification_photo_url','is',null);
    if (cleanupError) return res.status(503).json({error:'Could not check selfie cleanup.'});
    cleanupPending = count || 0;
  }
  let token: {token:string;expires_at:string} | null = null;
  if (s.status === 'ACTIVE') {
    const {data:latest} = await supabaseAdmin.from('qr_tokens').select('token,expires_at').eq('session_id',s.id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    token = latest;
  }
  return res.json({id:s.id,classId:s.class_id,facultyId:s.faculty_id,facultyName:s.faculty?.full_name || '',
    courseCode:s.class?.course_code || '',className:s.class?.class_name || '',room:s.class?.room || '',date:s.date,
    startTime:s.start_time || '',endTime:s.end_time || '',status:s.status,currentToken:token?.token || '',tokenExpiresAt:token ? new Date(token.expires_at).getTime() : 0,
    tokenRotationCount:s.token_rotation_count,createdAt:s.created_at,closedAt:s.closed_at,finalizedAt:s.finalized_at || null,selfieCleanupPending:cleanupPending});
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
    .select('faculty_id,finalized_at')
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
    studentAvatarUrl: profilePhotoDeliveryUrl(r.student?.avatar_url),
    verificationPhotoUrl: session.finalized_at ? '' : attendancePhotoDeliveryUrl(r.verification_photo_url),
    submittedAt: r.submitted_at,
    status: r.status,
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at,
    rejectionReason: r.rejection_reason,
    checkinLocation:r.checkin_location || null,
    auditFindings:r.audit_findings || null,
    deviceStatus:r.device_status_at_submission || 'unknown',
    riskReviewDecision:r.risk_review_decision || null,
    riskReviewReason:r.risk_review_reason || null,
  }));

  return res.json(formatted);
});

export default router;
