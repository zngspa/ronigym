CREATE TABLE public.medical_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  expires_on date,
  approved boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual'
);
GRANT SELECT ON public.medical_approval_history TO authenticated;
GRANT ALL ON public.medical_approval_history TO service_role;
ALTER TABLE public.medical_approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach reads own medical history" ON public.medical_approval_history FOR SELECT TO authenticated USING (coach_id = auth.uid() AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.coach_id = auth.uid()));
CREATE INDEX medical_approval_history_student_recorded_idx ON public.medical_approval_history(student_id, recorded_at DESC);
INSERT INTO public.medical_approval_history(student_id, coach_id, expires_on, approved, source)
SELECT id, coach_id, health_approval_expiry, COALESCE(health_approval, false), 'existing' FROM public.students WHERE health_approval IS TRUE OR health_approval_expiry IS NOT NULL;
CREATE OR REPLACE FUNCTION public.record_student_medical_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.health_approval IS NOT TRUE AND NEW.health_approval_expiry IS NULL THEN RETURN NEW; END IF;
  ELSE
    IF NEW.health_approval IS NOT DISTINCT FROM OLD.health_approval AND NEW.health_approval_expiry IS NOT DISTINCT FROM OLD.health_approval_expiry THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.medical_approval_history(student_id, coach_id, expires_on, approved) VALUES (NEW.id, NEW.coach_id, NEW.health_approval_expiry, COALESCE(NEW.health_approval, false));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_student_medical_approval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER student_medical_approval_history AFTER INSERT OR UPDATE OF health_approval, health_approval_expiry ON public.students FOR EACH ROW EXECUTE FUNCTION public.record_student_medical_approval();
COMMENT ON COLUMN public.medical_approval_history.uploaded_at IS 'Actual document upload timestamp only; null for manually entered and pre-existing approvals.';