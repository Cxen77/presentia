-- Migration 007: faculty must see enrollments for their own classes.
--
-- Symptom: the faculty portal's direct database reads reported 0 enrollments
-- even for classes with enrolled students (the backend path was unaffected
-- because the service role bypasses row-level security). The live database was
-- missing the faculty-side SELECT policy on class_enrollments.
-- Idempotent: safe to run whether or not an earlier variant exists.

DROP POLICY IF EXISTS "Faculty can view enrollments for own classes" ON public.class_enrollments;

CREATE POLICY "Faculty can view enrollments for own classes"
    ON public.class_enrollments FOR SELECT
    TO authenticated
    USING (
      class_id IN (
        SELECT c.id FROM public.classes c
        WHERE c.faculty_id IN (
          SELECT p.id FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
      )
    );
