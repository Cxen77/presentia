import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile and role.
 * If no profile exists yet (first login), returns partial data so the client
 * can route to profile setup.
 */
router.get('/me', requireAuth, async (req, res) => {
  const user = req.user!;

  if (!user.profileId) {
    // User is authenticated but hasn't created a profile yet
    return res.json({
      authUserId: user.authUserId,
      email: user.email,
      profileComplete: false,
      role: null,
    });
  }

  // Load full profile
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.profileId)
    .single();

  if (error || !profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  return res.json({
    authUserId: user.authUserId,
    profileId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    firstName: profile.first_name,
    rollNumber: profile.roll_number,
    degree: profile.degree,
    semester: profile.semester,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    profileComplete: true,
    createdAt: profile.created_at,
  });
});

export default router;
