-- SQL Migration Script: Admin Orders RLS and Profiles SELECT Access (Circular Recursion Fix)
-- Run this script in your Supabase Dashboard -> SQL Editor.

-- IMPORTANT: If you receive a "must be owner of relation orders" error when running this,
-- execute: RESET ROLE; or SET ROLE postgres; in your SQL Editor first, then run this.

-- 1. Helper function for admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper function to check if order belongs to customer (bypasses order_items -> orders recursion)
CREATE OR REPLACE FUNCTION public.is_customer_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_uuid AND customer_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper function to check if order contains items belonging to artisan (bypasses orders -> order_items recursion)
CREATE OR REPLACE FUNCTION public.is_artisan_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.artisans a ON oi.artisan_id = a.id
        WHERE oi.order_id = order_uuid AND a.profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update SELECT policy for profiles to allow admins to read customer profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read of artisan profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated read of profiles" ON public.profiles;

CREATE POLICY "Allow authenticated read of profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR
    role = 'artisan'
    OR
    public.is_admin()
);

-- 5. Clean up old/problematic policies on public.orders
DROP POLICY IF EXISTS customers_can_create_orders ON public.orders;
DROP POLICY IF EXISTS customers_can_view_own_orders ON public.orders;
DROP POLICY IF EXISTS select_orders ON public.orders;
DROP POLICY IF EXISTS update_orders ON public.orders;
DROP POLICY IF EXISTS insert_orders ON public.orders;

-- 6. Recreate orders policies using non-recursive security definer functions
CREATE POLICY select_orders ON public.orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR
        public.is_admin()
        OR
        public.is_artisan_order(id)
    );

CREATE POLICY insert_orders ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY update_orders ON public.orders
    FOR UPDATE
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR
        public.is_admin()
        OR
        public.is_artisan_order(id)
    )
    WITH CHECK (
        customer_id = auth.uid()
        OR
        public.is_admin()
        OR
        public.is_artisan_order(id)
    );

-- 7. Clean up old/problematic policies on public.order_items
DROP POLICY IF EXISTS customers_can_create_order_items ON public.order_items;
DROP POLICY IF EXISTS customers_can_view_order_items ON public.order_items;
DROP POLICY IF EXISTS select_order_items ON public.order_items;
DROP POLICY IF EXISTS insert_order_items ON public.order_items;

-- 8. Recreate order_items policies using non-recursive security definer functions
CREATE POLICY select_order_items ON public.order_items
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR
        artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
        OR
        public.is_customer_order(order_id)
    );

CREATE POLICY insert_order_items ON public.order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_customer_order(order_id)
    );
