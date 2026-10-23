-- Add only the settings/evidence required by campus check-in. Existing RLS stays enabled.
BEGIN;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS geofence JSONB NOT NULL DEFAULT '{"enabled":false}'::jsonb;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS checkin_location JSONB;
-- Existing frontend class-write policies must not permit bypassing the owner API.
-- Restrict this new field with column grants while preserving other existing grants.
REVOKE UPDATE ON public.classes FROM authenticated;
GRANT UPDATE (course_code,class_name,department,semester,room,start_time,end_time,class_type,credits,description,enrollment_code,teacher_name,schedule_info,is_active) ON public.classes TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
