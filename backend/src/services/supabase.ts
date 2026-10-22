import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY for operations that genuinely require elevated privileges,
 * and always enforce authorization checks in application code before calling.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Creates a per-request Supabase client scoped to the user's access token.
 * This client respects RLS policies and acts as the authenticated user.
 */
export function createUserClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
