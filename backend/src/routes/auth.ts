import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { z } from 'zod';
import { env } from '../config/env';

const router = Router();
const attempts = new Map<string, { count: number; until: number }>();
router.post('/staff-sign-in', async (req, res) => {
  try {
    const parsed = z
      .object({
        identifier: z.string().trim().min(2).max(254),
        password: z.string().min(1).max(256),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Enter a valid staff ID or email and password.' });
    const identifier = parsed.data.identifier.toLowerCase(),
      now = Date.now();
    for (const [key, item] of attempts)
      if (item.until < now) attempts.delete(key);
    const previous = attempts.get(identifier);
    if (previous && previous.count >= 10)
      return res
        .status(429)
        .json({ error: 'Too many attempts. Wait 15 minutes before retrying.' });
    if (attempts.size >= 10000 && !previous)
      return res
        .status(429)
        .json({ error: 'Sign-in is busy. Please retry later.' });
    let email = identifier;
    if (!identifier.includes('@')) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('roll_number', identifier.toUpperCase())
        .in('role', ['faculty', 'admin'])
        .maybeSingle();
      email = data?.email || '';
    }
    if (!email) {
      attempts.set(identifier, {
        count: (previous?.count || 0) + 1,
        until: previous?.until || now + 900000,
      });
      return res
        .status(400)
        .json({ error: 'Invalid staff ID, email, or password.' });
    }
    const response = await fetch(
      env.SUPABASE_URL + '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: parsed.data.password }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const session = await response.json();
    if (!response.ok) {
      attempts.set(identifier, {
        count: (previous?.count || 0) + 1,
        until: previous?.until || now + 900000,
      });
      return res
        .status(400)
        .json({
          error:
            session.error_code === 'email_not_confirmed'
              ? 'Confirm your email before signing in. Use your email address in Verify email.'
              : 'Invalid staff ID, email, or password.',
        });
    }
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
    if (!profile || !['faculty', 'admin'].includes(profile.role))
      return res
        .status(403)
        .json({ error: 'This account does not have portal access.' });
    attempts.delete(identifier);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch {
    return res
      .status(503)
      .json({ error: 'Sign-in is temporarily unavailable. Please retry.' });
  }
});
router.post('/initial-password', requireAuth, async (req, res) => {
  const user = req.user!;
  if (!user.requiresPasswordChange || !['faculty', 'admin'].includes(user.role))
    return res
      .status(400)
      .json({
        error: 'An initial password change is not required for this account.',
      });
  const parsed = z
    .object({
      password: z
        .string()
        .min(12)
        .max(128)
        .regex(/[A-Za-z]/)
        .regex(/\d/),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({
        error: 'Use at least 12 characters, including letters and numbers.',
      });
  const { data: auth } = await supabaseAdmin.auth.admin.getUserById(
    user.authUserId,
  );
  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    user.authUserId,
    {
      password: parsed.data.password,
      app_metadata: { ...auth.user?.app_metadata, must_change_password: false },
    },
  );
  if (error)
    return res
      .status(400)
      .json({
        error:
          'Could not update your password. Choose a different strong password.',
      });
  return res.json({ success: true });
});

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
    requiresPasswordChange: user.requiresPasswordChange,
    createdAt: profile.created_at,
  });
});

export default router;
