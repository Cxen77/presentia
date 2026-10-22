-- ====================================================================
-- UNIFIED SUPABASE SETUP SCRIPT: CLASS ATTENDANCE & FACULTY PORTAL
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/krdykejphzdnatxekerr/sql)
-- Idempotent & safe to run on existing databases.
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE
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
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'faculty', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON public.profiles(roll_number);

-- 3. CLASSES TABLE
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

CREATE INDEX IF NOT EXISTS idx_classes_enrollment_code ON public.classes(enrollment_code);
CREATE INDEX IF NOT EXISTS idx_classes_faculty_id ON public.classes(faculty_id);

-- Ensure newly added columns exist if classes was created earlier
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT;

-- 4. CLASS ENROLLMENTS TABLE
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
    UNIQUE(student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON public.class_enrollments(class_id);

-- 5. CLASS INVITATIONS TABLE (QR invitations)
CREATE TABLE IF NOT EXISTS public.class_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    invitation_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_class_invitations_code ON public.class_invitations(invitation_code);

-- 6. ATTENDANCE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.profiles(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TEXT,
    end_time TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
      CHECK (status IN ('ACTIVE', 'AWAITING_VERIFICATION', 'CLOSED')),
    token_rotation_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON public.attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_faculty_id ON public.attendance_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.attendance_sessions(status);

-- 7. QR TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_session_id ON public.qr_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.qr_tokens(token);

-- 8. ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    qr_token_id UUID REFERENCES public.qr_tokens(id),
    verification_photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING', 'PRESENT', 'REJECTED')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_records_session_id ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_student_id ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON public.attendance_records(status);

-- 9. ENABLE ROW-LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES (Safe drop & recreate)

-- PROFILES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Faculty can view enrolled student profiles" ON public.profiles;
CREATE POLICY "Faculty can view enrolled student profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
      id IN (
        SELECT ce.student_id FROM public.class_enrollments ce
        JOIN public.classes c ON c.id = ce.class_id
        WHERE c.faculty_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('faculty', 'admin'))
      )
    );

