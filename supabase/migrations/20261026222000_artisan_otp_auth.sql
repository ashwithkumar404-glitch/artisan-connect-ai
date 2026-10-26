-- Migration: 20261026222000_artisan_otp_auth.sql
-- Description: Creates official artisan registry table and rate-limited OTP challenge management table
-- with strict RLS policies protecting phone numbers and preventing unauthorized OTP inspection.

-- 1. Create artisan_registry table (Authorized government / state handicrafts registry)
CREATE TABLE IF NOT EXISTS public.artisan_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    craft_category TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    location_state TEXT NOT NULL DEFAULT 'Karnataka',
    verification_authority TEXT NOT NULL DEFAULT 'Development Commissioner (Handicrafts), Ministry of Textiles',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artisan_registry_id_code ON public.artisan_registry(artisan_id_code);

-- 2. Create artisan_otp_challenges table (Short-lived, salted hash challenges)
CREATE TABLE IF NOT EXISTS public.artisan_otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id_code TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    ip_address TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artisan_otp_challenges_code ON public.artisan_otp_challenges(artisan_id_code);
CREATE INDEX IF NOT EXISTS idx_artisan_otp_challenges_expires ON public.artisan_otp_challenges(expires_at);

-- 3. Enable RLS
ALTER TABLE public.artisan_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_otp_challenges ENABLE ROW LEVEL SECURITY;

-- 4. RLS: Prevent public access to phone numbers & registry records
-- Only admins can select from artisan_registry via direct client queries;
-- Edge Functions access via service_role key to perform server-side lookup & dispatch OTP.
DROP POLICY IF EXISTS "Admins can view artisan registry" ON public.artisan_registry;
CREATE POLICY "Admins can view artisan registry" ON public.artisan_registry
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Challenges table is strictly service_role only (no client SELECT/INSERT/UPDATE)
-- Default deny all client access for artisan_otp_challenges.

-- 5. Seed authorized test registry records for development and testing
INSERT INTO public.artisan_registry (artisan_id_code, full_name, craft_category, phone_number, location_state)
VALUES 
    ('KA-ART-1001', 'Rameshappa Kumbar', 'Pottery', '+919876543210', 'Karnataka'),
    ('KA-ART-1002', 'Sharadamma Nekara', 'Handloom & Textiles', '+919876543211', 'Karnataka'),
    ('KA-ART-1003', 'Mallikarjun Badagi', 'Wood Craft', '+919876543212', 'Karnataka')
ON CONFLICT (artisan_id_code) DO NOTHING;
