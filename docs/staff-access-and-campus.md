# Staff access and campus attendance

Apply the existing schema/security setup, then migrations `002`, `003`, and `004` in order. Keep RLS enabled. They add location evidence, class campus settings, a single-admin constraint, staff IDs, student class roll/section, and reversible deletion fields. They do not give authenticated clients permission to modify roles or account deletion flags.

Provision the first administrator with a trusted server-side Supabase admin client. Create its real Auth account with email confirmation required and `app_metadata.must_change_password = true`, then create its `profiles` row with `role = 'admin'` and a unique staff login ID. Never put the Supabase secret in a frontend bundle. No public admin-registration endpoint exists. The unique partial index prevents a second admin profile.

New staff use **Verify email / enter confirmation code** on the portal login page. Supabase sends the signup code using the project's configured Brevo SMTP provider. After verification, the portal requires a new password. Backend middleware denies all protected endpoints except profile lookup and initial password setup while the trusted Auth flag is set. Ordinary email/password and Google sign-in continue to use the same Supabase project.

The administrator can view accounts, add faculty, edit faculty and student details, assign/edit classes, and view reports. Creating or resetting a faculty account displays a cryptographically generated initial password once; the recipient must set their own password. Faculty can manage only their own classes and students actively enrolled in them. Role and email are not accepted by detail-edit endpoints. Passwords are never stored in profiles.

Students can enter class roll number and section during setup or profile editing. These are separate from the unique university USN. Portal rosters, review queues, and Excel exports sort rolls naturally (2 before 10), with USN fallback. Student management shows expandable class memberships; the class roster can filter by section.

New student setup has seven questions: optional profile photo, full name, USN, required class roll, required section, department, and semester. Chosen profile photos upload to Cloudinary before their URLs are saved. The welcome screen appears only on a first unauthenticated visit, remembered in device/browser storage. A real restored Supabase session routes directly to the dashboard or incomplete profile setup. Returning signed-out users go directly to login; the login screen does not navigate back to welcome.

Delete actions require confirmation in the portal. Classes become inactive and can be restored from Deleted / inactive classes. Enrollment removal sets a dropped status and end time; historical session exports retain the student. Faculty deletion is admin-only, requires reassignment/deletion of active classes, and disables access without deleting historical ownership. The admin can restore deleted faculty. Active attendance sessions block class deletion and enrollment removal. Archived faculty are blocked by backend middleware and restrictive Supabase RLS, including pre-existing sessions. Authenticated clients cannot modify the archived flag. No hard-delete endpoint is exposed.

## Attendance and calendar

The student Home and My Classes screens share a compact class card. Opening it uses an Expo Router class route. The monthly calendar reads actual sessions and the student's own attendance records: confirmed attendance is present, rejected or closed sessions with no submission are absent, and undecided submissions stay pending. Days without sessions are unmarked. Calendar access requires active enrollment.

A selfie submission remains pending until faculty review. Faculty see the student's name, USN, profile image, authenticated Cloudinary selfie, and expandable location evidence. Excel exports preserve pending decisions and reflect confirmed results. Only unsigned image URLs are persisted; authorized server responses generate signed private selfie delivery URLs.

## Campus checks and limitations

Teachers configure a campus centre and radius in the class details panel. Restrictions are disabled by default until a teacher saves real campus coordinates. GPS is collected at QR scan and again after selfie upload. The server checks freshness, uncertainty, radius, and reported mock status at both stages; a signed scan ticket binds the first location to the authenticated student and session.

Restricted classes require a native app: browsers cannot reliably report mock-location status. Foreground location is requested at attendance check-in; there is no background tracking. A previously granted native location permission is checked on app launch/resume, and reported simulated locations show instructions and block attendance.

Location and mock flags are client reports, not device attestation. Modified clients can forge them. Android's `DEVELOPMENT_SETTINGS_ENABLED` and `ADB_ENABLED` return zero to third-party apps, so the app reports Developer Options as unavailable instead of claiming it can detect that switch. See [Android Settings.Global](https://developer.android.com/reference/android/provider/Settings.Global#DEVELOPMENT_SETTINGS_ENABLED) and [Expo SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/). Physical-device testing is required for GPS permissions and mock-location behavior.

## Validation

Run `npx tsc --noEmit`, `npx expo lint`, and `node --test tests/*.test.cjs` at the root. Run `npm run build` and `node --test tests/*.test.cjs` in `backend`, and `npm run build` and `npm run lint` in `faculty-portal`. Web export uses `npx expo export --platform web`.

Server integration checks should use real Supabase accounts and isolated disposable test sessions/classes. Check inside/outside campus, stale/inaccurate/simulated coordinates, restricted browser submissions, calendar enrollment boundaries, faculty ownership, admin denial, private image delivery, and Excel exports. Synthetic coordinate tests do not verify physical GPS or prove spoof resistance.
