import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';
import { isCloudinaryConfigured, isOwnedAttendancePhoto } from '../services/cloudinary';
import { createScanTicket, readScanTicket } from '../services/scanTicket';
import { locationSchema, checkLocation, loadClassGeofence } from '../services/geofence';
import { installationSchema, registerDevice, ownsDevice, deviceMessage } from '../services/deviceBinding';
import { reviewDatabaseError } from '../services/batchReview';
import { rotateSessionToken } from '../services/qrTokens';

const router = Router();

const submitSchema = z.object({
  qrToken: z.string().min(1),
  verificationPhotoUrl: z.string().url().max(2048),
  verificationPhotoSignature: z.string().regex(/^[a-f0-9]{40}$/i),
  scanTicket: z.string().min(1).max(2048),
  location: locationSchema.nullable(),
  installationId:installationSchema,
});

const verifySchema = z.object({
  status: z.enum(['PRESENT', 'REJECTED']),
  rejectionReason: z.string().trim().min(5).max(500),
});

// Validate the rotating QR at scan time; the selfie must arrive within three minutes.
router.post('/scan', requireAuth, requireRole('student'), async (req, res) => {
  if (!isCloudinaryConfigured()) return res.status(503).json({error:'Photo uploads are not configured yet. Please contact your teacher.'});
  const user = req.user!;
  const parsed = z.object({ qrToken: z.string().min(1).max(512), location:locationSchema.nullable(), installationId:installationSchema, platform:z.enum(['android','ios','web']) }).safeParse(req.body);
  if (!parsed.success || !user.profileId) {
    const needsUpdate=user.profileId && typeof req.body?.installationId!=='string';
    return res.status(needsUpdate?426:400).json({error:needsUpdate?'Update required: install the latest Presentia APK with device registration, then scan the current QR again.':'Complete your profile and scan a valid attendance QR.'});
  }
  const { data: token, error } = await supabaseAdmin.from('qr_tokens').select('*, session:session_id(*)').eq('token', parsed.data.qrToken).maybeSingle();
  if (error) return res.status(500).json({ error: 'Could not validate the QR. Please retry.' });
  if (!token) return res.status(400).json({ error: 'QR expired. Scan the latest QR shown by your teacher.' });
  const session = token.session as any;
  if (session?.status !== 'ACTIVE') return res.status(400).json({ error: 'This attendance session is no longer accepting scans.' });
  // Enrollment and duplicate-submission checks are independent — run together.
  const [enrollmentRes, existingRes] = await Promise.all([
    supabaseAdmin.from('class_enrollments').select('id').eq('student_id', user.profileId).eq('class_id', session.class_id).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('attendance_records').select('id').eq('session_id', session.id).eq('student_id', user.profileId).maybeSingle(),
  ]);
  if (enrollmentRes.error || existingRes.error) return res.status(500).json({ error: 'Could not validate the QR. Please retry.' });
  if (!enrollmentRes.data) return res.status(403).json({ error: 'You are not enrolled in this class.' });
  if (existingRes.data) return res.status(409).json({ error: 'You have already submitted attendance for this session.' });
  let device;
  try {device=await registerDevice(parsed.data.installationId,user.profileId,parsed.data.platform);}
  catch {return res.status(503).json({error:'Device registration is unavailable. Retry shortly.'});}
  if(!device.allowed)return res.status(409).json({error:deviceMessage(device.code),code:device.code});
  try {
    const policy=await loadClassGeofence(supabaseAdmin,session.class_id);
    const check=checkLocation(parsed.data.location,policy);
    if(check.error){
      const logged=await supabaseAdmin.from('attendance_risk_attempts').insert({session_id:session.id,student_id:user.profileId,installation_id:parsed.data.installationId,location:parsed.data.location,reason:check.error});
      if(logged.error)return res.status(503).json({error:'Could not save location verification. Retry.'});
      return res.status(403).json({error:check.error});
    }
  }catch(error){return res.status(503).json({error:error instanceof Error?error.message:'Campus rules unavailable.'});}
  // The portal normally rotates the code from its own timer; if that tab is
  // throttled the latest code can lapse. Accept a just-expired scan (short
  // grace) and mint the next token server-side so following students scan a
  // live code. Scans older than the grace window still fail.
  const expiresAtMs = new Date(token.expires_at).getTime();
  const now = Date.now();
  if (now > expiresAtMs + 5000) {
    if (now > expiresAtMs + 15000) return res.status(400).json({ error: 'QR expired. Scan the latest QR shown by your teacher.' });
    await rotateSessionToken(session.id).catch(() => null);
  }
  const scan = createScanTicket(user.authUserId, token.id, session.id,Date.now(),parsed.data.location,parsed.data.installationId);
  return res.json({ scanTicket: scan.ticket, expiresAt: scan.expiresAt, sessionId: session.id });
});

