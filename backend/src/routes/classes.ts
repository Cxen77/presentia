import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { geofenceSchema } from '../services/geofence';

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
  facultyId:z.string().uuid().optional(),
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
        geofence:cls.geofence || {enabled:false},
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
    geofence:cls.geofence || {enabled:false},
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
  const ownerId=user.role==='admin'?d.facultyId:user.profileId;
  if(!ownerId)return res.status(400).json({error:'Assign this class to a faculty account.'});
  const {data:owner}=await supabaseAdmin.from('profiles').select('id,full_name,role').eq('id',ownerId).eq('role','faculty').maybeSingle();
  if(!owner)return res.status(400).json({error:'Choose a valid faculty account.'});
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
      teacher_name: owner.full_name,
      schedule_info: `${d.startTime} - ${d.endTime}`,
      room: d.room,
      class_type: d.classType,
      credits: d.credits,
      is_active: true,
      faculty_id: ownerId,
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

router.put('/:id',requireAuth,requireRole('faculty','admin'),async(req,res)=>{
  const user=req.user!,parsed=createClassSchema.extend({isActive:z.boolean().optional()}).partial().strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter valid class details.'});
  const {data:current}=await supabaseAdmin.from('classes').select('*').eq('id',req.params.id).single();if(!current)return res.status(404).json({error:'Class not found.'});
  if(user.role!=='admin'&&current.faculty_id!==user.profileId)return res.status(403).json({error:'You do not manage this class.'});
  const d=parsed.data;if(user.role!=='admin'&&d.facultyId&&d.facultyId!==user.profileId)return res.status(403).json({error:'Only the administrator can reassign faculty.'});
  const fields:Record<string,string>={courseCode:'course_code',className:'class_name',department:'department',semester:'semester',room:'room',startTime:'start_time',endTime:'end_time',classType:'class_type',credits:'credits',description:'description',isActive:'is_active'};
  const update:Record<string,unknown>={};for(const [key,column]of Object.entries(fields))if((d as any)[key]!==undefined)update[column]=(d as any)[key];
  if(d.facultyId){const {data:faculty}=await supabaseAdmin.from('profiles').select('full_name').eq('id',d.facultyId).eq('role','faculty').maybeSingle();if(!faculty)return res.status(400).json({error:'Choose a valid faculty account.'});update.faculty_id=d.facultyId;update.teacher_name=faculty.full_name;}
  const start=d.startTime||current.start_time,end=d.endTime||current.end_time;if(start&&end&&end<=start)return res.status(400).json({error:'End time must be later than start time.'});
  update.schedule_info=`${start||''} - ${end||''}`;
  const {error}=await supabaseAdmin.from('classes').update(update).eq('id',req.params.id);if(error)return res.status(500).json({error:'Could not save class details.'});return res.json({success:true});
});

router.put('/:id/geofence',requireAuth,requireRole('faculty','admin'),async(req,res)=>{
  const user=req.user!;
  const parsed=geofenceSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid campus centre and a radius between 25 and 5,000 metres.'});
  const {data:cls,error:lookupError}=await supabaseAdmin.from('classes').select('faculty_id').eq('id',req.params.id).single();
  if(lookupError||!cls)return res.status(404).json({error:'Class not found.'});
  if(user.role!=='admin'&&cls.faculty_id!==user.profileId)return res.status(403).json({error:'You do not manage this class.'});
  const {error}=await supabaseAdmin.from('classes').update({geofence:parsed.data}).eq('id',req.params.id);
  if(error)return res.status(500).json({error:'Could not save campus check-in rules.'});
  return res.json(parsed.data);
});
export default router;
