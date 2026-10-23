-- Minimal auth bootstrap for an empty public schema, verified in the dashboard.
-- Run only if public.profiles does not exist. The complete app's ordered
-- migrations remain separate; this creates no attendance/class tables.
BEGIN;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  roll_number TEXT UNIQUE,
  degree TEXT NOT NULL DEFAULT 'Computer Science',
  semester TEXT NOT NULL DEFAULT '3rd Semester',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'faculty', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (user_id, email, full_name, first_name, roll_number, degree, semester, avatar_url, updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (user_id, email, full_name, first_name, roll_number, degree, semester, avatar_url, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND role = 'student');
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

NOTIFY pgrst, 'reload schema';
COMMIT;
