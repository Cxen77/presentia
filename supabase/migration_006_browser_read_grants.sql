-- Migration 006: browser read grants for direct database access.
--
-- The faculty portal reads classes, sessions and QR tokens directly from the
-- database (row-level security keeps each teacher inside their own rows), but
-- the `authenticated` role was missing table privileges on qr_tokens, causing
-- 403 Forbidden on every browser query. Grants never bypass RLS — the policies
-- above still decide which rows each role may see.

GRANT SELECT ON public.qr_tokens TO authenticated;

-- Defensive: the same gap must not break the other browser-read tables.
GRANT SELECT ON public.classes TO authenticated;
GRANT SELECT ON public.class_enrollments TO authenticated;
GRANT SELECT ON public.attendance_sessions TO authenticated;
GRANT SELECT ON public.attendance_records TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
