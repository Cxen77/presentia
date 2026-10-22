import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

const createClassSchema = z.object({
  courseCode: z.string().min(2).max(20),
  className: z.string().min(2).max(100),
  department: z.string().min(2).max(100),
  semester: z.string().min(2).max(50),
  room: z.string().min(1).max(100),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  classType: z.enum(['Theory', 'Practical', 'Seminar']),
  credits: z.number().int().min(1).max(10),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/classes
 * Faculty: returns classes owned by this faculty member.
 * Admin: returns all classes.
 */
router.get('/', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;

  let query = supabaseAdmin
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });

  // Faculty see only their own classes; admin sees all
  if (user.role === 'faculty') {
    query = query.eq('faculty_id', user.profileId);
  }

  const { data, error } = await query;
  if (error) {
    logger.error({ err: error }, 'Error fetching classes');
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }

  // Enrich with enrolled student count
  const enriched = await Promise.all(
    (data || []).map(async (cls) => {
      const { count } = await supabaseAdmin
        .from('class_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id)
        .eq('status', 'active');

      return {
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
        facultyName: cls.teacher_name || user.fullName,
        description: cls.description || '',
        enrolledStudentsCount: count || 0,
        isActive: cls.is_active ?? true,
        createdAt: cls.created_at,
      };
    })
  );

  return res.json(enriched);
});

/**
 * GET /api/classes/:id
 * Returns a single class detail. Faculty must own the class.
 */
router.get('/:id', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  const { data: cls, error } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !cls) {
    return res.status(404).json({ error: 'Class not found' });
  }

  if (user.role === 'faculty' && cls.faculty_id !== user.profileId) {
    return res.status(403).json({ error: 'You do not manage this class' });
  }

  return res.json({
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
    facultyName: cls.teacher_name || '',
    description: cls.description || '',
    isActive: cls.is_active ?? true,
    createdAt: cls.created_at,
  });
});

/**
 * POST /api/classes
 * Faculty creates a new class. Generates a unique enrollment code.
 */
router.post('/', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid class data', details: parsed.error.flatten().fieldErrors });
  }

  const d = parsed.data;
  const randomSuffix = crypto.randomInt(1000, 9999);
  const cleanPrefix = d.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const enrollmentCode = `${cleanPrefix}-${randomSuffix}`;

  const { data: cls, error } = await supabaseAdmin
    .from('classes')
    .insert({
      course_code: d.courseCode.toUpperCase(),
      class_name: d.className,
      department: d.department,
      enrollment_code: enrollmentCode,
      teacher_name: user.fullName,
      schedule_info: `${d.startTime} - ${d.endTime}`,
      room: d.room,
      class_type: d.classType,
      credits: d.credits,
      is_active: true,
      faculty_id: user.profileId,
      description: d.description || null,
      semester: d.semester,
      start_time: d.startTime,
      end_time: d.endTime,
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Create class failed');
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({
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
    facultyName: cls.teacher_name,
    description: cls.description || '',
    enrolledStudentsCount: 0,
    isActive: true,
    createdAt: cls.created_at,
  });
});

/**
 * GET /api/classes/:id/students
 * Returns enrolled students for a class. Faculty must own the class.
 */
router.get('/:id/students', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  // Verify class ownership
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, faculty_id')
    .eq('id', id)
    .single();

  if (!cls) {
    return res.status(404).json({ error: 'Class not found' });
  }

  if (user.role === 'faculty' && cls.faculty_id !== user.profileId) {
    return res.status(403).json({ error: 'You do not manage this class' });
  }

  const { data: enrollments, error } = await supabaseAdmin
    .from('class_enrollments')
    .select(`
      id,
      enrolled_at,
      status,
      student:student_id (
        id,
        full_name,
        first_name,
        roll_number,
        email,
        degree,
        semester,
        avatar_url
      )
    `)
    .eq('class_id', id)
    .eq('status', 'active');

  if (error) {
    logger.error({ err: error }, 'Error fetching enrolled students');
    return res.status(500).json({ error: 'Failed to fetch students' });
  }

  const students = (enrollments || [])
    .filter((e: any) => e.student)
    .map((e: any) => ({
      id: e.student.id,
      fullName: e.student.full_name,
      rollNumber: e.student.roll_number,
      email: e.student.email,
      degree: e.student.degree,
      semester: e.student.semester,
      avatarUrl: e.student.avatar_url,
      enrolledAt: e.enrolled_at,
    }));

  return res.json(students);
});

/**
 * POST /api/classes/:id/regenerate-code
 * Regenerates the enrollment code for a class. Faculty must own the class.
 */
router.post('/:id/regenerate-code', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, course_code, faculty_id')
    .eq('id', id)
    .single();

  if (!cls) {
    return res.status(404).json({ error: 'Class not found' });
  }

  if (user.role === 'faculty' && cls.faculty_id !== user.profileId) {
    return res.status(403).json({ error: 'You do not manage this class' });
  }

  const randomSuffix = crypto.randomInt(1000, 9999);
  const cleanPrefix = cls.course_code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const newCode = `${cleanPrefix}-${randomSuffix}`;

  const { error } = await supabaseAdmin
    .from('classes')
    .update({ enrollment_code: newCode })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ enrollmentCode: newCode });
});

export default router;