-- CLASSES
DROP POLICY IF EXISTS "Allow authenticated users to read active classes" ON public.classes;
CREATE POLICY "Allow authenticated users to read active classes"
    ON public.classes FOR SELECT
    TO authenticated
    USING (is_active = TRUE OR faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Faculty can create classes" ON public.classes;
CREATE POLICY "Faculty can create classes"
    ON public.classes FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

DROP POLICY IF EXISTS "Faculty can update own classes" ON public.classes;
CREATE POLICY "Faculty can update own classes"
    ON public.classes FOR UPDATE
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- ENROLLMENTS
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.class_enrollments;
CREATE POLICY "Students can view their own enrollments"
    ON public.class_enrollments FOR SELECT
    TO authenticated
    USING (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Faculty can view enrollments for own classes" ON public.class_enrollments;
CREATE POLICY "Faculty can view enrollments for own classes"
    ON public.class_enrollments FOR SELECT
    TO authenticated
    USING (
      class_id IN (
        SELECT c.id FROM public.classes c
        WHERE c.faculty_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('faculty', 'admin'))
      )
    );

DROP POLICY IF EXISTS "Students can enroll themselves" ON public.class_enrollments;
CREATE POLICY "Students can enroll themselves"
    ON public.class_enrollments FOR INSERT
    TO authenticated
    WITH CHECK (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student')
    );

DROP POLICY IF EXISTS "Students can drop own enrollment" ON public.class_enrollments;
CREATE POLICY "Students can drop own enrollment"
    ON public.class_enrollments FOR DELETE
    TO authenticated
    USING (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

-- INVITATIONS
DROP POLICY IF EXISTS "Anyone authenticated can validate invitations" ON public.class_invitations;
CREATE POLICY "Anyone authenticated can validate invitations"
    ON public.class_invitations FOR SELECT
    TO authenticated
    USING (is_active = TRUE AND expires_at > NOW());

-- SESSIONS
DROP POLICY IF EXISTS "Faculty can view own class sessions" ON public.attendance_sessions;
CREATE POLICY "Faculty can view own class sessions"
    ON public.attendance_sessions FOR SELECT
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Students can view sessions for enrolled classes" ON public.attendance_sessions;
CREATE POLICY "Students can view sessions for enrolled classes"
    ON public.attendance_sessions FOR SELECT
    TO authenticated
    USING (
      class_id IN (
        SELECT ce.class_id FROM public.class_enrollments ce
        JOIN public.profiles p ON p.id = ce.student_id
        WHERE p.user_id = auth.uid() AND ce.status = 'active'
      )
    );

DROP POLICY IF EXISTS "Faculty can create sessions for own classes" ON public.attendance_sessions;
CREATE POLICY "Faculty can create sessions for own classes"
    ON public.attendance_sessions FOR INSERT
    TO authenticated
    WITH CHECK (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

DROP POLICY IF EXISTS "Faculty can update own sessions" ON public.attendance_sessions;
CREATE POLICY "Faculty can update own sessions"
    ON public.attendance_sessions FOR UPDATE
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- ATTENDANCE RECORDS
DROP POLICY IF EXISTS "Faculty can view records for own sessions" ON public.attendance_records;
CREATE POLICY "Faculty can view records for own sessions"
    ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
      session_id IN (
        SELECT s.id FROM public.attendance_sessions s
        JOIN public.profiles p ON p.id = s.faculty_id
        WHERE p.user_id = auth.uid()
      )
    );

DROP POLICY IF EXISTS "Students can view own attendance records" ON public.attendance_records;
CREATE POLICY "Students can view own attendance records"
    ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Students can submit own attendance" ON public.attendance_records;
CREATE POLICY "Students can submit own attendance"
    ON public.attendance_records FOR INSERT
    TO authenticated
    WITH CHECK (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student')
    );

DROP POLICY IF EXISTS "Faculty can update records for own sessions" ON public.attendance_records;
CREATE POLICY "Faculty can update records for own sessions"
    ON public.attendance_records FOR UPDATE
    TO authenticated
    USING (
      session_id IN (
        SELECT s.id FROM public.attendance_sessions s
        JOIN public.profiles p ON p.id = s.faculty_id
        WHERE p.user_id = auth.uid() AND p.role IN ('faculty', 'admin')
      )
    );

-- QR TOKENS
DROP POLICY IF EXISTS "Faculty can view tokens for own sessions" ON public.qr_tokens;
CREATE POLICY "Faculty can view tokens for own sessions"
    ON public.qr_tokens FOR SELECT
    TO authenticated
    USING (
      session_id IN (
        SELECT s.id FROM public.attendance_sessions s
        JOIN public.profiles p ON p.id = s.faculty_id
        WHERE p.user_id = auth.uid()
      )
    );

-- 11. SEED DEFAULT INSTITUTIONAL CLASSES
INSERT INTO public.classes (id, course_code, class_name, department, enrollment_code, teacher_name, schedule_info, room, class_type, credits)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'CS201', 'Data Structures & Algorithms', 'Computer Science & Engineering', 'CS201-DS', 'Prof. R. Sengupta', 'Mon, Wed, Fri • 10:00 - 11:30 AM', 'Lab 3B • Room 402', 'Theory', 4),
    ('22222222-2222-2222-2222-222222222222', 'CS203', 'Database Management Systems', 'Computer Science & Engineering', 'CS203-DB', 'Prof. R. Sengupta', 'Tue, Thu • 11:45 - 01:15 PM', 'Hall A • Room 204', 'Theory', 4),
    ('33333333-3333-3333-3333-333333333333', 'CS205', 'Operating Systems Architecture', 'Computer Science & Engineering', 'CS205-OS', 'Prof. R. Sengupta', 'Mon, Thu • 02:00 - 03:30 PM', 'Seminar 1 • Room 102', 'Theory', 4),
    ('44444444-4444-4444-4444-444444444444', 'CS207', 'Computer Networks', 'Computer Science & Engineering', 'CS207-CN', 'Prof. R. Sengupta', 'Wed, Fri • 03:45 - 05:15 PM', 'Lab 1A • Room 301', 'Practical', 4)
ON CONFLICT (enrollment_code) DO NOTHING;

-- Seed QR invitations
INSERT INTO public.class_invitations (class_id, invitation_code, expires_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'INVITE-CS201-FALL', NOW() + INTERVAL '90 days'),
    ('22222222-2222-2222-2222-222222222222', 'INVITE-CS203-FALL', NOW() + INTERVAL '90 days')
ON CONFLICT (invitation_code) DO NOTHING;

-- 12. ENABLE REALTIME ON ATTENDANCE TABLES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
  END IF;
END $$;
