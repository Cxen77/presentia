import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  authUserId: string;    // Supabase auth.users.id
  profileId: string;     // profiles.id
  email: string;
  role: 'student' | 'faculty' | 'admin';
  fullName: string;
}

// Extend Express Request to carry authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Validates the Supabase access token from the Authorization header,
 * loads the user's profile and role, and attaches it to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  if (!token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    // Validate the token and get the authenticated user identity
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn({ error: error?.message }, 'Token validation failed');
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    // Load the user's application profile and role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      logger.error({ err: profileError }, 'Error loading user profile');
      if (profileError.code === 'PGRST205') {
        return res.status(503).json({
          error: 'Supabase profile table is missing. Run supabase/full_setup.sql or the ordered Supabase migrations.',
        });
      }
      return res.status(500).json({ error: 'Failed to load user profile' });
    }

    // User may be authenticated but not yet have a profile (first login)
    req.user = {
      authUserId: user.id,
      profileId: profile?.id || '',
      email: profile?.email || user.email || '',
      role: (profile?.role as 'student' | 'faculty' | 'admin') || 'student',
      fullName: profile?.full_name || '',
    };

    next();
  } catch (err) {
    logger.error({ err }, 'Auth middleware error');
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware factory: Requires the user to have one of the specified roles.
 */
export function requireRole(...roles: ('student' | 'faculty' | 'admin')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.authUserId, role: req.user.role, required: roles },
        'Authorization denied — insufficient role'
      );
      return res.status(403).json({ error: 'Insufficient permissions for this operation' });
    }
    next();
  };
}
