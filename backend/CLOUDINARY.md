Photo storage
=============

Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the
backend environment (including Render). Never put the secret in EXPO_PUBLIC_*
variables. The student app requests an authenticated upload signature and uploads
directly to Cloudinary; an unsigned upload preset is not required.

Profile images use student_profiles. Attendance selfies use authenticated assets
under attendance_verification/<auth-user-id>/<random-id>. The server generates
the ID and disables overwrites. Attendance submission verifies the upload receipt
and uploader before saving only verification_photo_url in Supabase. Authorized
faculty session-record responses generate signed delivery links for comparison.

For projects missing the attendance tables, apply
supabase/setup_attendance_storage.sql after the core classes/profile setup.
This creates no demo data, enables RLS, and reserves writes and QR-token access
for the authenticated backend. Do not reapply existing schema migrations blindly.

Validation: npm run build && node --test tests/cloudinary.test.cjs (in backend/).
Student uploader tests: node --test tests/*.test.cjs (at the repository root).
