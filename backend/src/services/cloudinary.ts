import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });

export type UploadFolder = 'student_profiles' | 'attendance_verification';
export function isCloudinaryConfigured() {
  return [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET]
    .every(value => value && !/^(placeholder|your-)/i.test(value));
}

export function createUploadPayload(userId: string, folder: UploadFolder) {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${userId}/${crypto.randomUUID()}`;
  const type = folder === 'attendance_verification' ? 'authenticated' : 'upload';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder, public_id: publicId, type, overwrite: false }, env.CLOUDINARY_API_SECRET);
  return { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, timestamp, signature, folder, publicId, type, overwrite: false };
}

function parseAttendanceAsset(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.search || url.hash) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== env.CLOUDINARY_CLOUD_NAME || parts[1] !== 'image' || parts[2] !== 'authenticated' || !/^v\d+$/.test(parts[3] || '')) return null;
    const asset = parts.slice(4).join('/');
    const match = /^(attendance_verification\/[0-9a-f-]+\/[0-9a-f-]+)\.(jpg|jpeg|png|webp)$/i.exec(asset);
    if (!match) return null;
    return { publicId: match[1], format: match[2], version: Number(parts[3].slice(1)) };
  } catch { return null; }
}

/** Verify Cloudinary's upload receipt without fetching arbitrary user URLs. */
export function isOwnedAttendancePhoto(value: string, userId: string, receiptSignature: string) {
  if (!isCloudinaryConfigured()) return false;
  const asset = parseAttendanceAsset(value);
  if (!asset || !asset.publicId.startsWith(`attendance_verification/${userId}/`)) return false;
  const expected = cloudinary.utils.api_sign_request({ public_id: asset.publicId, version: asset.version }, env.CLOUDINARY_API_SECRET);
  if (!/^[a-f0-9]{40}$/i.test(receiptSignature) || receiptSignature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receiptSignature.toLowerCase()));
}

/** Call only after the route has authorized the faculty member for the session. */
export function attendancePhotoDeliveryUrl(value: string | null) {
  if (!value) return '';
  const asset = parseAttendanceAsset(value);
  if (!asset) return value.startsWith('https://') && !value.includes('/image/authenticated/') ? value : '';
  // Review cards render at ~130px; 480px covers the zoom dialog. Phone selfies are
  // multi-megabyte originals, so resizing at the CDN keeps sessions with dozens of
  // students from saturating the link.
  return cloudinary.url(asset.publicId, {
    resource_type: 'image', type: 'authenticated', version: asset.version, format: asset.format, secure: true, sign_url: true,
    transformation: [{ width: 480, height: 480, crop: 'limit' }, { quality: 'auto:good' }],
  });
}

/** Deletes only this project's authenticated attendance assets, never profile photos. */
export async function deleteAttendanceSelfie(value: string) {
  const asset = parseAttendanceAsset(value);
  if (!asset || !isCloudinaryConfigured()) throw new Error('Unsupported attendance asset');
  const response = await cloudinary.uploader.destroy(asset.publicId, {resource_type:'image', type:'authenticated', invalidate:true});
  if (response.result !== 'ok' && response.result !== 'not found') throw new Error('Selfie deletion failed');
}

/** Thumbnail variant of a stored public profile-photo URL for list rendering. */
export function profilePhotoDeliveryUrl(value: string | null | undefined, width = 300) {
  if (!value || !value.startsWith('https://res.cloudinary.com/') || !value.includes('/image/upload/')) return value || '';
  return value.replace('/image/upload/', `/image/upload/w_${width},q_auto:good/`);
}
