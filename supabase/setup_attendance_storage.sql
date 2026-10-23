-- Required only when attendance_sessions, qr_tokens and attendance_records are absent.
-- No seed records. All writes remain behind the backend's authenticated role checks.
BEGIN;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
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


REVOKE ALL ON public.attendance_sessions, public.qr_tokens, public.attendance_records FROM anon, authenticated;
GRANT ALL ON public.attendance_sessions, public.qr_tokens, public.attendance_records TO service_role;
GRANT SELECT ON public.attendance_sessions, public.attendance_records TO authenticated;

CREATE POLICY "Read own faculty or enrolled sessions"
  ON public.attendance_sessions FOR SELECT TO authenticated
  USING (
    faculty_id IN (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
    OR class_id IN (
      SELECT ce.class_id FROM public.class_enrollments ce
      JOIN public.profiles p ON p.id = ce.student_id
      WHERE p.user_id = (SELECT auth.uid()) AND ce.status = 'active'
    )
  );
CREATE POLICY "Read own or managed attendance records"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
    OR session_id IN (
      SELECT s.id FROM public.attendance_sessions s
      JOIN public.profiles p ON p.id = s.faculty_id
      WHERE p.user_id = (SELECT auth.uid()) AND p.role IN ('faculty','admin')
    )
  );

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
