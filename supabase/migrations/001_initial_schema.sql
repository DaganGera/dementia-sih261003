-- MindCare AI — Complete PostgreSQL Schema Migration for Supabase
-- Target: SIH 2026 AI Cognitive Gaming & Memory Assistance Platform for Elderly Dementia Patients

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Clean Existing Objects (for idempotent execution)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- 3. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  phone_number TEXT,
  relationship TEXT,
  caregiving_relationship TEXT,
  role TEXT NOT NULL CHECK (role IN ('elderly', 'patient', 'caregiver', 'admin')),
  preferred_language TEXT NOT NULL DEFAULT 'en',
  setup_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  medical_history TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Caregiver-Patient Relationship Table
CREATE TABLE IF NOT EXISTS public.caregiver_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'Family Caregiver',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (caregiver_id, patient_id)
);

-- 6. Cognitive Game Attempts Table
CREATE TABLE IF NOT EXISTS public.game_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Cognitive Profiles Table
CREATE TABLE IF NOT EXISTS public.cognitive_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  average_accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  recent_accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  games_completed INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  memory_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  attention_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  recall_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Personal Memory Assistant Table
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  content TEXT,
  person_name TEXT,
  place_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Routines Table
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIME NOT NULL DEFAULT '09:00:00',
  repeat_pattern TEXT NOT NULL DEFAULT 'daily',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Alerts Table (SOS & Accuracy alerts)
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SOS',
  source TEXT NOT NULL CHECK (source IN ('accuracy', 'manual')),
  level TEXT NOT NULL CHECK (level IN ('caution', 'sos', 'none')),
  accuracy NUMERIC(5, 2),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- 11. Indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_patients_cg ON public.caregiver_patients(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_patients_pat ON public.caregiver_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_game_attempts_pat ON public.game_attempts(patient_id);
CREATE INDEX IF NOT EXISTS idx_game_attempts_type ON public.game_attempts(game_type);
CREATE INDEX IF NOT EXISTS idx_game_attempts_created ON public.game_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON public.alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON public.alerts(level);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON public.alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_memories_patient ON public.memories(patient_id);
CREATE INDEX IF NOT EXISTS idx_routines_patient ON public.routines(patient_id);

-- 12. Auto-Update Timestamp Function & Triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER tr_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER tr_memories_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER tr_routines_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 13. Auto Create Profile on Auth Signup Trigger
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
    preferred_language
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'MindCare User'),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number'),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone'),
    COALESCE(NEW.raw_user_meta_data->>'relationship', NEW.raw_user_meta_data->>'caregiving_relationship'),
    COALESCE(NEW.raw_user_meta_data->>'caregiving_relationship', NEW.raw_user_meta_data->>'relationship'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'caregiver'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    relationship = COALESCE(EXCLUDED.relationship, public.profiles.relationship),
    caregiving_relationship = COALESCE(EXCLUDED.caregiving_relationship, public.profiles.caregiving_relationship),
    preferred_language = EXCLUDED.preferred_language,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. Helper Security Functions for Row Level Security
CREATE OR REPLACE FUNCTION public.is_caregiver_for_patient(target_patient_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.caregiver_patients
    WHERE caregiver_id = auth.uid()
      AND patient_id = target_patient_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_patient_self(target_patient_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = target_patient_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 15. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- 16. RLS Policies

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Caregivers can view patient profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.caregiver_patients cp ON cp.patient_id = p.id
      WHERE p.user_id = public.profiles.id
        AND cp.caregiver_id = auth.uid()
    )
  );

-- Patients Policies
CREATE POLICY "Patients can view own patient record"
  ON public.patients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Patients can update own patient record"
  ON public.patients FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Caregivers can view assigned patients"
  ON public.patients FOR SELECT
  USING (public.is_caregiver_for_patient(id));

CREATE POLICY "Caregivers can insert patient records"
  ON public.patients FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Caregivers can update assigned patients"
  ON public.patients FOR UPDATE
  USING (public.is_caregiver_for_patient(id));

-- Caregiver-Patients Policies
CREATE POLICY "Caregivers can view their patient links"
  ON public.caregiver_patients FOR SELECT
  USING (caregiver_id = auth.uid());

CREATE POLICY "Caregivers can create patient links"
  ON public.caregiver_patients FOR INSERT
  WITH CHECK (caregiver_id = auth.uid());

-- Game Attempts Policies
CREATE POLICY "Patients can view and insert own attempts"
  ON public.game_attempts FOR ALL
  USING (public.is_patient_self(patient_id))
  WITH CHECK (public.is_patient_self(patient_id));

CREATE POLICY "Caregivers can view assigned patient game attempts"
  ON public.game_attempts FOR SELECT
  USING (public.is_caregiver_for_patient(patient_id));

CREATE POLICY "Allow insert attempts with valid device token or session"
  ON public.game_attempts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      public.is_patient_self(patient_id) OR
      public.is_caregiver_for_patient(patient_id)
    )
  );

