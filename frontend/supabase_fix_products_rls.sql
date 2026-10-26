-- Migration: Fix products RLS policies for artisan product creation and updates
-- File: frontend/supabase_fix_products_rls.sql
-- Description:
-- Fixes the RLS error: "new row violates row-level security policy for table 'products'".
--
-- ROOT CAUSE:
-- The previous `insert_products` policy contained a restrictive status check:
--   WITH CHECK (artisan_id IN (...) AND status IN ('draft', 'pending_review'))
-- When verified artisans published a product directly from NewProduct (status = 'published'),
-- the WITH CHECK condition evaluated to false, causing PostgreSQL to reject the INSERT with
-- error 42501 (row-level security policy violation).
--
-- FIX:
-- 1. Correct INSERT policy (`insert_products`):
--    Ensure authenticated artisans can insert products strictly under their own account
--    (artisan_id matching their profile_id = auth.uid()), supporting both 'draft' and 'published' statuses.
-- 2. Verify UPDATE policy (`update_products`):
--    Allow authenticated artisans to update their own products (and admins via is_admin()).

-- 1. Fix insert_products policy
DROP POLICY IF EXISTS insert_products ON public.products;
CREATE POLICY insert_products ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- 2. Ensure update_products policy allows artisans to edit their own products
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
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        public.is_admin()
    );
