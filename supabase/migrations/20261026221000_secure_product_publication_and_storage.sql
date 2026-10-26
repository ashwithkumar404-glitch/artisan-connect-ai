-- Migration: 20261026221000_secure_product_publication_and_storage.sql
-- Description: Strengthens product insert/update RLS to prevent unapproved artisans from self-publishing,
-- and configures the product-images storage bucket with authenticated upload policies.

-- 1. Tighten insert_products policy
DROP POLICY IF EXISTS insert_products ON public.products;
CREATE POLICY insert_products ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
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
DROP POLICY IF EXISTS "Allow public read access to product images" ON storage.objects;
CREATE POLICY "Allow public read access to product images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Artisans can upload their own product images" ON storage.objects;
CREATE POLICY "Artisans can upload their own product images" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-images'
        AND (
            (storage.foldername(name))[1]::uuid IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Artisans can delete their own product images" ON storage.objects;
CREATE POLICY "Artisans can delete their own product images" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND (
            (storage.foldername(name))[1]::uuid IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
            OR
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            public.is_admin()
        )
    );
