import crypto from 'crypto';
import { env } from '../config/env';
import type { CheckInLocation } from './geofence';
const secret = crypto.createHmac('sha256', env.CLOUDINARY_API_SECRET).update('presentia:attendance-scan:v1').digest();
export function createScanTicket(userId: string, tokenId: string, sessionId: string, now = Date.now(), location?:CheckInLocation|null, installationId?:string) {
  const expiresAt = now + 3 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, tokenId, sessionId, expiresAt, location, installationId })).toString('base64url');
  return { ticket: payload + '.' + crypto.createHmac('sha256', secret).update(payload).digest('base64url'), expiresAt };
}
export function verifyScanTicket(ticket: string, userId: string, tokenId: string, sessionId: string, now = Date.now()) {
  return !!readScanTicket(ticket,userId,tokenId,sessionId,now);
}
export function readScanTicket(ticket: string, userId: string, tokenId: string, sessionId: string, now = Date.now()):{location?:CheckInLocation|null;expiresAt:number;installationId?:string}|null {
  try {
    const [payload, signature, extra] = ticket.split('.');
    if (!payload || !signature || extra) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.userId === userId && data.tokenId === tokenId && data.sessionId === sessionId && Number.isFinite(data.expiresAt) && data.expiresAt > now ? data : null;
  } catch { return null; }
}