/**
 * POST /api/attendance/submit
 * Student submits attendance by providing a scanned QR token.
 * Validates:
 *  - Token exists and is not expired
 *  - Session is active
 *  - Student is enrolled in the class
 *  - No duplicate submission
 * Sets initial status to PENDING (awaiting faculty verification).
 */
router.post('/submit', requireAuth, requireRole('student'), async (req, res) => {
  const user = req.user!;

  if (!user.profileId) {
    return res.status(400).json({ error: 'Please complete your profile first.' });
  }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    const needsUpdate=typeof req.body?.installationId!=='string';
    return res.status(needsUpdate?426:400).json({ error:needsUpdate?'Update required: install the latest Presentia APK with device registration, then scan the current QR again.':'Invalid submission data' });
  }

  const { qrToken, verificationPhotoUrl, verificationPhotoSignature, scanTicket, location, installationId } = parsed.data;
  if (!isOwnedAttendancePhoto(verificationPhotoUrl, user.authUserId, verificationPhotoSignature)) {
    return res.status(400).json({ error: 'Upload a fresh selfie to your account before submitting attendance.' });
  }

  // 1. Look up the QR token
  const { data: tokenRecord } = await supabaseAdmin
    .from('qr_tokens')
    .select('*, session:session_id(*)')
    .eq('token', qrToken)
    .maybeSingle();

  if (!tokenRecord) {
    return res.status(400).json({ error: 'Invalid or unrecognized QR token.' });
  }

  // 2. Check token expiry (with 5-second grace for clock skew)
  const scan = readScanTicket(scanTicket, user.authUserId, tokenRecord.id, tokenRecord.session_id);
  if (!scan || scan.installationId !== installationId) {
    return res.status(400).json({ error: 'Your selfie check-in expired. Close the camera and scan the latest QR again.' });
  }

  if (!await ownsDevice(installationId,user.profileId)) return res.status(409).json({error:deviceMessage('DEVICE_CONFLICT')});
  if(!isOwnedAttendancePhoto(verificationPhotoUrl,user.authUserId,verificationPhotoSignature,tokenRecord.session_id)) return res.status(400).json({error:'Upload a new selfie for this session.'});

  // 3. Check session status
  const session = tokenRecord.session as any;
  if (!session || session.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Attendance session is not active.' });
  }

  // 4. Verify student is enrolled in this class
  const { data: enrollment } = await supabaseAdmin
    .from('class_enrollments')
    .select('id')
    .eq('student_id', user.profileId)
    .eq('class_id', session.class_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!enrollment) {
    return res.status(403).json({ error: 'You are not enrolled in this class.' });
  }

  // 5. Check for duplicate submission
  const { data: existing } = await supabaseAdmin
    .from('attendance_records')
    .select('id')
    .eq('session_id', session.id)
    .eq('student_id', user.profileId)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Attendance already submitted for this session.' });
  }

  let locationEvidence;
  try {
    const policy=await loadClassGeofence(supabaseAdmin,session.class_id);
    const check=checkLocation(location,policy);
    if(check.error){
      const logged=await supabaseAdmin.from('attendance_risk_attempts').insert({session_id:session.id,student_id:user.profileId,installation_id:installationId,location,reason:check.error});
      if(logged.error)return res.status(503).json({error:'Could not save location verification. Retry.'});
      return res.status(403).json({error:check.error});
    }
    // Re-evaluate the signed scan fix against any updated boundary, preserving its age check at scan time.
    const scanCheck=checkLocation(scan.location ? {...scan.location,capturedAt:Date.now()} : null,policy);
    if(scanCheck.error)return res.status(403).json({error:'The campus boundary changed. Scan the latest QR again.'});
    locationEvidence={scan:scan.location,submission:location,receivedAt:Date.now(),campusRestricted:policy.enabled,distanceM:check.distanceM ?? null};
  }catch(error){return res.status(503).json({error:error instanceof Error?error.message:'Campus rules unavailable.'});}

  // 6. Create the attendance record with PENDING status
  const { data: record, error: insertError } = await supabaseAdmin
    .from('attendance_records')
    .insert({
      session_id: session.id,
      class_id: session.class_id,
      student_id: user.profileId,
      qr_token_id: tokenRecord.id,
      verification_photo_url: verificationPhotoUrl,
      status: 'PENDING',
      checkin_location:locationEvidence,
      installation_id:installationId,
    })
    .select()
    .single();

  if (insertError) {
    if(insertError.code==='42501')return res.status(409).json({error:'Device ownership or enrollment changed. Contact your administrator.'});
    if (insertError.code === '23514' && insertError.message.includes('ATTENDANCE_SESSION_CLOSED')) return res.status(409).json({error:'Check-in has closed. Your submission was not accepted.'});
    // Handle unique constraint violation (race condition)
    if (insertError.code === '23505') {
      return res.status(409).json({ error: 'Attendance already submitted for this session.' });
    }
    logger.error({ err: insertError }, 'Attendance submit insert failed');
    return res.status(500).json({ error: 'Failed to submit attendance' });
  }

  return res.status(201).json({
    message: 'Attendance submitted for verification!',
    record: {
      id: record.id,
      sessionId: record.session_id,
      classId: record.class_id,
      status: record.status,
      submittedAt: record.submitted_at,
    },
  });
});

