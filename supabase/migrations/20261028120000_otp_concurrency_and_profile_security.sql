-- Migration: 20261028120000_otp_concurrency_and_profile_security.sql
-- Description: Reconciles existing databases, hardens profile roles, provides atomic OTP concurrency primitives,
-- and configures storage policies for artisan-verification and review-photos.

-- ============================================================================
-- 1. HARDEN SECURITY DEFINER FUNCTIONS & ADMIN PRIVILEGES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Prevent non-admins from self-assigning admin role upon registration
CREATE OR REPLACE FUNCTION public.check_profile_role_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'admin' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Cannot self-assign admin role on registration.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_check_profile_role_insert ON public.profiles;
CREATE TRIGGER tr_check_profile_role_insert
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_role_insert();

-- Ensure profile role cannot be modified by non-admin users upon update
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Users cannot alter their own role. Administrator privileges required.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_check_profile_role_update ON public.profiles;
CREATE TRIGGER tr_check_profile_role_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_role_update();

-- ============================================================================
-- 2. ATOMIC OTP CONCURRENCY & TRANSACTION ISOLATION PRIMITIVES
-- ============================================================================

-- Function: create_otp_challenge (Atomic Rate Limit Check & Challenge Creation)
-- Uses transaction-scoped advisory lock on artisan ID hash to serialize concurrent requests per artisan.
CREATE OR REPLACE FUNCTION public.create_otp_challenge(
    p_artisan_id_code TEXT,
    p_phone_number TEXT,
    p_otp_hash TEXT,
    p_expires_at TIMESTAMPTZ,
    p_max_attempts INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
    v_recent_count INTEGER;
    v_challenge_id UUID;
BEGIN
    -- Acquire transaction-level advisory lock to serialize concurrent requests per artisan
    PERFORM pg_advisory_xact_lock(hashtext(p_artisan_id_code));

    -- Rate limiting check: maximum 3 challenge requests per 60 seconds
    SELECT COUNT(*) INTO v_recent_count
    FROM public.artisan_otp_challenges
    WHERE artisan_id_code = p_artisan_id_code
      AND created_at > (now() - INTERVAL '60 seconds');

    IF v_recent_count >= 3 THEN
        RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Maximum 3 OTP requests allowed per 60 seconds.';
    END IF;

    -- Insert new challenge atomically
    INSERT INTO public.artisan_otp_challenges (
        artisan_id_code,
        phone_number,
        otp_hash,
        expires_at,
        max_attempts,
        attempts
    ) VALUES (
        p_artisan_id_code,
        p_phone_number,
        p_otp_hash,
        p_expires_at,
        p_max_attempts,
        0
    ) RETURNING id INTO v_challenge_id;

    RETURN v_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: verify_otp_challenge (Unified Atomic Verification with Row Lock)
-- Locks challenge row exclusively (FOR UPDATE), checks expiry/attempt limits,
-- verifies candidate hash, consumes valid code, or atomically increments attempts.
CREATE OR REPLACE FUNCTION public.verify_otp_challenge(
    p_challenge_id UUID,
    p_artisan_id_code TEXT,
    p_candidate_hash TEXT
)
RETURNS TABLE (
    status TEXT,
    remaining_attempts INTEGER,
    message TEXT
) AS $$
DECLARE
    v_challenge RECORD;
    v_next_attempts INTEGER;
BEGIN
    -- Query and lock the challenge row exclusively for this transaction
    SELECT * INTO v_challenge
    FROM public.artisan_otp_challenges
    WHERE id = p_challenge_id
      AND artisan_id_code = p_artisan_id_code
    FOR UPDATE;

    -- 1. Not Found
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'not_found'::TEXT, 0::INTEGER, 'OTP challenge not found.'::TEXT;
        RETURN;
    END IF;

    -- 2. Already verified (Single-Use Replay Prevention)
    IF v_challenge.verified_at IS NOT NULL THEN
        RETURN QUERY SELECT 'already_verified'::TEXT, 0::INTEGER, 'OTP has already been used. Please request a new code.'::TEXT;
        RETURN;
    END IF;

    -- 3. Expired
    IF v_challenge.expires_at <= now() THEN
        RETURN QUERY SELECT 'expired'::TEXT, 0::INTEGER, 'OTP has expired. Please request a new code.'::TEXT;
        RETURN;
    END IF;

    -- 4. Maximum attempts already exceeded
    IF v_challenge.attempts >= v_challenge.max_attempts THEN
        RETURN QUERY SELECT 'max_attempts_exceeded'::TEXT, 0::INTEGER, 'Maximum verification attempts exceeded. Please request a new OTP.'::TEXT;
        RETURN;
    END IF;

    -- 5. Code comparison
    IF v_challenge.otp_hash = p_candidate_hash THEN
        -- Mark as verified immediately within the locked row
        UPDATE public.artisan_otp_challenges
        SET verified_at = now()
        WHERE id = p_challenge_id;

        RETURN QUERY SELECT 'verified'::TEXT, (v_challenge.max_attempts - v_challenge.attempts)::INTEGER, 'Verification successful.'::TEXT;
        RETURN;
    ELSE
        -- Atomic failed attempt increment
        v_next_attempts := v_challenge.attempts + 1;
        UPDATE public.artisan_otp_challenges
        SET attempts = v_next_attempts
        WHERE id = p_challenge_id;

        IF v_next_attempts >= v_challenge.max_attempts THEN
            RETURN QUERY SELECT 'max_attempts_exceeded'::TEXT, 0::INTEGER, 'Maximum verification attempts exceeded. Please request a new OTP.'::TEXT;
        ELSE
            RETURN QUERY SELECT 'invalid_otp'::TEXT, (v_challenge.max_attempts - v_next_attempts)::INTEGER, ('Invalid OTP. ' || (v_challenge.max_attempts - v_next_attempts) || ' attempts remaining.')::TEXT;
        END IF;
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Strict permissions: Only service_role can invoke OTP state mutators
REVOKE EXECUTE ON FUNCTION public.create_otp_challenge(TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_otp_challenge(UUID, TEXT, TEXT) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_otp_challenge(TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_otp_challenge(UUID, TEXT, TEXT) TO service_role;

-- ============================================================================
-- 3. STORAGE RLS POLICIES FOR ARTISAN-VERIFICATION & REVIEW-PHOTOS
-- ============================================================================

-- Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('artisan-verification', 'artisan-verification', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    ('review-photos', 'review-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 5242880;

-- A. artisan-verification (PRIVATE bucket: Only owner artisan or admin can read/write)
DROP POLICY IF EXISTS "Artisans can insert their own verification files" ON storage.objects;
CREATE POLICY "Artisans can insert their own verification files" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'artisan-verification'
        AND (
            (
                CASE
                    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid IN (
                        SELECT id FROM public.artisans WHERE profile_id = auth.uid()
                    )
                    ELSE false
                END
            )
            OR public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Artisans can read their own verification files" ON storage.objects;
CREATE POLICY "Artisans can read their own verification files" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'artisan-verification'
        AND (
            (
                CASE
                    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid IN (
                        SELECT id FROM public.artisans WHERE profile_id = auth.uid()
                    )
                    ELSE false
                END
            )
            OR public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Artisans can delete their own verification files" ON storage.objects;
CREATE POLICY "Artisans can delete their own verification files" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'artisan-verification'
        AND (
            (
                CASE
                    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid IN (
                        SELECT id FROM public.artisans WHERE profile_id = auth.uid()
                    )
                    ELSE false
                END
            )
            OR public.is_admin()
        )
    );

-- B. review-photos (PUBLIC bucket: Public read, authenticated user-scoped insert/delete)
DROP POLICY IF EXISTS "Allow public read access to review photos" ON storage.objects;
CREATE POLICY "Allow public read access to review photos" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Allow authenticated users to upload review photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload review photos" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'review-photos'
        AND (
            -- Supports folder conventions: reviews/<userId>/... or enquiries/<userId>/... or <userId>/...
            ((storage.foldername(name))[1] IN ('reviews', 'enquiries') AND (storage.foldername(name))[2] = auth.uid()::text)
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Allow users to delete their own review photos" ON storage.objects;
CREATE POLICY "Allow users to delete their own review photos" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'review-photos'
        AND (
            ((storage.foldername(name))[1] IN ('reviews', 'enquiries') AND (storage.foldername(name))[2] = auth.uid()::text)
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );
