import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';

const router = Router();
const missingSchemaMessage =
  'Supabase database tables are missing. Run supabase/full_setup.sql or migration_000_core_schema.sql and migration_001_attendance.sql, then try again.';

const joinClassSchema = z.object({
  enrollmentCode: z.string().min(1).max(30),
});

const isMissingSchema = (error: { code?: string }): boolean => error.code === 'PGRST205';

/**
 * GET /api/enrollment/my-classes
 * Returns classes the authenticated student is enrolled in.
 */
router.get('/my-classes', requireAuth, async (req, res) => {
  const user = req.user!;

  if (!user.profileId) {
    return res.status(400).json({ error: 'Complete your student profile before viewing enrolled classes.' });
  }

  const { data, error } = await supabaseAdmin
    .from('class_enrollments')
    .select(`
      id,
      status,
      enrolled_at,
      class:class_id (
        id,
        course_code,
        class_name,
        department,
        enrollment_code,
        teacher_name,
        schedule_info,
        room,
        class_type,
        credits,
        is_active
      )
    `)
    .eq('student_id', user.profileId)
    .eq('status', 'active');

  if (error) {
    logger.error({ err: error }, 'Error fetching enrolled classes');
    if (isMissingSchema(error)) {
      return res.status(503).json({ error: missingSchemaMessage });
    }
    return res.status(500).json({ error: 'Failed to fetch enrolled classes' });
  }

  const classes = (data || [])
    .filter((item: any) => item.class)
    .map((item: any) => {
      const cls = item.class;
      return {
        id: cls.id,
        enrollmentId: item.id,
        subject: cls.class_name,
        courseCode: cls.course_code,
        classType: cls.class_type || 'Theory',
        timeSlot: cls.schedule_info || '',
        room: cls.room || '',
        teacherName: cls.teacher_name,
        department: cls.department,
        enrollmentCode: cls.enrollment_code,
        credits: cls.credits || 4,
      };
    });

  return res.json(classes);
});

/**
 * POST /api/enrollment/join
 * Student joins a class by enrollment code. Validates:
 * - Code exists and class is active
 * - Student is not already enrolled
 * - User is the authenticated student (never from request body)
 */