/**
 * PUT /api/attendance/:id/verify
 * Faculty confirms or rejects a student's attendance submission.
 * Verifies that the faculty member manages the class this record belongs to.
 */
router.put('/:id/verify', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid verification data' });
  }

  const { status, rejectionReason } = parsed.data;

  // Load the record with session info to verify faculty ownership
  const { data: record } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      *,
      session:session_id (
        id,
        faculty_id,
        class_id,
        finalized_at
      )
    `)
    .eq('id', id)
    .single();

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  const session = record.session as any;
  if (session.faculty_id !== user.profileId && user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to verify this record' });
  }

  if (session.finalized_at) return res.status(409).json({error:'This session has been confirmed. Open the final report.'});

  const {data:updated,error}=await supabaseAdmin.rpc('review_audited_attendance',{p_record:id,p_actor:user.profileId,p_decision:status,p_reason:rejectionReason});
  if(error){const failure=reviewDatabaseError(error);return res.status(failure.status).json({error:failure.error});}

  return res.json({
    id: updated.id,
    status: updated.status,
    verifiedBy: updated.verified_by,
    verifiedAt: updated.verified_at,
    rejectionReason: updated.rejection_reason,
  });
});

/**
 * GET /api/attendance/my-records
 * Student views their own attendance history.
 */
router.get('/my-calendar/:classId',requireAuth,requireRole('student'),async(req,res)=>{
  const user=req.user!;
  const classId=z.string().uuid().safeParse(req.params.classId);
  const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(req.query.month);
  if(!classId.success||!month.success)return res.status(400).json({error:'Choose a valid class and calendar month.'});
  const {data:enrollment}=await supabaseAdmin.from('class_enrollments').select('enrolled_at').eq('student_id',user.profileId).eq('class_id',classId.data).eq('status','active').maybeSingle();
  if(!enrollment)return res.status(403).json({error:'You are not enrolled in this class.'});
  const [year,number]=month.data.split('-').map(Number);
  const nextMonth=new Date(Date.UTC(year,number,1)).toISOString().slice(0,10);
  const {data:sessions,error}=await supabaseAdmin.from('attendance_sessions').select('id,date,start_time,end_time,status').eq('class_id',classId.data).gte('date',month.data+'-01').lt('date',nextMonth).gte('created_at',enrollment.enrolled_at).order('created_at',{ascending:true});
  if(error)return res.status(500).json({error:'Could not load the attendance calendar.'});
  const ids=(sessions||[]).map(s=>s.id);
  const {data:records,error:recordError}=ids.length?await supabaseAdmin.from('attendance_records').select('session_id,status,rejection_reason,verified_at').eq('student_id',user.profileId).in('session_id',ids):{data:[],error:null};
  if(recordError)return res.status(500).json({error:'Could not load attendance decisions.'});
  return res.json((sessions||[]).map(session=>{const record=records?.find(r=>r.session_id===session.id);return {sessionId:session.id,date:session.date,startTime:session.start_time||'',endTime:session.end_time||'',status:record?.status==='PRESENT'?'PRESENT':record?.status==='PENDING'?'PENDING':record?.status==='REJECTED'?'ABSENT':session.status==='CLOSED'?'ABSENT':'OPEN',reason:record?.rejection_reason||null,verifiedAt:record?.verified_at||null};}));
});

router.get('/my-records', requireAuth, requireRole('student'), async (req, res) => {
  const user = req.user!;

  if (!user.profileId) {
    return res.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      *,
      session:session_id (
        id,
        date,
        status,
        class:class_id (
          id,
          class_name,
          course_code
        )
      )
    `)
    .eq('student_id', user.profileId)
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(
    (data || []).map((r: any) => ({
      id: r.id,
      classId: r.class_id,
      sessionId: r.session_id,
      status: r.status,
      submittedAt: r.submitted_at,
      className: r.session?.class?.class_name || '',
      courseCode: r.session?.class?.course_code || '',
      date: r.session?.date || '',
      verifiedAt: r.verified_at,
      rejectionReason: r.rejection_reason,
    }))
  );
});

export default router;
