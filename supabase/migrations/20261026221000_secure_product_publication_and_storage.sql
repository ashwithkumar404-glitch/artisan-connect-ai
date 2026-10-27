-- Migration: 20261026221000_secure_product_publication_and_storage.sql
-- Description: Strengthens product insert/update RLS to prevent unapproved artisans from self-publishing,
-- and configures the product-images storage bucket with safe, authenticated upload/delete policies.

-- 1. Tighten insert_products policy
DROP POLICY IF EXISTS insert_products ON public.products;
CREATE POLICY insert_products ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
            AND (
                status IN ('draft', 'pending_review')
                OR (
                    status = 'published' AND artisan_id IN (
                        SELECT id FROM public.artisans WHERE profile_id = auth.uid() AND verification_status = 'approved'
                    )
                )
            )
        )
        OR public.is_admin()
    );

-- 2. Tighten update_products policy
DROP POLICY IF EXISTS update_products ON public.products;
CREATE POLICY update_products ON public.products
    FOR UPDATE
    TO authenticated
    USING (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR public.is_admin()
    )
    WITH CHECK (
        (
            artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
            AND (
                status IN ('draft', 'pending_review', 'out_of_stock')
                OR (
                    status = 'published' AND artisan_id IN (
                        SELECT id FROM public.artisans WHERE profile_id = auth.uid() AND verification_status = 'approved'
                    )
                )
            )
        )
        OR public.is_admin()
    );

-- 3. Configure storage bucket for product-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true, -- public read for marketplace buyers
    5242880, -- 5 MB size limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 4. Storage RLS policies for product-images
-- Public read access allows marketplace buyers to view product images
DROP POLICY IF EXISTS "Allow public read access to product images" ON storage.objects;
CREATE POLICY "Allow public read access to product images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'product-images');

-- Insert policy: Validate folder format before casting to UUID, supporting:
-- 1) artisan.id prefix used by HomePage.jsx and AddProductPage.jsx (artisan.id / productId / filename)
-- 2) auth.uid() prefix for user-scoped uploads
-- 3) admin users
DROP POLICY IF EXISTS "Artisans can upload their own product images" ON storage.objects;
CREATE POLICY "Artisans can upload their own product images" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-images'
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
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );

-- Update policy: Same safe validation for replacing images
DROP POLICY IF EXISTS "Artisans can update their own product images" ON storage.objects;
CREATE POLICY "Artisans can update their own product images" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-images'
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
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );

-- Delete policy: Same safe validation for removing images
DROP POLICY IF EXISTS "Artisans can delete their own product images" ON storage.objects;
CREATE POLICY "Artisans can delete their own product images" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-images'
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
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );

-- 5. Tighten artisan update policy: Prevent artisans from self-elevating verification_status
-- Non-admin artisans can update profile-related fields (business_name, bio, location, specialization, experience_years),
-- but CANNOT change verification_status directly.
CREATE OR REPLACE FUNCTION public.check_artisan_update_restrictions()
RETURNS TRIGGER AS $$
DECLARE
    current_user_role text;
BEGIN
    -- Allow service-role or internal triggers where auth.uid() is null
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch role of calling user
    SELECT role INTO current_user_role FROM public.profiles WHERE id = auth.uid();

    -- Admins have full update rights
    IF current_user_role = 'admin' THEN
        RETURN NEW;
    END IF;

    -- Artisans cannot change verification_status
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
        RAISE EXCEPTION 'Artisans cannot change their own verification status. Verification requires administrator review or internal registry lookup.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_artisan_update_restrictions ON public.artisans;
CREATE TRIGGER tr_check_artisan_update_restrictions
    BEFORE UPDATE ON public.artisans
    FOR EACH ROW
    EXECUTE FUNCTION public.check_artisan_update_restrictions();

