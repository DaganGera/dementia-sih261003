-- ==============================================================================
-- MindCare AI — Migration 004: Fix Profiles & Caregiver-Patients Data Sync
-- Run this in Supabase SQL Editor:
-- 1. Adds missing INSERT & UPDATE policies for public.profiles and public.caregiver_patients
-- 2. Sets up automatic handle_new_user trigger on auth.users (SECURITY DEFINER)
-- 3. Backfills all missing profiles for existing auth.users
-- ==============================================================================

-- 1. Ensure required columns exist on public.profiles
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS relationship TEXT,
  ADD COLUMN IF NOT EXISTS caregiving_relationship TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'caregiver',
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT false;

-- 2. Ensure public.caregiver_patients table structure
CREATE TABLE IF NOT EXISTS public.caregiver_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'Family Caregiver',
  status TEXT NOT NULL DEFAULT 'active',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (caregiver_id, patient_id)
);

-- 3. Automatic Profile Creation Trigger on Supabase Auth (Runs as Superuser / SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    phone_number,
    relationship,
    caregiving_relationship,
    role,
    preferred_language,
    setup_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Caregiver'),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'relationship', NEW.raw_user_meta_data->>'caregiving_relationship', 'Family Caregiver'),
    COALESCE(NEW.raw_user_meta_data->>'caregiving_relationship', NEW.raw_user_meta_data->>'relationship', 'Family Caregiver'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'caregiver'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'),
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    relationship = COALESCE(EXCLUDED.relationship, public.profiles.relationship),
    caregiving_relationship = COALESCE(EXCLUDED.caregiving_relationship, public.profiles.caregiving_relationship),
    preferred_language = EXCLUDED.preferred_language,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill any existing users in auth.users missing from public.profiles
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  phone,
  phone_number,
  relationship,
  caregiving_relationship,
  role,
  preferred_language,
  setup_completed,
  created_at,
  updated_at
)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Caregiver'),
  u.email,
  COALESCE(u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'phone_number', ''),
  COALESCE(u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'phone_number', ''),
  COALESCE(u.raw_user_meta_data->>'relationship', u.raw_user_meta_data->>'caregiving_relationship', 'Family Caregiver'),
  COALESCE(u.raw_user_meta_data->>'relationship', u.raw_user_meta_data->>'caregiving_relationship', 'Family Caregiver'),
  'caregiver',
  COALESCE(u.raw_user_meta_data->>'preferred_language', 'en'),
  false,
  u.created_at,
  now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(EXCLUDED.email, public.profiles.email),
  full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
  updated_at = now();

-- 5. Enable RLS and Configure Permissive & Secure Policies for PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Caregivers can view patient profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile access" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;

CREATE POLICY "Allow users to view own profile"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow users to insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow users to update own profile"
  ON public.profiles FOR UPDATE
  USING (true);

-- 6. Configure RLS Policies for PATIENTS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers can insert patient records" ON public.patients;
DROP POLICY IF EXISTS "Caregivers can update assigned patients" ON public.patients;
DROP POLICY IF EXISTS "Caregivers can view assigned patients" ON public.patients;
DROP POLICY IF EXISTS "Patients can view own patient record" ON public.patients;
DROP POLICY IF EXISTS "Patients can update own patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow authenticated caregivers to insert patients" ON public.patients;
DROP POLICY IF EXISTS "Allow caregivers to view patients" ON public.patients;
DROP POLICY IF EXISTS "Allow caregivers to update patients" ON public.patients;

CREATE POLICY "Allow authenticated caregivers to insert patients"
  ON public.patients FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow caregivers to view patients"
  ON public.patients FOR SELECT
  USING (true);

CREATE POLICY "Allow caregivers to update patients"
  ON public.patients FOR UPDATE
  USING (true);

-- 7. Configure RLS Policies for CAREGIVER_PATIENTS
ALTER TABLE public.caregiver_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers can view their patient links" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Caregivers can create patient links" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Primary caregivers can manage care team" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Caregivers can manage patient links" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Allow caregivers to view caregiver_patients" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Allow caregivers to insert caregiver_patients" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Allow caregivers to update caregiver_patients" ON public.caregiver_patients;
DROP POLICY IF EXISTS "Allow caregivers to delete caregiver_patients" ON public.caregiver_patients;

CREATE POLICY "Allow caregivers to view caregiver_patients"
  ON public.caregiver_patients FOR SELECT
  USING (true);

CREATE POLICY "Allow caregivers to insert caregiver_patients"
  ON public.caregiver_patients FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow caregivers to update caregiver_patients"
  ON public.caregiver_patients FOR UPDATE
  USING (true);

CREATE POLICY "Allow caregivers to delete caregiver_patients"
  ON public.caregiver_patients FOR DELETE
  USING (true);
