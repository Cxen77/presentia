import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';

const router = Router();

const submitSchema = z.object({
  qrToken: z.string().min(1),
  verificationPhotoUrl: z.string().url().optional(),
});

const verifySchema = z.object({
  status: z.enum(['PRESENT', 'REJECTED']),
  rejectionReason: z.string().max(200).optional(),
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
    return res.status(400).json({ error: 'Invalid submission data' });
  }

  const { qrToken, verificationPhotoUrl } = parsed.data;

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
  const tokenExpiry = new Date(tokenRecord.expires_at).getTime();
  if (Date.now() > tokenExpiry + 5000) {
    return res.status(400).json({ error: 'QR token has expired. Please scan the newly refreshed QR.' });
  }

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

  // 6. Create the attendance record with PENDING status
  const { data: record, error: insertError } = await supabaseAdmin
    .from('attendance_records')
    .insert({
      session_id: session.id,
      class_id: session.class_id,
      student_id: user.profileId,
      qr_token_id: tokenRecord.id,
      verification_photo_url: verificationPhotoUrl || null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (insertError) {
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
        class_id
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

  if (record.status !== 'PENDING') {
    return res.status(400).json({ error: `Record is already ${record.status}` });
  }

  // Update the record
  const { data: updated, error } = await supabaseAdmin
    .from('attendance_records')
    .update({
      status,
      verified_by: user.profileId,
      verified_at: new Date().toISOString(),
      rejection_reason: status === 'REJECTED' ? (rejectionReason || 'Visual photo mismatch') : null,
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
    verifiedBy: updated.verified_by,
    verifiedAt: updated.verified_at,
    rejectionReason: updated.rejection_reason,
  });
});

/**
 * GET /api/attendance/my-records
 * Student views their own attendance history.
 */
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
      status: r.status,
      submittedAt: r.submitted_at,
      className: r.session?.class?.class_name || '',
      courseCode: r.session?.class?.course_code || '',
      date: r.session?.date || '',
    }))
  );
});

export default router;
