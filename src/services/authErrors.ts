export function authErrorMessage(error: unknown): string {
  const authError = error as { code?: string; message?: string; name?: string; status?: number } | null;
  const message = authError?.message || '';
  if (/error sending (confirmation|recovery|magic link|email)/i.test(message)) {
    return 'We could not send your verification email. Please try again later or contact support.';
  }
  if (authError?.code === 'otp_expired' || authError?.code === 'otp_disabled') {
    return 'This verification code is invalid or expired. Request a new code and use the latest email.';
  }
  if (authError?.code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Invalid email or password. Use your registered email and exact password, or create an account if you have not registered.';
  }
  if (authError?.code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Confirm your email using the code in your inbox before signing in. Open Create Account and choose Verify existing email to request a new code.';
  }
  if (/refresh_token|session_not_found|session_expired|bad_jwt/.test(authError?.code || '')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (authError?.code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'An account already exists for this email. Sign in with your existing password.';
  }
  if (authError?.status === 429) return 'Too many attempts. Please wait before trying again.';
  if (authError?.name === 'AuthRetryableFetchError' || /fetch|network|timeout/i.test(message)) {
    return 'Unable to reach Supabase. Check your internet connection and try again.';
  }
  return message || 'Authentication failed. Please try again.';
}

export const confirmationMessage = 'Check your inbox and spam folder for a confirmation link before signing in. If this email already has an account, sign in with its existing password. Supabase may hide duplicate accounts for privacy.';
