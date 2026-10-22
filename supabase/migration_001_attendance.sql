-- ====================================================================
-- MIGRATION 001: ATTENDANCE SESSIONS, RECORDS, QR TOKENS & FACULTY
-- Run this AFTER the base schema.sql has been applied.
-- ====================================================================

-- 1. ADD FACULTY COLUMNS TO CLASSES
-- Allow classes to be owned by a faculty member (profile with role='faculty')
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_faculty_id ON public.classes(faculty_id);

-- 2. ATTENDANCE SESSIONS TABLE
-- A faculty member starts a session for a class; students scan QR to submit attendance.
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

-- 3. QR TOKENS TABLE
-- Server-generated, short-lived tokens that rotate every ~25 seconds.
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

-- 4. ATTENDANCE RECORDS TABLE
-- One record per student per session. Status tracks the verification workflow.
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
    UNIQUE(session_id, student_id) -- One submission per student per session
);

CREATE INDEX IF NOT EXISTS idx_records_session_id ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_student_id ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON public.attendance_records(status);

-- 5. ENABLE RLS ON NEW TABLES
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- ROW-LEVEL SECURITY POLICIES
-- ====================================================================

-- --- ATTENDANCE SESSIONS POLICIES ---

-- Faculty can view sessions for classes they own
CREATE POLICY "Faculty can view own class sessions"
    ON public.attendance_sessions FOR SELECT
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

-- Students can view active sessions for classes they are enrolled in
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

-- Faculty can insert sessions for their own classes
-- (server-side uses service role, but this allows direct if needed)
CREATE POLICY "Faculty can create sessions for own classes"
    ON public.attendance_sessions FOR INSERT
    TO authenticated
    WITH CHECK (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- Faculty can update their own sessions
CREATE POLICY "Faculty can update own sessions"
    ON public.attendance_sessions FOR UPDATE
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- --- QR TOKENS POLICIES ---
-- QR tokens are managed server-side via service role.
-- Faculty can read tokens for their own sessions.
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

-- --- ATTENDANCE RECORDS POLICIES ---

-- Faculty can view records for sessions they own
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

-- Students can view their own attendance records
CREATE POLICY "Students can view own attendance records"
    ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

-- Students can insert their own attendance record (submit attendance)
CREATE POLICY "Students can submit own attendance"
    ON public.attendance_records FOR INSERT
    TO authenticated
    WITH CHECK (
      student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student')
    );

-- Students CANNOT update attendance records (no self-marking as Present)
-- Only faculty/admin can update via service role or:
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

-- ====================================================================
-- ADDITIONAL POLICIES FOR CLASSES (faculty management)
-- ====================================================================

-- Faculty can insert classes
CREATE POLICY "Faculty can create classes"
    ON public.classes FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- Faculty can update their own classes
CREATE POLICY "Faculty can update own classes"
    ON public.classes FOR UPDATE
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- Faculty can view all active classes (existing policy covers this)
-- Also allow faculty to see their own inactive classes
CREATE POLICY "Faculty can view own inactive classes"
    ON public.classes FOR SELECT
    TO authenticated
    USING (
      faculty_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
    );

-- ====================================================================
-- ADDITIONAL PROFILE POLICIES (faculty reading enrolled students)
-- ====================================================================

-- Faculty can read profiles of students enrolled in their classes
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

-- Faculty can read their own profile
-- (The existing "Users can read own profile" policy already covers this)

-- ====================================================================
-- ENROLLMENT POLICY ADDITIONS (faculty can view enrollments for their classes)
-- ====================================================================

CREATE POLICY "Faculty can view enrollments for own classes"
    ON public.class_enrollments FOR SELECT
    TO authenticated
    USING (
      class_id IN (
        SELECT c.id FROM public.classes c
        WHERE c.faculty_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('faculty', 'admin'))
      )
    );

-- Enable Realtime on attendance_records for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
