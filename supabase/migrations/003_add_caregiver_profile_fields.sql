-- ==============================================================================
-- MindCare AI — Migration 003: Add Caregiver Registration Fields to Profiles Table
-- Target: Include Full Name, Phone Number, Email, Caregiving Relationship, 
--         and Preferred Language in public.profiles table.
-- ==============================================================================

-- 1. Add missing registration fields to public.profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS relationship TEXT,
  ADD COLUMN IF NOT EXISTS caregiving_relationship TEXT;

-- 2. Backfill email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. Synchronize phone and phone_number columns
UPDATE public.profiles
SET phone_number = phone
WHERE phone_number IS NULL AND phone IS NOT NULL;

UPDATE public.profiles
SET phone = phone_number
WHERE phone IS NULL AND phone_number IS NOT NULL;

-- 4. Synchronize relationship and caregiving_relationship columns
UPDATE public.profiles
SET caregiving_relationship = relationship
WHERE caregiving_relationship IS NULL AND relationship IS NOT NULL;

UPDATE public.profiles
SET relationship = caregiving_relationship
WHERE relationship IS NULL AND caregiving_relationship IS NOT NULL;

-- 5. Create index on email for quick lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 6. Update the handle_new_user trigger to save all registration fields automatically
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'MindCare User'),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'relationship', NEW.raw_user_meta_data->>'caregiving_relationship', 'Daughter'),
    COALESCE(NEW.raw_user_meta_data->>'caregiving_relationship', NEW.raw_user_meta_data->>'relationship', 'Daughter'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'caregiver'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'),
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    phone_number = EXCLUDED.phone_number,
    relationship = EXCLUDED.relationship,
    caregiving_relationship = EXCLUDED.caregiving_relationship,
    preferred_language = EXCLUDED.preferred_language,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
