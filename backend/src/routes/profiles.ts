import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';

const router = Router();

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100),
  rollNumber: z.string().min(2).max(30),
  department: z.string().min(2).max(100),
  semester: z.string().min(2).max(50),
  avatarUrl: z.string().url().nullable().optional(),
});

/**
 * GET /api/profiles/me
 * Returns the authenticated user's student profile.
 */
router.get('/me', requireAuth, async (req, res) => {
  const user = req.user!;

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', user.authUserId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error fetching profile');
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }

  if (!profile) {
    return res.json({ profileComplete: false });
  }

  return res.json({
    id: profile.id,
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    firstName: profile.first_name,
    rollNumber: profile.roll_number,
    degree: profile.degree,
    semester: profile.semester,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    profileComplete: true,
  });
});

/**
 * PUT /api/profiles/me
 * Creates or updates the authenticated user's profile.
 * The user_id is always derived from the authenticated token — never from the request body.
 */
router.put('/me', requireAuth, async (req, res) => {
  const user = req.user!;

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid profile data', details: parsed.error.flatten().fieldErrors });
  }

  const { fullName, rollNumber, department, semester, avatarUrl } = parsed.data;
  const firstName = fullName.trim().split(' ')[0];

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.authUserId)
    .maybeSingle();

  const profileData = {
    user_id: user.authUserId,
    email: user.email,
    full_name: fullName.trim(),
    first_name: firstName,
    roll_number: rollNumber.trim().toUpperCase(),
    degree: department.trim(),
    semester: semester.trim(),
    avatar_url: avatarUrl || null,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    // Update — preserve existing role (never let client set their own role)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(profileData)
      .eq('id', existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    // Insert — default role is 'student'
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({ ...profileData, role: 'student' })
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) {
    logger.error({ err: result.error }, 'Profile upsert failed');
    return res.status(500).json({ error: result.error.message });
  }

  const profile = result.data;
  return res.json({
    id: profile.id,
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    firstName: profile.first_name,
    rollNumber: profile.roll_number,
    degree: profile.degree,
    semester: profile.semester,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    profileComplete: true,
  });
});

export default router;
