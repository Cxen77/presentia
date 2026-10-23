-- Core schema required by student profiles, class creation, and enrollment.
-- Run before migration_001_attendance.sql, or use full_setup.sql instead.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    roll_number TEXT UNIQUE,
    degree TEXT NOT NULL DEFAULT 'Computer Science',
    semester TEXT NOT NULL DEFAULT '3rd Semester',
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'student'
      CHECK (role IN ('student', 'faculty', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code TEXT NOT NULL,
    class_name TEXT NOT NULL,
    department TEXT NOT NULL,
    enrollment_code TEXT UNIQUE NOT NULL,
    teacher_name TEXT,
    schedule_info TEXT,
    room TEXT,
    class_type TEXT DEFAULT 'Theory',
    credits INT DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    faculty_id UUID REFERENCES public.profiles(id),
    description TEXT,
    semester TEXT,
    start_time TEXT,
    end_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'dropped', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.class_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    invitation_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.class_invitations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'class_invitations'
      AND column_name = 'is_revoked'
  ) THEN
    EXECUTE 'UPDATE public.class_invitations SET is_active = NOT is_revoked';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_enrollments_student_class_unique
  ON public.class_enrollments(student_id, class_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON public.profiles(roll_number);
CREATE INDEX IF NOT EXISTS idx_classes_enrollment_code ON public.classes(enrollment_code);
CREATE INDEX IF NOT EXISTS idx_classes_faculty_id ON public.classes(faculty_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON public.class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_invitations_code ON public.class_invitations(invitation_code);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'student');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow authenticated users to read active classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users can view active classes" ON public.classes;
CREATE POLICY "Authenticated users can view active classes"
  ON public.classes FOR SELECT TO authenticated
  USING (is_active = TRUE OR faculty_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Faculty can create classes" ON public.classes;
CREATE POLICY "Faculty can create classes"
  ON public.classes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('faculty', 'admin')
  ));

DROP POLICY IF EXISTS "Faculty can update own classes" ON public.classes;
CREATE POLICY "Faculty can update own classes"
  ON public.classes FOR UPDATE TO authenticated
  USING (faculty_id IN (
    SELECT id FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('faculty', 'admin')
  ))
  WITH CHECK (faculty_id IN (
    SELECT id FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('faculty', 'admin')
  ));

DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students can view own enrollments" ON public.class_enrollments;
CREATE POLICY "Students can view own enrollments"
  ON public.class_enrollments FOR SELECT TO authenticated
  USING (student_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Students can enroll themselves" ON public.class_enrollments;
CREATE POLICY "Students can enroll themselves"
  ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    status = 'active'
    AND student_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student'
    )
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = class_id AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Students can reactivate own enrollment" ON public.class_enrollments;
CREATE POLICY "Students can reactivate own enrollment"
  ON public.class_enrollments FOR UPDATE TO authenticated
  USING (student_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student'
  ))
  WITH CHECK (
    status = 'active'
    AND student_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student'
    )
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = class_id AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Students can drop own enrollment" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students can leave enrolled class" ON public.class_enrollments;
CREATE POLICY "Students can leave enrolled class"
  ON public.class_enrollments FOR DELETE TO authenticated
  USING (student_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Anyone authenticated can validate invitations" ON public.class_invitations;
DROP POLICY IF EXISTS "Authenticated users can view active invitations" ON public.class_invitations;
CREATE POLICY "Authenticated users can view active invitations"
  ON public.class_invitations FOR SELECT TO authenticated
  USING (is_active = TRUE AND expires_at > NOW());

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (user_id, email, full_name, first_name, roll_number, degree, semester, avatar_url, updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (user_id, email, full_name, first_name, roll_number, degree, semester, avatar_url, updated_at)
  ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments TO authenticated;
GRANT SELECT ON public.class_invitations TO authenticated;

NOTIFY pgrst, 'reload schema';
