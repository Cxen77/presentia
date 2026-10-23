# Authentication configuration and verification

The student app and faculty portal use `https://yurdfoblkaclivxqfpjt.supabase.co`. Configure their public keys in ignored environment files. The backend requires a separate server-only secret from the same project; never place it in EXPO_PUBLIC_* or VITE_* variables.

## Authentication behavior

- One persistent Supabase client is reused across reloads within each application runtime. Native sessions use AsyncStorage and foreground token refresh.
- Registration uses the entered email and exact password, waits for confirmation, and verifies the emailed code with Supabase. Duplicate accounts, delivery failures, expired codes, and unconfirmed email have visible errors.
- Profiles are saved only for authenticated users and upserted on user_id. Repeated sign-in reads the existing profile. Roll numbers remain unique across accounts.
- Startup restores the session and routes incomplete profiles to setup and complete profiles to the dashboard. No failed authentication creates a fake session.
- Web profile completion navigates directly after saving. Setup shows the signed-in email and allows switching accounts.
- Google uses the same Supabase client. Its provider is currently disabled in the project; the user chose Gmail email/password authentication. The Google flow is preserved but not verified.

## Database

The live public schema was inspected and found empty. `setup_auth_profiles.sql` created profiles with RLS and column grants that prevent clients from changing roles. A real account completed setup; repeated login retained one profile.

The authenticated backend then proved classes, class_enrollments, and class_invitations were absent (PGRST205). The existing `migration_000_core_schema.sql` was applied transactionally to initialize these required dashboard tables without seed data. RLS remains enabled. Attendance tables remain outside this authentication deployment and require separately reviewed setup before attendance operations can be tested. Do not blindly rerun migration_001_attendance.sql: its duplicate class-policy names conflict with the core migration, and its profile policy needs review for recursive RLS references.

## Render

The failed deployment timed out without detecting a listening port. The backend now explicitly binds 0.0.0.0, validates PORT, and the blueprint uses npm ci, npm run build, npm start, and /health. The existing Render service is presentia, linked to Cxen77/presentia main with root backend/.

The old deployment rejected a fresh token that the intended Supabase project accepted. Render's Supabase URL, public key, and server secret were corrected using values verified against the intended project. Secrets stay in Render and ignored local backend configuration.

## Live tests and checks

A real Gmail signup, email confirmation, exact-password login, authenticated user lookup, profile creation, and repeated profile lookup passed. Brevo numeric-code delivery and verification also passed using a separate inbox alias. Private test credentials stay in Git-ignored local files.

- Twelve focused authentication tests pass: `node --test tests/auth.test.cjs`.
- `npx tsc --noEmit` passes.
- Backend and faculty production builds pass; student Expo web export passes.
- `npx expo lint` reports 19 existing errors and 36 warnings in unrelated screen/component code. Changed auth services and verification components pass targeted lint. Project lint is not fully clean.
- Native device lifecycle, Google OAuth, and faculty attendance workflows have not been verified end to end.

## Create another real test account

Open Create Account at the local app, enter an inbox you control and a new app password, and enter the emailed verification code. Complete setup using your own unique roll number. Sign out and sign in again with that same email and app password; the existing profile should open the dashboard. Never use your Gmail mailbox password as an app password.

Reference: https://supabase.com/docs/guides/auth/quickstarts/react-native