router.post('/join', requireAuth, requireRole('student'), async (req, res) => {
  const user = req.user!;

  if (!user.profileId) {
    return res.status(400).json({ error: 'Please complete your profile before joining a class.' });
  }

  const parsed = joinClassSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please provide a valid enrollment code.' });
  }

  const code = parsed.data.enrollmentCode.trim().toUpperCase();

  // Find the class
  const { data: enrollmentMatch, error: classError } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('enrollment_code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (classError) {
    if (isMissingSchema(classError)) {
      return res.status(503).json({ error: missingSchemaMessage });
    }
    return res.status(500).json({ error: 'Failed to look up class' });
  }

  let cls = enrollmentMatch;
  if (!cls) {
    const { data: courseMatches, error: courseError } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('course_code', code)
      .eq('is_active', true)
      .limit(2);

    if (courseError) {
      if (isMissingSchema(courseError)) {
        return res.status(503).json({ error: missingSchemaMessage });
      }
      return res.status(500).json({ error: 'Failed to look up class' });
    }
    if (courseMatches && courseMatches.length > 1) {
      return res.status(409).json({
        error: `Course code "${code}" matches multiple classes. Use the unique enrollment code shown in the faculty portal.`,
      });
    }
    cls = courseMatches?.[0] || null;
  }

  if (!cls) {
    const { data: inactiveEnrollmentMatch, error: inactiveEnrollmentError } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('enrollment_code', code)
      .eq('is_active', false)
      .maybeSingle();

    if (inactiveEnrollmentError) {
      if (isMissingSchema(inactiveEnrollmentError)) {
        return res.status(503).json({ error: missingSchemaMessage });
      }
      return res.status(500).json({ error: 'Failed to look up class' });
    }

    let inactiveClass = inactiveEnrollmentMatch;
    if (!inactiveClass) {
      const { data: inactiveCourseMatches, error: inactiveCourseError } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('course_code', code)
        .eq('is_active', false)
        .limit(1);

      if (inactiveCourseError) {
        if (isMissingSchema(inactiveCourseError)) {
          return res.status(503).json({ error: missingSchemaMessage });
        }
        return res.status(500).json({ error: 'Failed to look up class' });
      }
      inactiveClass = inactiveCourseMatches?.[0] || null;
    }

    if (inactiveClass) {
      return res.status(409).json({
        error: `The class for code "${code}" is inactive. Ask your instructor to reactivate it.`,
      });
    }
  }

  if (!cls) {
    return res.status(404).json({
      error: `No active class found with code "${code}". Please verify with your professor.`,
    });
  }

  const classResponse = {
    id: cls.id,
    courseCode: cls.course_code,
    className: cls.class_name,
    department: cls.department,
    enrollmentCode: cls.enrollment_code,
    teacherName: cls.teacher_name,
    scheduleInfo: cls.schedule_info,
    room: cls.room,
    classType: cls.class_type,
    credits: cls.credits,
    isActive: cls.is_active,
  };

  // Check for existing enrollment
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('class_enrollments')
    .select('id, status')
    .eq('student_id', user.profileId)
    .eq('class_id', cls.id)
    .maybeSingle();

  if (existingError) {
    return res.status(isMissingSchema(existingError) ? 503 : 500).json({
      error: isMissingSchema(existingError) ? missingSchemaMessage : 'Failed to check enrollment',
    });
  }

  if (existing) {
    if (existing.status === 'active') {
      return res.status(409).json({
        error: `You are already enrolled in ${cls.class_name} (${cls.course_code}).`,
      });
    }
    // Re-activate a previously dropped enrollment
    const { error: reactivateError } = await supabaseAdmin
      .from('class_enrollments')
      .update({ status: 'active' })
      .eq('id', existing.id);

    if (reactivateError) {
      return res.status(isMissingSchema(reactivateError) ? 503 : 500).json({
        error: isMissingSchema(reactivateError) ? missingSchemaMessage : 'Failed to reactivate enrollment',
      });
    }

    return res.json({
      message: `Re-enrolled in ${cls.class_name}`,
      classData: classResponse,
    });
  }

  // Create enrollment
  const { error: enrollError } = await supabaseAdmin
    .from('class_enrollments')
    .insert({
      student_id: user.profileId,
      class_id: cls.id,
      status: 'active',
    });

  if (enrollError) {
    if (enrollError.code === '23505') {
      return res.status(409).json({
        error: `You are already enrolled in ${cls.class_name} (${cls.course_code}).`,
      });
    }
    logger.error({ err: enrollError }, 'Enrollment insert failed');
    if (isMissingSchema(enrollError)) {
      return res.status(503).json({ error: missingSchemaMessage });
    }
    return res.status(500).json({ error: 'Failed to enroll in class' });
  }

  return res.status(201).json({
    message: `Successfully enrolled in ${cls.class_name}`,
    classData: classResponse,
  });
});

/**
 * DELETE /api/enrollment/:enrollmentId
 * Student leaves/drops a class. Only the authenticated student's own enrollment.
 */
router.delete('/:enrollmentId', requireAuth, requireRole('student'), async (req, res) => {
  const user = req.user!;
  const { enrollmentId } = req.params;

  // Verify this enrollment belongs to the authenticated student
  const { data: enrollment } = await supabaseAdmin
    .from('class_enrollments')
    .select('id, student_id')
    .eq('id', enrollmentId)
    .single();

  if (!enrollment) {
    return res.status(404).json({ error: 'Enrollment not found' });
  }

  if (enrollment.student_id !== user.profileId) {
    return res.status(403).json({ error: 'You can only leave your own enrollments' });
  }

  const { error } = await supabaseAdmin
    .from('class_enrollments')
    .delete()
    .eq('id', enrollmentId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ message: 'Successfully left the class' });
});

export default router;
