const { test } = require('node:test');
const assert = require('node:assert/strict');
Object.assign(process.env, {
  SUPABASE_URL: 'https://yurdfoblkaclivxqfpjt.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SECRET_KEY: 'sb_secret_test',
  CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret',
});
const { v2: cloudinary } = require('cloudinary');
const { createUploadPayload, isOwnedAttendancePhoto, attendancePhotoDeliveryUrl } = require('../dist/services/cloudinary');
const owner = '11111111-1111-4111-8111-111111111111';
const publicId = `attendance_verification/${owner}/22222222-2222-4222-8222-222222222222`;
const version = 1234567890;
const url = `https://res.cloudinary.com/test-cloud/image/authenticated/v${version}/${publicId}.jpg`;
const receipt = cloudinary.utils.api_sign_request({ public_id: publicId, version }, 'test-secret');

test('selfie signatures use private assets, server-generated ownership and no overwrite', () => {
  const a = createUploadPayload(owner, 'attendance_verification');
  const b = createUploadPayload(owner, 'attendance_verification');
  assert.equal(a.type, 'authenticated'); assert.equal(a.overwrite, false);
  assert.ok(a.publicId.startsWith(owner + '/')); assert.notEqual(a.publicId, b.publicId);
  assert.equal(createUploadPayload(owner, 'student_profiles').type, 'upload');
  assert.equal(a.signature, cloudinary.utils.api_sign_request({ timestamp: a.timestamp, folder: a.folder, public_id: a.publicId, type: a.type, overwrite: false }, 'test-secret'));
  assert.ok(!JSON.stringify(a).includes('test-secret'));
});
test('accepts a real receipt only for the authenticated uploader', () => {
  assert.equal(isOwnedAttendancePhoto(url, owner, receipt), true);
  for (const [candidate, user, signature] of [
    [url, 'different-user', receipt], [url, owner, '0'.repeat(40)],
    [url.replace('test-cloud', 'other-cloud'), owner, receipt],
    [url.replace('/authenticated/', '/upload/'), owner, receipt],
    [url + '?redirect=bad', owner, receipt], ['data:image/png;base64,AA==', owner, receipt],
    [url.replace(String(version), String(version + 1)), owner, receipt],
  ]) assert.equal(isOwnedAttendancePhoto(candidate, user, signature), false);
});
test('faculty delivery uses a signed URL while stored URL stays unsigned', () => {
  const delivery = attendancePhotoDeliveryUrl(url);
  assert.match(delivery, /\/image\/authenticated\/s--[^/]+--\//);
  assert.equal(new URL(delivery).hostname, 'res.cloudinary.com');
  assert.equal(attendancePhotoDeliveryUrl(null), '');
  assert.equal(attendancePhotoDeliveryUrl('javascript:alert(1)'), '');
});
