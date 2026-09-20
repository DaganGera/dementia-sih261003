-- MindCare AI: Confirm emails for caregivers in auth.users
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/oxvgkfaserkgddbbfkcm/sql)
-- to permanently confirm existing caregiver emails.

UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email = 'kavinkalanjiam@gmail.com' OR email_confirmed_at IS NULL;
