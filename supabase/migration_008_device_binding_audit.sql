BEGIN;

-- Backend-only writes. Installation IDs are resettable signals, not hardware IDs.
CREATE TABLE public.student_devices (
  installation_id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  platform text NOT NULL CHECK (platform IN ('android','ios','web')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_devices_owner ON public.student_devices(student_id);
CREATE TABLE public.device_conflicts (
  installation_id uuid NOT NULL REFERENCES public.student_devices(installation_id),
  attempted_student_id uuid NOT NULL REFERENCES public.profiles(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (installation_id, attempted_student_id)
);
CREATE TABLE public.device_ownership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES public.student_devices(installation_id),
  old_student_id uuid NOT NULL REFERENCES public.profiles(id),
  new_student_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL CHECK (status IN ('active','revoked')),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_sessions ADD COLUMN audit_required boolean NOT NULL DEFAULT true,
  ADD COLUMN submission_deadline timestamptz;
-- Already collected sessions remain compatible with their original review contract.
UPDATE public.attendance_sessions SET audit_required = false;
ALTER TABLE public.attendance_records
  ADD COLUMN installation_id uuid REFERENCES public.student_devices(installation_id),
  ADD COLUMN device_status_at_submission text,
  ADD COLUMN audit_findings jsonb,
  ADD COLUMN risk_review_decision text CHECK (risk_review_decision IN ('PRESENT','REJECTED')),
  ADD COLUMN risk_review_reason text;
CREATE INDEX attendance_session_device ON public.attendance_records(session_id,installation_id,student_id);
-- A private selfie receipt cannot be reused for another session.
CREATE UNIQUE INDEX attendance_unique_selfie ON public.attendance_records(verification_photo_url)
  WHERE verification_photo_url IS NOT NULL;
CREATE TABLE public.attendance_audit_jobs (
  session_id uuid PRIMARY KEY REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','failed','complete')),
  attempts integer NOT NULL DEFAULT 0,
  cursor_id uuid,
  lease_id uuid,
  lease_until timestamptz,
  retry_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text
);
CREATE INDEX attendance_audit_ready ON public.attendance_audit_jobs(status,retry_at,lease_until);
CREATE TABLE public.attendance_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  decision text NOT NULL CHECK (decision IN ('PRESENT','REJECTED')),
  reason text NOT NULL,
  findings jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.attendance_risk_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  installation_id uuid NOT NULL REFERENCES public.student_devices(installation_id),
  location jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attendance_risk_attempt_session ON public.attendance_risk_attempts(session_id,student_id);

CREATE FUNCTION public.register_student_device(p_installation uuid,p_student uuid,p_platform text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.student_devices;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_student AND role='student' AND archived_at IS NULL)
    OR p_platform NOT IN ('android','ios','web') THEN RAISE EXCEPTION 'DEVICE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  INSERT INTO public.student_devices(installation_id,student_id,platform) VALUES(p_installation,p_student,p_platform)
    ON CONFLICT (installation_id) DO NOTHING;
  SELECT * INTO d FROM public.student_devices WHERE installation_id=p_installation FOR UPDATE;
  IF d.student_id <> p_student THEN
    INSERT INTO public.device_conflicts(installation_id,attempted_student_id) VALUES(p_installation,p_student)
      ON CONFLICT (installation_id,attempted_student_id) DO UPDATE SET last_seen_at=now(),attempts=public.device_conflicts.attempts+1;
    RETURN jsonb_build_object('allowed',false,'code','DEVICE_CONFLICT');
  END IF;
  IF d.status <> 'active' THEN RETURN jsonb_build_object('allowed',false,'code','DEVICE_REVOKED'); END IF;
  UPDATE public.student_devices SET last_seen_at=now() WHERE installation_id=p_installation;
  RETURN jsonb_build_object('allowed',true,'status','active');
END $$;

CREATE FUNCTION public.admin_resolve_student_device(p_installation uuid,p_student uuid,p_status text,p_actor uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.student_devices;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin' AND archived_at IS NULL)
    THEN RAISE EXCEPTION 'DEVICE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF length(trim(p_reason)) NOT BETWEEN 5 AND 500 OR p_status NOT IN ('active','revoked')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student AND role='student' AND archived_at IS NULL)
    THEN RAISE EXCEPTION 'INVALID_DEVICE_RESOLUTION' USING ERRCODE='22023'; END IF;
  SELECT * INTO STRICT d FROM public.student_devices WHERE installation_id=p_installation FOR UPDATE;
  INSERT INTO public.device_ownership_events(installation_id,old_student_id,new_student_id,status,actor_id,reason)
    VALUES(p_installation,d.student_id,p_student,p_status,p_actor,p_reason);
  UPDATE public.student_devices SET student_id=p_student,status=p_status,last_seen_at=now() WHERE installation_id=p_installation;
END $$;

CREATE OR REPLACE FUNCTION public.attendance_insert_requires_open_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.attendance_sessions; d public.student_devices;
BEGIN
  SELECT * INTO s FROM public.attendance_sessions WHERE id=NEW.session_id FOR SHARE;
  IF s.status IS DISTINCT FROM 'ACTIVE' OR (s.submission_deadline IS NOT NULL AND s.submission_deadline <= now()) THEN
    RAISE EXCEPTION 'ATTENDANCE_SESSION_CLOSED' USING ERRCODE='23514'; END IF;
  IF s.class_id IS DISTINCT FROM NEW.class_id OR NOT EXISTS(SELECT 1 FROM public.class_enrollments
    WHERE student_id=NEW.student_id AND class_id=s.class_id AND status='active') THEN
    RAISE EXCEPTION 'ATTENDANCE_ENROLLMENT_REQUIRED' USING ERRCODE='42501'; END IF;
  IF s.audit_required THEN
    SELECT * INTO d FROM public.student_devices WHERE installation_id=NEW.installation_id FOR SHARE;
    IF d.student_id IS DISTINCT FROM NEW.student_id OR d.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'DEVICE_CONFLICT' USING ERRCODE='42501'; END IF;
    NEW.device_status_at_submission := d.status;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.enqueue_attendance_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.audit_required AND NEW.status <> 'ACTIVE' AND NEW.finalized_at IS NULL THEN
    INSERT INTO public.attendance_audit_jobs(session_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_audit_enqueue AFTER UPDATE OF status ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_attendance_audit();

-- Indexed, small claims; SKIP LOCKED plus a fencing token prevents overlapping commits.
CREATE FUNCTION public.claim_attendance_audit() RETURNS SETOF public.attendance_audit_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE chosen uuid;
BEGIN
  -- Optional explicit deadlines are enforced even if no portal is open.
  UPDATE public.attendance_sessions SET status='AWAITING_VERIFICATION',closed_at=now()
    WHERE id IN (SELECT id FROM public.attendance_sessions WHERE status='ACTIVE'
      AND submission_deadline <= now() ORDER BY submission_deadline LIMIT 10 FOR UPDATE SKIP LOCKED);
  SELECT session_id INTO chosen FROM public.attendance_audit_jobs WHERE
    ((status IN ('queued','failed') AND retry_at <= now()) OR (status='running' AND lease_until < now()))
    ORDER BY retry_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF chosen IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.attendance_audit_jobs SET status='running',attempts=attempts+1,
    lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',last_error=NULL
    WHERE session_id=chosen RETURNING *;
END $$;
CREATE INDEX attendance_session_deadline ON public.attendance_sessions(submission_deadline) WHERE status='ACTIVE';

CREATE FUNCTION public.attendance_audit_batch(p_session uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.attendance_audit_jobs; result jsonb;
BEGIN
  SELECT * INTO j FROM public.attendance_audit_jobs WHERE session_id=p_session AND lease_id=p_lease
    AND status='running' AND lease_until>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'AUDIT_LEASE_LOST' USING ERRCODE='PT409'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(batch) ORDER BY batch.id),'[]'::jsonb) INTO result FROM (
    SELECT r.id,r.student_id,r.installation_id,r.device_status_at_submission,r.checkin_location,
      r.verification_photo_url,p.avatar_url,d.student_id AS registered_student_id,d.status AS registered_status,
      EXISTS(SELECT 1 FROM public.attendance_records other WHERE other.session_id=p_session
        AND other.installation_id=r.installation_id AND other.student_id<>r.student_id) AS cross_account_reuse
    FROM public.attendance_records r JOIN public.profiles p ON p.id=r.student_id
      LEFT JOIN public.student_devices d ON d.installation_id=r.installation_id
    WHERE r.session_id=p_session AND (j.cursor_id IS NULL OR r.id>j.cursor_id) ORDER BY r.id LIMIT 30
  ) batch;
  RETURN result;
END $$;

CREATE FUNCTION public.save_attendance_audit_batch(p_session uuid,p_lease uuid,p_results jsonb,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.attendance_audit_jobs; item jsonb; last_id uuid; expected uuid[]; supplied uuid[];
BEGIN
  SELECT * INTO j FROM public.attendance_audit_jobs WHERE session_id=p_session FOR UPDATE;
  IF j.lease_id IS DISTINCT FROM p_lease OR j.status <> 'running' OR j.lease_until <= now() THEN RETURN false; END IF;
  IF p_error IS NOT NULL THEN
    UPDATE public.attendance_audit_jobs SET status='failed',last_error=left(p_error,200),lease_until=NULL,
      retry_at=now()+make_interval(secs=>LEAST(900,60*attempts)) WHERE session_id=p_session;
    RETURN true;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO expected FROM (SELECT id FROM public.attendance_records
    WHERE session_id=p_session AND (j.cursor_id IS NULL OR id>j.cursor_id) ORDER BY id LIMIT 30) x;
  SELECT array_agg((x->>'id')::uuid ORDER BY (x->>'id')::uuid) INTO supplied FROM jsonb_array_elements(p_results) x;
  IF expected IS DISTINCT FROM supplied THEN RAISE EXCEPTION 'AUDIT_BATCH_CHANGED' USING ERRCODE='PT409'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    UPDATE public.attendance_records SET audit_findings=item->'findings' WHERE id=(item->>'id')::uuid AND session_id=p_session;
    last_id := (item->>'id')::uuid;
  END LOOP;
  UPDATE public.attendance_audit_jobs SET cursor_id=COALESCE(last_id,cursor_id),
    status=CASE WHEN expected IS NULL THEN 'complete' ELSE 'queued' END,
    completed_at=CASE WHEN expected IS NULL THEN now() ELSE NULL END,
    lease_until=NULL,retry_at=now() WHERE session_id=p_session;
  RETURN true;
END $$;

CREATE FUNCTION public.review_audited_attendance(p_record uuid,p_actor uuid,p_decision text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.attendance_records; s public.attendance_sessions; actor_role text;
BEGIN
  SELECT * INTO STRICT r FROM public.attendance_records WHERE id=p_record;
  SELECT * INTO s FROM public.attendance_sessions WHERE id=r.session_id FOR UPDATE;
  SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor AND archived_at IS NULL;
  IF actor_role IS NULL OR actor_role NOT IN ('faculty','admin') OR (s.faculty_id<>p_actor AND actor_role<>'admin') THEN
    RAISE EXCEPTION 'SESSION_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF s.finalized_at IS NOT NULL OR s.status='ACTIVE' OR (s.audit_required AND NOT EXISTS(
    SELECT 1 FROM public.attendance_audit_jobs WHERE session_id=s.id AND status='complete')) THEN
    RAISE EXCEPTION 'AUDIT_NOT_READY' USING ERRCODE='PT409'; END IF;
  IF p_decision NOT IN ('PRESENT','REJECTED') OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'REVIEW_REASON_REQUIRED' USING ERRCODE='22023'; END IF;
  UPDATE public.attendance_records SET status=p_decision,risk_review_decision=p_decision,risk_review_reason=p_reason,
    verified_by=p_actor,verified_at=now(),rejection_reason=CASE WHEN p_decision='REJECTED' THEN p_reason ELSE NULL END
    WHERE id=p_record RETURNING * INTO r;
  INSERT INTO public.attendance_review_events(record_id,reviewer_id,decision,reason,findings)
    VALUES(p_record,p_actor,p_decision,p_reason,r.audit_findings);
  RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.guard_audited_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.finalized_at IS NOT NULL AND OLD.finalized_at IS NULL AND NEW.audit_required THEN
    IF NOT EXISTS(SELECT 1 FROM public.attendance_audit_jobs WHERE session_id=NEW.id AND status='complete') THEN
      RAISE EXCEPTION 'AUDIT_NOT_READY' USING ERRCODE='PT409'; END IF;
    IF EXISTS(SELECT 1 FROM public.attendance_records WHERE session_id=NEW.id
      AND ((audit_findings->>'requiresSignalReview')::boolean IS TRUE)
      AND (risk_review_decision IS NULL OR risk_review_decision<>status)) THEN
      RAISE EXCEPTION 'FLAGGED_REVIEW_REQUIRED' USING ERRCODE='PT409'; END IF;
    INSERT INTO public.attendance_review_events(record_id,reviewer_id,decision,reason,findings)
      SELECT id,NEW.finalized_by,status,COALESCE(risk_review_reason,'Faculty photo review during class confirmation'),audit_findings
      FROM public.attendance_records WHERE session_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_audit_confirmation BEFORE UPDATE OF finalized_at ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_audited_confirmation();

ALTER TABLE public.student_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_devices FROM anon, authenticated;
GRANT ALL ON public.student_devices TO service_role;
ALTER TABLE public.device_conflicts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_conflicts FROM anon, authenticated;
GRANT ALL ON public.device_conflicts TO service_role;
ALTER TABLE public.device_ownership_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_ownership_events FROM anon, authenticated;
GRANT ALL ON public.device_ownership_events TO service_role;
ALTER TABLE public.attendance_audit_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_audit_jobs FROM anon, authenticated;
GRANT ALL ON public.attendance_audit_jobs TO service_role;
ALTER TABLE public.attendance_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_review_events FROM anon, authenticated;
GRANT ALL ON public.attendance_review_events TO service_role;
ALTER TABLE public.attendance_risk_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_risk_attempts FROM anon, authenticated;
GRANT ALL ON public.attendance_risk_attempts TO service_role;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('register_student_device','admin_resolve_student_device','enqueue_attendance_audit',
      'claim_attendance_audit','attendance_audit_batch','save_attendance_audit_batch','review_audited_attendance','guard_audited_confirmation') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
-- Business conflicts use explicit HTTP 409 instead of serialization-failure
-- SQLSTATE, which an upstream transaction layer may automatically retry.
CREATE OR REPLACE FUNCTION public.confirm_attendance_review(
  p_session_id uuid, p_actor_id uuid, p_request_id uuid,
  p_expected_records jsonb, p_excluded_ids uuid[] DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.attendance_sessions;
  actor_role text;
  expected jsonb;
  actual jsonb;
  actual_ids uuid[];
  excluded_ids uuid[];
  request_digest text;
  present_count integer;
  absent_count integer;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id AND archived_at IS NULL;
  SELECT * INTO s FROM public.attendance_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF actor_role NOT IN ('faculty', 'admin') OR actor_role IS NULL OR (s.faculty_id <> p_actor_id AND actor_role <> 'admin') THEN
    RAISE EXCEPTION 'SESSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_expected_records) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_REVIEW' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_expected_records) AS x(id uuid, status text)
    WHERE x.id IS NULL OR x.status IS NULL OR x.status NOT IN ('PENDING', 'PRESENT', 'REJECTED'))
    OR (SELECT count(*) <> count(DISTINCT x.id) FROM jsonb_to_recordset(p_expected_records) AS x(id uuid, status text)) THEN
    RAISE EXCEPTION 'INVALID_REVIEW' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status) ORDER BY x.id), '[]'::jsonb)
    INTO expected FROM jsonb_to_recordset(p_expected_records) AS x(id uuid, status text);
  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::uuid[]) INTO excluded_ids FROM unnest(COALESCE(p_excluded_ids, '{}'::uuid[])) x;
  request_digest := md5(expected::text || to_jsonb(excluded_ids)::text);

  IF s.finalized_at IS NOT NULL THEN
    IF s.finalization_request_id IS DISTINCT FROM p_request_id OR s.finalization_digest IS DISTINCT FROM request_digest THEN
      RAISE EXCEPTION 'SESSION_ALREADY_CONFIRMED' USING ERRCODE = 'PT409';
    END IF;
  ELSE
    IF s.status = 'ACTIVE' THEN RAISE EXCEPTION 'STOP_SESSION_FIRST' USING ERRCODE = 'PT409'; END IF;
    PERFORM 1 FROM public.attendance_records WHERE session_id = p_session_id FOR UPDATE;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status) ORDER BY r.id), '[]'::jsonb),
      COALESCE(array_agg(r.id), '{}'::uuid[]) INTO actual, actual_ids
      FROM public.attendance_records r WHERE r.session_id = p_session_id;
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'REVIEW_CHANGED' USING ERRCODE = 'PT409'; END IF;
    IF NOT excluded_ids <@ actual_ids THEN RAISE EXCEPTION 'INVALID_EXCLUSIONS' USING ERRCODE = '22023'; END IF;
    UPDATE public.attendance_records SET
      status = CASE WHEN id = ANY(excluded_ids) THEN 'REJECTED' ELSE 'PRESENT' END,
      verified_by = p_actor_id, verified_at = now(),
      rejection_reason = CASE WHEN id = ANY(excluded_ids) THEN 'Excluded by teacher during session review' ELSE NULL END
      WHERE session_id = p_session_id;
    UPDATE public.attendance_sessions SET status = 'CLOSED', closed_at = COALESCE(closed_at, now()),
      finalized_at = now(), finalized_by = p_actor_id, finalization_request_id = p_request_id, finalization_digest = request_digest
      WHERE id = p_session_id RETURNING * INTO s;
  END IF;
  SELECT count(*) FILTER (WHERE status = 'PRESENT'), count(*) FILTER (WHERE status = 'REJECTED')
    INTO present_count, absent_count FROM public.attendance_records WHERE session_id = p_session_id;
  RETURN jsonb_build_object('id', s.id, 'status', s.status, 'closedAt', s.closed_at,
    'finalizedAt', s.finalized_at, 'present', present_count, 'excluded', absent_count);
END;
$$;
COMMIT;
