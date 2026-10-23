import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { env } from '../config/env';
const router = Router();
router.use(requireAuth, requireRole('faculty', 'admin'));
const facultyFields = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    department: z.string().trim().min(2).max(100),
  })
  .strict();
const studentFields = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    rollNumber: z.string().trim().min(2).max(30),
    department: z.string().trim().min(2).max(100),
    semester: z.string().trim().min(1).max(50),
  })
  .strict();
const password = () => `P!${crypto.randomBytes(20).toString('base64url')}7a`;
const projectProfile = (p: any) => ({
  id: p.id,
  userId: p.user_id,
  name: p.full_name,
  email: p.email,
  loginId: p.roll_number,
  department: p.degree,
  semester: p.semester,
  role: p.role,
  avatarUrl: p.avatar_url,
  createdAt: p.created_at,
});
async function confirmation(email: string) {
  try {
    const response = await fetch(env.SUPABASE_URL + '/auth/v1/resend', {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'signup', email }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

router.get('/people', requireRole('admin'), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return res.status(500).json({ error: 'Could not load accounts.' });
  return res.json((data || []).map(projectProfile));
});
router.get('/students', async (req, res) => {
  if (req.user!.role === 'admin') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name');
    if (error)
      return res.status(500).json({ error: 'Could not load students.' });
    return res.json((data || []).map(projectProfile));
  }
  const { data, error } = await supabaseAdmin
    .from('class_enrollments')
    .select('student:student_id(*),class:class_id!inner(faculty_id)')
    .eq('class.faculty_id', req.user!.profileId)
    .eq('status', 'active');
  if (error)
    return res.status(500).json({ error: 'Could not load your students.' });
  const people = new Map<string, any>();
  for (const row of data || []) {
    const student: any = row.student;
    if (student?.role === 'student')
      people.set(student.id, projectProfile(student));
  }
  return res.json([...people.values()]);
});
router.put('/me', async (req, res) => {
  const parsed = facultyFields.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: 'Enter a valid name and department.' });
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      first_name: parsed.data.fullName.split(' ')[0],
      degree: parsed.data.department,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.user!.profileId);
  if (error)
    return res.status(500).json({ error: 'Could not save your details.' });
  return res.json({ success: true });
});
router.put('/students/:id', async (req, res) => {
  const parsed = studentFields.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({
        error:
          'Enter valid student details. Role and email cannot be changed here.',
      });
  if (req.user!.role !== 'admin') {
    const { data } = await supabaseAdmin
      .from('class_enrollments')
      .select('id,class:class_id!inner(faculty_id)')
      .eq('student_id', req.params.id)
      .eq('class.faculty_id', req.user!.profileId)
      .eq('status', 'active')
      .limit(1);
    if (!data?.length)
      return res
        .status(403)
        .json({
          error: 'You can only edit students enrolled in your classes.',
        });
  }
  const d = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: d.fullName,
      first_name: d.fullName.split(' ')[0],
      roll_number: d.rollNumber.toUpperCase(),
      degree: d.department,
      semester: d.semester,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('role', 'student')
    .select('id')
    .maybeSingle();
  if (error)
    return res
      .status(error.code === '23505' ? 409 : 500)
      .json({
        error:
          error.code === '23505'
            ? 'This USN is already assigned to another account.'
            : 'Could not save student details.',
      });
  if (!data) return res.status(404).json({ error: 'Student not found.' });
  return res.json({ success: true });
});
router.post('/faculty', requireRole('admin'), async (req, res) => {
  const parsed = facultyFields
    .extend({ email: z.string().email().max(254) })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({
        error: 'Enter a faculty name, department, and real email address.',
      });
  const d = parsed.data,
    temporaryPassword = password(),
    loginId = 'FAC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: d.email.trim().toLowerCase(),
    password: temporaryPassword,
    email_confirm: false,
    app_metadata: { must_change_password: true },
    user_metadata: { full_name: d.fullName },
  });
  if (error || !data.user)
    return res
      .status(409)
      .json({
        error:
          'Could not create this account. Its email may already be registered.',
      });
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        user_id: data.user.id,
        email: d.email.trim().toLowerCase(),
        full_name: d.fullName,
        first_name: d.fullName.split(' ')[0],
        roll_number: loginId,
        degree: d.department,
        semester: 'Faculty',
        role: 'faculty',
      },
      { onConflict: 'user_id' },
    );
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return res
      .status(500)
      .json({
        error: 'Faculty profile could not be created. No new account was kept.',
      });
  }
  const confirmationSent = await confirmation(d.email);
  res.setHeader('Cache-Control', 'no-store');
  return res
    .status(201)
    .json({
      email: d.email,
      loginId,
      temporaryPassword,
      confirmationSent,
      requiresPasswordChange: true,
    });
});
router.put('/faculty/:id', requireRole('admin'), async (req, res) => {
  const parsed = facultyFields.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Enter valid faculty details.' });
  const d = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: d.fullName,
      first_name: d.fullName.split(' ')[0],
      degree: d.department,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('role', 'faculty')
    .select('id')
    .maybeSingle();
  if (error)
    return res.status(500).json({ error: 'Could not save faculty details.' });
  if (!data) return res.status(404).json({ error: 'Faculty not found.' });
  return res.json({ success: true });
});
router.post(
  '/faculty/:id/reset-password',
  requireRole('admin'),
  async (req, res) => {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('user_id,email,roll_number')
      .eq('id', req.params.id)
      .eq('role', 'faculty')
      .single();
    if (!p) return res.status(404).json({ error: 'Faculty not found.' });
    const temporaryPassword = password();
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(
      p.user_id,
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(p.user_id, {
      password: temporaryPassword,
      app_metadata: { ...auth.user?.app_metadata, must_change_password: true },
    });
    if (error)
      return res.status(500).json({ error: 'Could not reset credentials.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      email: p.email,
      loginId: p.roll_number,
      temporaryPassword,
      requiresPasswordChange: true,
    });
  },
);
export default router;
