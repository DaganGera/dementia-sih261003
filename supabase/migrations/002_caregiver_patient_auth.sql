-- MindCare AI — Migration 002: Caregiver & Patient Authentication, Setup Status, and Care Team

-- 1. Add setup_completed to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT false;

-- 2. Update caregiver_patients table for Care Team & Primary Caregiver support
ALTER TABLE public.caregiver_patients 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Create index for active caregiver relationships
CREATE INDEX IF NOT EXISTS idx_caregiver_patients_active 
  ON public.caregiver_patients(caregiver_id, patient_id) 
  WHERE status = 'active';

-- 4. Auto-update timestamp trigger for caregiver_patients
CREATE OR REPLACE TRIGGER tr_caregiver_patients_updated_at
  BEFORE UPDATE ON public.caregiver_patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Updated RLS Security Function: Verify Caregiver has ACTIVE link
CREATE OR REPLACE FUNCTION public.is_caregiver_for_patient(target_patient_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.caregiver_patients
    WHERE caregiver_id = auth.uid()
      AND patient_id = target_patient_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Caregivers can invite/link other caregivers if they are primary
CREATE POLICY "Primary caregivers can manage care team"
  ON public.caregiver_patients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patients cp
      WHERE cp.patient_id = public.caregiver_patients.patient_id
        AND cp.caregiver_id = auth.uid()
        AND cp.is_primary = true
        AND cp.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.caregiver_patients cp
      WHERE cp.patient_id = public.caregiver_patients.patient_id
        AND cp.caregiver_id = auth.uid()
        AND cp.is_primary = true
        AND cp.status = 'active'
    )
  );
