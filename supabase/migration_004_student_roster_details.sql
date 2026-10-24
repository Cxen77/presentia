-- Academic class roll is separate from the existing unique university USN.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_roll_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT '';
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_class_roll_length') THEN
ALTER TABLE public.profiles ADD CONSTRAINT profiles_class_roll_length CHECK (length(class_roll_number) <= 20);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_section_length') THEN
ALTER TABLE public.profiles ADD CONSTRAINT profiles_section_length CHECK (length(section) <= 30);
END IF;
END $$;
-- Existing own-profile RLS continues to apply; role privileges stay unchanged.
GRANT INSERT (class_roll_number, section), UPDATE (class_roll_number, section) ON public.profiles TO authenticated;

-- Deleting staff access is reversible and preserves ownership/history.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.class_enrollments ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION public.has_active_account() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND archived_at IS NOT NULL) $$;
REVOKE ALL ON FUNCTION public.has_active_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_account() TO authenticated;
-- A restrictive policy intersects existing ownership rules, it does not grant access.
DO $$ DECLARE target text; BEGIN
FOREACH target IN ARRAY ARRAY['profiles','classes','class_enrollments','class_invitations','attendance_sessions','attendance_records','qr_tokens'] LOOP
EXECUTE format('DROP POLICY IF EXISTS "Active account required" ON public.%I',target);
EXECUTE format('CREATE POLICY "Active account required" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_active_account()) WITH CHECK (public.has_active_account())',target);
END LOOP;
END $$;
