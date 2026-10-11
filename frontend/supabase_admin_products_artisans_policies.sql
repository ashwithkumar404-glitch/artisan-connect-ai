-- SQL Migration Script: Admin Product & Artisan RLS Policies
-- Run this script in your Supabase Dashboard -> SQL Editor.

-- IMPORTANT: If you receive a permissions error when running this,
-- execute: RESET ROLE; or SET ROLE postgres; in your SQL Editor first, then run this.

-- 1. Enable admin read on public.artisans
DROP POLICY IF EXISTS "Allow admins to read all artisans" ON public.artisans;
CREATE POLICY "Allow admins to read all artisans"
ON public.artisans
FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    OR
    public.is_admin()
);

-- 2. Enable admin select and update on public.products
DROP POLICY IF EXISTS select_products ON public.products;
CREATE POLICY select_products ON public.products
    FOR SELECT
    USING (
        status = 'published'
        OR 
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        public.is_admin()
    );

DROP POLICY IF EXISTS update_products ON public.products;
CREATE POLICY update_products ON public.products
    FOR UPDATE
    TO authenticated
    USING (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        public.is_admin()
    )
    WITH CHECK (
        (
            artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
            AND
            status IN ('draft', 'pending_review', 'out_of_stock')
        )
        OR
        public.is_admin()
    );

-- 3. Enable admin select on public.product_images
DROP POLICY IF EXISTS select_product_images ON public.product_images;
CREATE POLICY select_product_images ON public.product_images
    FOR SELECT
    USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE status = 'published'
            OR
            artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
        )
        OR
        public.is_admin()
    );

-- 4. Enable admin select on public.artisan_verifications (using is_admin function to avoid recursion)
DROP POLICY IF EXISTS select_artisan_verifications ON public.artisan_verifications;
CREATE POLICY select_artisan_verifications ON public.artisan_verifications
    FOR SELECT
    TO authenticated
    USING (
        artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
        OR
        public.is_admin()
    );

DROP POLICY IF EXISTS update_artisan_verifications ON public.artisan_verifications;
CREATE POLICY update_artisan_verifications ON public.artisan_verifications
    FOR UPDATE
    TO authenticated
    USING (
        (artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid()) AND status <> 'approved')
        OR
        public.is_admin()
    );

-- 5. Ensure product reviews are readable by everyone (public reviews)
DROP POLICY IF EXISTS select_product_reviews ON public.product_reviews;
CREATE POLICY select_product_reviews ON public.product_reviews
    FOR SELECT
    TO authenticated, anon
    USING (
        true
    );
