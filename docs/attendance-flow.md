# Attendance check-in

1. Students upload their profile photo in Profile, then enroll in the class.
2. Faculty starts attendance in the portal. The QR rotates every 25 seconds.
3. The student scans a current QR. The backend checks the session and enrollment
   and issues a ticket bound to that student, QR and session for three minutes.
4. The student takes and sends a selfie. Cloudinary stores the authenticated image;
   Supabase stores only its URL. The record starts as PENDING.
5. The teacher reviews name, USN, registered profile photo and selfie, then confirms
   or rejects. A missing/unavailable photo is shown explicitly, never replaced by
   a demo student image.
6. The student's Attendance page refreshes automatically. In-app decision banners
   can be enabled/disabled in Profile → Attendance alerts. These are foreground
   alerts; background device push notifications are not implemented.
7. Download sheet on the live session, or open Reports later. The backend generates
   the Excel file from persisted enrollment and verification records. Unreviewed
   submissions remain PENDING in the file.

Classes and attendance use account-specific device caches, refresh on entry,
foreground return and polling, and support pull-to-refresh. Network failures show
saved-data warnings; scanning, uploads and decisions always require the server.
Caches expire after 24 hours and clear on sign-out or through Storage & cache.

No demo attendance fallback or simulated scans are used. Session history is loaded
from the backend rather than browser-local records.

Validation commands:

- Root: `node --test tests/*.test.cjs`, `npx tsc --noEmit`, `npx expo lint`.
- Backend: `npm run build`, `node --test tests/*.test.cjs`.
- Faculty portal: `npm run lint`, `npm run build`.
