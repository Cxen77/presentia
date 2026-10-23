-- Provision the first administrator only through a trusted server-side setup.
-- Authenticated clients still have no INSERT/UPDATE grant on profiles.role.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_admin ON public.profiles ((role)) WHERE role='admin';
-- Existing faculty accounts predate the staff-ID login feature.
UPDATE public.profiles SET roll_number='FAC-' || upper(substr(replace(id::text,'-',''),1,12))
WHERE role='faculty' AND (roll_number IS NULL OR btrim(roll_number)='');
