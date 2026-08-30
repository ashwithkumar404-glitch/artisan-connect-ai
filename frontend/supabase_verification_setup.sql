-- SQL Setup Script for Step 8.9 - Artisan Verification & Admin Approval
-- Creates public.artisan_verifications, private storage bucket config, triggers and RLS policies.

-- 1. Create artisan_verifications table
CREATE TABLE IF NOT EXISTS public.artisan_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE UNIQUE,
    government_id_url TEXT NULL,
    craft_certificate_url TEXT NULL,
    workshop_photo_url TEXT NULL,
    status TEXT NOT NULL DEFAULT 'not_submitted' CONSTRAINT chk_artisan_verifications_status CHECK (status IN ('not_submitted', 'submitted', 'under_review', 'approved', 'rejected')),
    rejection_reason TEXT NULL,
    submitted_at TIMESTAMPTZ NULL,
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_artisan_verifications_artisan_id ON public.artisan_verifications(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_verifications_status ON public.artisan_verifications(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.artisan_verifications ENABLE ROW LEVEL SECURITY;

-- 4. Enable updated_at trigger
DROP TRIGGER IF EXISTS update_artisan_verifications_updated_at ON public.artisan_verifications;
CREATE TRIGGER update_artisan_verifications_updated_at
    BEFORE UPDATE ON public.artisan_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Create trigger to restrict writes for non-admins
CREATE OR REPLACE FUNCTION public.check_artisan_verification_write_restrictions()
RETURNS TRIGGER AS $$
DECLARE
    user_role text;
BEGIN
    -- Fetch the role of the authenticated user
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();

    -- If the user is an admin, allow all modifications
    IF user_role = 'admin' THEN
        RETURN NEW;
    END IF;

    -- If the user is NOT an admin, they must be an artisan modifying their own record
    -- 1. Enforce they cannot change status to approved, rejected, or under_review
    IF NEW.status IN ('approved', 'rejected', 'under_review') AND (OLD IS NULL OR NEW.status <> OLD.status) THEN
        RAISE EXCEPTION 'Artisans cannot approve, reject, or set their own verification status to under_review';
    END IF;

    -- 2. Enforce they cannot modify reviewed_by, rejection_reason, reviewed_at
    IF OLD IS NOT NULL THEN
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
            RAISE EXCEPTION 'Artisans cannot modify reviewed_by';
        END IF;
        IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
            RAISE EXCEPTION 'Artisans cannot modify rejection_reason';
        END IF;
        IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
            RAISE EXCEPTION 'Artisans cannot modify reviewed_at';
        END IF;
    ELSE
        -- For inserts, non-admins cannot set these fields
        IF NEW.reviewed_by IS NOT NULL OR NEW.rejection_reason IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
            RAISE EXCEPTION 'Artisans cannot set admin review fields on insert';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_artisan_verification_write_restrictions ON public.artisan_verifications;
CREATE TRIGGER tr_check_artisan_verification_write_restrictions
    BEFORE INSERT OR UPDATE ON public.artisan_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.check_artisan_verification_write_restrictions();

-- 6. Sync status to public.artisans.verification_status
CREATE OR REPLACE FUNCTION public.sync_artisan_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.artisans
    SET verification_status = 
        CASE 
            WHEN NEW.status = 'approved' THEN 'approved'::text
            WHEN NEW.status = 'rejected' THEN 'rejected'::text
            WHEN NEW.status = 'under_review' THEN 'under_review'::text
            WHEN NEW.status = 'submitted' THEN 'under_review'::text
            ELSE 'pending'::text
        END,
        updated_at = now()
    WHERE id = NEW.artisan_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_artisan_verification_status ON public.artisan_verifications;
CREATE TRIGGER tr_sync_artisan_verification_status
    AFTER INSERT OR UPDATE OF status ON public.artisan_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_artisan_verification_status();

-- 7. RLS policies for public.artisan_verifications
DROP POLICY IF EXISTS select_artisan_verifications ON public.artisan_verifications;
CREATE POLICY select_artisan_verifications ON public.artisan_verifications
    FOR SELECT
    TO authenticated
    USING (
        artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS insert_artisan_verifications ON public.artisan_verifications;
CREATE POLICY insert_artisan_verifications ON public.artisan_verifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
    );

DROP POLICY IF EXISTS update_artisan_verifications ON public.artisan_verifications;
CREATE POLICY update_artisan_verifications ON public.artisan_verifications
    FOR UPDATE
    TO authenticated
    USING (
        (artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid()) AND status <> 'approved')
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 8. Storage bucket setup for artisan-verification
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'artisan-verification',
    'artisan-verification',
    false, -- private bucket
    5242880, -- 5 MB size limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 9. Storage RLS policies for artisan-verification
DROP POLICY IF EXISTS "Artisans can insert their own verification files" ON storage.objects;
CREATE POLICY "Artisans can insert their own verification files" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'artisan-verification'
        AND
        (storage.foldername(name))[1]::uuid IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Artisans can read their own verification files" ON storage.objects;
CREATE POLICY "Artisans can read their own verification files" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'artisan-verification'
        AND (
            (storage.foldername(name))[1]::uuid IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
            OR
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    );

DROP POLICY IF EXISTS "Artisans can delete their own verification files" ON storage.objects;
CREATE POLICY "Artisans can delete their own verification files" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'artisan-verification'
        AND
        (storage.foldername(name))[1]::uuid IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- 10. Update product selection policy for verification dependency
DROP POLICY IF EXISTS select_products ON public.products;
CREATE POLICY select_products ON public.products
    FOR SELECT
    USING (
        (status = 'published' AND artisan_id IN (
            SELECT id FROM public.artisans WHERE verification_status = 'approved'
        ))
        OR 
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
