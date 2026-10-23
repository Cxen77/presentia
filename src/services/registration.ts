import { supabase } from './supabase';

export async function registerStudent(email: string, password: string) {
  const address = email.trim();
  const { data, error } = await supabase.auth.signUp({ email: address, password });
  if (error) throw error;
  if (!data.user) throw new Error('Registration did not return a user. Please try again.');
  if (data.user.identities?.length === 0) {
    return { status: 'existing_account' as const, email: address };
  }
  return { status: data.session ? 'verified' as const : 'confirmation_required' as const, email: address };
}

export async function verifySignupCode(email: string, code: string) {
  const token = code.trim();
  if (!/^\d{6,10}$/.test(token)) throw new Error('Enter the numeric verification code from your email.');
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
  if (error) throw error;
  if (!data.session || !data.user?.email_confirmed_at) {
    throw new Error('Supabase did not return a verified session. Request a new code and try again.');
  }
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  if (error) throw error;
}
