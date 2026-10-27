import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Generates a cryptographically secure QR token string.
 */
function generateQRToken(courseCode: string, sequence: number): string {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `ATT-${courseCode}-${sequence}-${randomHex}-${timestamp}`;
}

/**
 * Creates a new QR token record in the database.
 */
export async function createQRTokenRecord(sessionId: string, courseCode: string, sequence: number) {
  const ttl = parseInt(env.QR_TOKEN_TTL_SECONDS, 10) || 25;
  const token = generateQRToken(courseCode, sequence);
  const nonce = crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('qr_tokens')
    .insert({
      session_id: sessionId,
      token,
      nonce,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to create QR token');
    throw error;
  }

  return data;
}

/**
 * Mints the session's next QR token server-side. The portal normally rotates
 * from its own timer; this is the server-side fallback (used when a student
 * scans a just-expired code within the grace window).
 */
export async function rotateSessionToken(sessionId: string) {
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('token_rotation_count, classes:class_id(course_code)')
    .eq('id', sessionId)
    .single();

  if (!session) return null;
  const nextCount = (session.token_rotation_count || 0) + 1;
  const courseCode = (session as any).classes?.course_code || 'ATT';
  const tokenRecord = await createQRTokenRecord(sessionId, courseCode, nextCount);
  await supabaseAdmin
    .from('attendance_sessions')
    .update({ token_rotation_count: nextCount })
    .eq('id', sessionId);
  return { tokenRecord, nextCount };
}
