-- ==============================================================================
-- MindCare AI — Migration 005: Ensure Pushpa's Routines are in public.routines
-- Target: Sync breakfast (08:00 AM) and tablets (11:00 AM) alongside dinner & morning routines
-- ==============================================================================

-- 1. Ensure public.routines table structure and constraints
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIME NOT NULL DEFAULT '08:00:00',
  repeat_pattern TEXT NOT NULL DEFAULT 'daily',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Insert the routines for Patient Pushpa (2b4f46e4-f183-4e7f-8097-f12dc10bf021) if not already present
INSERT INTO public.routines (id, patient_id, title, description, scheduled_time, repeat_pattern, enabled, created_at, updated_at)
VALUES
  (
    '525ec6da-4127-422f-85b2-5e7d3222021a',
    '2b4f46e4-f183-4e7f-8097-f12dc10bf021',
    'breakfast',
    'Category: morning',
    '08:00:00',
    'daily',
    true,
    now(),
    now()
  ),
  (
    'ce74e7f4-c832-464d-bb69-03acb845f642',
    '2b4f46e4-f183-4e7f-8097-f12dc10bf021',
    'tablets',
    'Category: afternoon',
    '11:00:00',
    'daily',
    true,
    now(),
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  scheduled_time = EXCLUDED.scheduled_time,
  updated_at = now();

-- 3. RLS Policies for routines table to allow read and write
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow routines select" ON public.routines;
DROP POLICY IF EXISTS "Allow routines insert" ON public.routines;
DROP POLICY IF EXISTS "Allow routines update" ON public.routines;
DROP POLICY IF EXISTS "Allow routines delete" ON public.routines;

CREATE POLICY "Allow routines select" ON public.routines FOR SELECT USING (true);
CREATE POLICY "Allow routines insert" ON public.routines FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow routines update" ON public.routines FOR UPDATE USING (true);
CREATE POLICY "Allow routines delete" ON public.routines FOR DELETE USING (true);
