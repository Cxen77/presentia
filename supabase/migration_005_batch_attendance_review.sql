BEGIN;

-- One atomic class-wide review and a durable marker for retrying selfie cleanup.
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS finalization_request_id uuid,
  ADD COLUMN IF NOT EXISTS finalization_digest text;

CREATE OR REPLACE FUNCTION public.attendance_insert_requires_open_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE session_status text;
BEGIN
  -- Serialize a submission with stop/finalize, including requests already in flight.
  SELECT status INTO session_status FROM public.attendance_sessions
    WHERE id = NEW.session_id FOR SHARE;
  IF session_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'ATTENDANCE_SESSION_CLOSED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS attendance_insert_session_guard ON public.attendance_records;
CREATE TRIGGER attendance_insert_session_guard BEFORE INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.attendance_insert_requires_open_session();

CREATE OR REPLACE FUNCTION public.stop_attendance_for_review(p_session_id uuid, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.attendance_sessions; actor_role text;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id AND archived_at IS NULL;
  SELECT * INTO s FROM public.attendance_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF actor_role NOT IN ('faculty', 'admin') OR actor_role IS NULL OR (s.faculty_id <> p_actor_id AND actor_role <> 'admin') THEN
    RAISE EXCEPTION 'SESSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF s.finalized_at IS NULL THEN
    UPDATE public.attendance_sessions SET status = 'AWAITING_VERIFICATION', closed_at = COALESCE(closed_at, now())
      WHERE id = p_session_id RETURNING * INTO s;
  END IF;
  RETURN jsonb_build_object('id', s.id, 'status', s.status, 'closedAt', s.closed_at, 'finalizedAt', s.finalized_at);
END;
$$;

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
      RAISE EXCEPTION 'SESSION_ALREADY_CONFIRMED' USING ERRCODE = '40001';
    END IF;
  ELSE
    IF s.status = 'ACTIVE' THEN RAISE EXCEPTION 'STOP_SESSION_FIRST' USING ERRCODE = '40001'; END IF;
    PERFORM 1 FROM public.attendance_records WHERE session_id = p_session_id FOR UPDATE;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status) ORDER BY r.id), '[]'::jsonb),
      COALESCE(array_agg(r.id), '{}'::uuid[]) INTO actual, actual_ids
      FROM public.attendance_records r WHERE r.session_id = p_session_id;
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'REVIEW_CHANGED' USING ERRCODE = '40001'; END IF;
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

-- Only the authenticated backend invokes these; no browser may supply its actor identity.
REVOKE ALL ON FUNCTION public.stop_attendance_for_review(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_attendance_review(uuid, uuid, uuid, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stop_attendance_for_review(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_attendance_review(uuid, uuid, uuid, jsonb, uuid[]) TO service_role;

-- Attendance decisions and lifecycle changes always go through the authorized backend.
REVOKE INSERT, UPDATE, DELETE ON public.attendance_records FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_sessions FROM anon, authenticated;

COMMIT;