-- Cognitive Profiles Policies
CREATE POLICY "Patients can view own cognitive profile"
  ON public.cognitive_profiles FOR SELECT
  USING (public.is_patient_self(patient_id));

CREATE POLICY "Caregivers can view assigned patient cognitive profiles"
  ON public.cognitive_profiles FOR SELECT
  USING (public.is_caregiver_for_patient(patient_id));

CREATE POLICY "Allow upsert of cognitive profiles for authorized users"
  ON public.cognitive_profiles FOR ALL
  USING (public.is_patient_self(patient_id) OR public.is_caregiver_for_patient(patient_id))
  WITH CHECK (public.is_patient_self(patient_id) OR public.is_caregiver_for_patient(patient_id));

-- Memories Policies
CREATE POLICY "Patients can view and manage their own memories"
  ON public.memories FOR ALL
  USING (public.is_patient_self(patient_id))
  WITH CHECK (public.is_patient_self(patient_id));

CREATE POLICY "Caregivers can view and manage assigned patient memories"
  ON public.memories FOR ALL
  USING (public.is_caregiver_for_patient(patient_id))
  WITH CHECK (public.is_caregiver_for_patient(patient_id));

-- Routines Policies
CREATE POLICY "Patients can view their own routines"
  ON public.routines FOR SELECT
  USING (public.is_patient_self(patient_id));

CREATE POLICY "Caregivers can view and manage assigned patient routines"
  ON public.routines FOR ALL
  USING (public.is_caregiver_for_patient(patient_id))
  WITH CHECK (public.is_caregiver_for_patient(patient_id));

-- Alerts Policies (Critical for Realtime SOS delivery)
CREATE POLICY "Patients can view own alerts"
  ON public.alerts FOR SELECT
  USING (public.is_patient_self(patient_id));

CREATE POLICY "Patients can insert SOS alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Caregivers can view assigned patient alerts"
  ON public.alerts FOR SELECT
  USING (public.is_caregiver_for_patient(patient_id));

CREATE POLICY "Caregivers can update alert status (acknowledge, resolve)"
  ON public.alerts FOR UPDATE
  USING (public.is_caregiver_for_patient(patient_id));

-- 17. Enable Supabase Realtime Replication on relevant tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_attempts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_attempts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cognitive_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cognitive_profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'memories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'routines'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.routines;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Publication might not exist in non-Supabase local test environments
END $$;

-- 18. Safe Demo Seed Data
-- Demo Patient ID: 00000000-0000-0000-0000-000000000001
-- Demo Caregiver ID: 00000000-0000-0000-0000-000000000002
INSERT INTO public.patients (
  id, full_name, date_of_birth, gender, preferred_language,
  medical_history, emergency_contact_name, emergency_contact_phone
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Meena Sharma',
  '1954-04-12',
  'Female',
  'as',
  'Mild Cognitive Impairment (MCI) diagnosed in 2025. Prescribed Donepezil 5mg once daily. Responds well to familiar family photos.',
  'Anitha Sharma (Daughter)',
  '+91 98765 43210'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cognitive_profiles (
  patient_id, average_accuracy, recent_accuracy, games_completed,
  current_level, memory_score, attention_score, recall_score, consistency_score
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  74.50, 72.00, 18, 2, 72.00, 61.00, 53.00, 80.00
)
ON CONFLICT (patient_id) DO NOTHING;

INSERT INTO public.memories (patient_id, category, title, content, person_name, place_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'family', 'Anitha (Daughter)', 'Anitha brings morning tea and assists with the garden every weekend.', 'Anitha Sharma', NULL),
  ('00000000-0000-0000-0000-000000000001', 'place', 'Tezpur Home Garden', 'Favorite tea garden spot where flowering orchids bloom in spring.', NULL, 'Tezpur Family Garden'),
  ('00000000-0000-0000-0000-000000000001', 'routine', 'Morning Walk & Bhajan', '30 minutes gentle garden walk followed by favorite morning devotional songs.', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.routines (patient_id, title, description, scheduled_time, repeat_pattern, enabled)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Morning Donepezil Medication', 'Take 1 tablet with lukewarm water after breakfast', '08:30:00', 'daily', true),
  ('00000000-0000-0000-0000-000000000001', 'Cognitive Game Training', 'Play Memory Match and Family Recall games in Assamese', '10:30:00', 'daily', true),
  ('00000000-0000-0000-0000-000000000001', 'Evening Hydration & Tea', 'Warm chamomile tea with daughter Anitha', '17:00:00', 'daily', true)
ON CONFLICT DO NOTHING;
