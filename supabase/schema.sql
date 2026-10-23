-- ====================================================================
-- SUPABASE RELATIONAL SCHEMA: STUDENT CLASS ATTENDANCE & ENROLLMENT
-- Complete Production Schema with Row-Level Security (RLS) & Seed Records
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STUDENT PROFILES TABLE
-- Stores student profile information linked directly to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    roll_number TEXT UNIQUE NOT NULL,
    degree TEXT NOT NULL DEFAULT 'Computer Science',
    semester TEXT NOT NULL DEFAULT '3rd Semester',
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'faculty', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON public.profiles(roll_number);

-- 3. CLASSES TABLE
-- Classes created by teachers/institutions with unique enrollment codes
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_enrollment_code ON public.classes(enrollment_code);

-- 4. CLASS ENROLLMENTS TABLE
-- Relates authenticated students to classes. Enforces unique enrollment per student and class.
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
    UNIQUE(student_id, class_id) -- Prevents duplicate enrollment!
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON public.class_enrollments(class_id);

-- 5. CLASS INVITATIONS TABLE (For QR and token-based invitations)
CREATE TABLE IF NOT EXISTS public.class_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    invitation_code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.class_invitations(invitation_code);

-- ====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_invitations ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own profile upon onboarding
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND role = 'student');

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- --- CLASSES POLICIES ---
-- Authenticated users can view active classes to join or inspect
CREATE POLICY "Authenticated users can view active classes"
    ON public.classes FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Students cannot insert, update, or delete classes (only service-role / faculty can)

-- --- CLASS ENROLLMENTS POLICIES ---
-- Students can view their own enrollments
CREATE POLICY "Students can view own enrollments"
    ON public.class_enrollments FOR SELECT
    TO authenticated
    USING (student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Students can enroll themselves into a class
CREATE POLICY "Students can enroll themselves"
    ON public.class_enrollments FOR INSERT
    TO authenticated
    WITH CHECK (
      status = 'active'
      AND student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student')
      AND EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND is_active = TRUE)
    );

CREATE POLICY "Students can reactivate own enrollment"
    ON public.class_enrollments FOR UPDATE
    TO authenticated
    USING (student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student'))
    WITH CHECK (
      status = 'active'
      AND student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student')
      AND EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND is_active = TRUE)
    );

-- Students can drop/leave their own enrolled class
CREATE POLICY "Students can leave enrolled class"
    ON public.class_enrollments FOR DELETE
    TO authenticated
    USING (student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- --- CLASS INVITATIONS POLICIES ---
-- Authenticated users can view active, non-expired invitations
CREATE POLICY "Authenticated users can view active invitations"
    ON public.class_invitations FOR SELECT
    TO authenticated
    USING (is_active = true AND expires_at > NOW());

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (user_id, email, full_name, first_name, roll_number, degree, semester, avatar_url, updated_at)
    ON public.profiles TO authenticated;
GRANT UPDATE (user_id, email, full_name, first_name, roll_number, degree, semester, avatar_url, updated_at)
    ON public.profiles TO authenticated;
GRANT SELECT ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments TO authenticated;
GRANT SELECT ON public.class_invitations TO authenticated;

-- ====================================================================
-- SEED DEVELOPMENT CLASSES & INVITATIONS
-- These represent institutional classes available for testing enrollment codes
-- ====================================================================

INSERT INTO public.classes (id, course_code, class_name, department, enrollment_code, teacher_name, schedule_info, room, class_type, credits)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'CS201',
        'Data Structures',
        'Computer Science',
        'CS201-DS',
        'Prof. R. Sengupta',
        'Today • 10:00 - 11:30 AM',
        'Lab 3B • Room 402',
        'Theory',
        4
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'CS203',
        'Database Management Systems',
        'Computer Science',
        'CS203-DB',
        'Dr. Ananya Roy',
        'Today • 11:45 - 01:15 PM',
        'Hall A • Room 204',
        'Theory',
        4
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'CS205',
        'Operating Systems',
        'Computer Science',
        'CS205-OS',
        'Prof. Vikram Mehta',
        'Today • 02:00 - 03:30 PM',
        'Seminar 1 • Room 102',
        'Theory',
        4
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        'CS207',
        'Computer Networks',
        'Computer Science',
        'CS207-CN',
        'Dr. Priya Sharma',
        'Today • 03:45 - 05:15 PM',
        'Lab 1A • Room 301',
        'Practical',
        4
    )
ON CONFLICT (enrollment_code) DO NOTHING;

-- Seed QR invitations
INSERT INTO public.class_invitations (class_id, invitation_code, expires_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'INVITE-CS201-FALL', NOW() + INTERVAL '30 days'),
    ('22222222-2222-2222-2222-222222222222', 'INVITE-CS203-FALL', NOW() + INTERVAL '30 days')
ON CONFLICT (invitation_code) DO NOTHING;
