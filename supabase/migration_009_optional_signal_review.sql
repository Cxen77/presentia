-- Migration 009: make post-session signal review advisory, not blocking.
--
-- Previously a session could not be finalized while the device/location audit
-- was incomplete or any flagged signal lacked a written review decision. The
-- teacher wants a faster flow: end the session, optionally skim the photos,
-- then submit the class from the report. Risk signals stay visible in the
-- review feed, but nothing blocks submission and no reason is required.
-- The audit trail row is still written at confirmation (with a default reason
-- when the teacher did not review a flagged submission).

CREATE OR REPLACE FUNCTION public.guard_audited_confirmation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.finalized_at IS NULL OR OLD.finalized_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.attendance_review_events(record_id,reviewer_id,decision,reason,findings)
    SELECT id,NEW.finalized_by,status,COALESCE(risk_review_reason,'Faculty confirmed without individual signal review'),audit_findings
    FROM public.attendance_records WHERE session_id=NEW.id;
  RETURN NEW;
END $$;
