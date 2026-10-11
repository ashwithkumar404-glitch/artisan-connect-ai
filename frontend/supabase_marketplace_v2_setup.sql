-- SQL Migration Script: Marketplace V2 Features (Orders, Reviews, Enquiries, and Rating triggers)
-- Execute this script in your Supabase Dashboard SQL Editor.

-- ==========================================
-- 1. ADD RATING COLUMNS TO PRODUCTS
-- ==========================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- ==========================================
-- 2. CREATE ORDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    shipping_name TEXT NOT NULL,
    shipping_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_pincode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'placed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_order_status CHECK (status IN ('placed', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

-- ==========================================
-- 3. CREATE ORDER_ITEMS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_artisan_id ON public.order_items(artisan_id);

-- ==========================================
-- 4. CREATE PRODUCT_REVIEWS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NULL,
    photo_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure exactly one review per customer purchase (order, product combo)
    CONSTRAINT uq_customer_order_product_review UNIQUE (customer_id, order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON public.product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON public.product_reviews(order_id);

-- ==========================================
-- 5. ALTER ENQUIRIES TABLE
-- ==========================================
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS quantity INTEGER CHECK (quantity > 0);
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS preferred_delivery_date DATE;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2) CHECK (budget >= 0);
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS reference_image_url TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS artisan_response TEXT;

-- Drop old check constraint and recreate with new allowed status states
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS chk_enquiry_status;
ALTER TABLE public.enquiries ADD CONSTRAINT chk_enquiry_status CHECK (
    status IN ('submitted', 'under_review', 'sent_to_artisan', 'responded', 'closed', 'pending', 'read', 'replied')
);

-- ==========================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 7. ORDERS RLS POLICIES
-- ==========================================

-- Helper function to check if order belongs to customer (bypasses order_items -> orders recursion)
CREATE OR REPLACE FUNCTION public.is_customer_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_uuid AND customer_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if order contains items belonging to artisan (bypasses orders -> order_items recursion)
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

-- SELECT Policy
DROP POLICY IF EXISTS select_orders ON public.orders;
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

-- INSERT Policy
DROP POLICY IF EXISTS insert_orders ON public.orders;
CREATE POLICY insert_orders ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid());

-- UPDATE Policy
DROP POLICY IF EXISTS update_orders ON public.orders;
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

-- ==========================================
-- 8. ORDER_ITEMS RLS POLICIES
-- ==========================================

DROP POLICY IF EXISTS select_order_items ON public.order_items;
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

DROP POLICY IF EXISTS insert_order_items ON public.order_items;
CREATE POLICY insert_order_items ON public.order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_customer_order(order_id)
    );

DROP POLICY IF EXISTS update_order_items ON public.order_items;
CREATE POLICY update_order_items ON public.order_items
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        OR
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- ==========================================
-- 9. PRODUCT_REVIEWS RLS POLICIES
-- ==========================================

DROP POLICY IF EXISTS select_product_reviews ON public.product_reviews;
CREATE POLICY select_product_reviews ON public.product_reviews
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS insert_product_reviews ON public.product_reviews;
CREATE POLICY insert_product_reviews ON public.product_reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()
        AND
        order_id IN (
            SELECT id FROM public.orders 
            WHERE customer_id = auth.uid() AND status = 'delivered'
        )
        AND
        product_id IN (
            SELECT product_id FROM public.order_items 
            WHERE order_id = product_reviews.order_id
        )
    );

DROP POLICY IF EXISTS update_product_reviews ON public.product_reviews;
CREATE POLICY update_product_reviews ON public.product_reviews
    FOR UPDATE
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- ==========================================
-- 10. ENQUIRIES RLS POLICIES (UPDATE TO ALLOW ADMINS)
-- ==========================================

DROP POLICY IF EXISTS select_enquiries ON public.enquiries;
CREATE POLICY select_enquiries ON public.enquiries
    FOR SELECT
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS update_enquiries ON public.enquiries;
CREATE POLICY update_enquiries ON public.enquiries
    FOR UPDATE
    TO authenticated
    USING (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- ==========================================
-- 11. TIMESTAMPS TRIGGERS
-- ==========================================

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER update_product_reviews_updated_at
    BEFORE UPDATE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- 12. RATINGS AGGREGATION TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.recalculate_product_ratings()
RETURNS TRIGGER AS $$
DECLARE
    avg_r NUMERIC(3,2);
    cnt_r INTEGER;
    pid UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        pid := OLD.product_id;
    ELSE
        pid := NEW.product_id;
    END IF;

    -- Calculate average and count
    SELECT COALESCE(AVG(rating), 0)::NUMERIC(3,2), COUNT(id)
    INTO avg_r, cnt_r
    FROM public.product_reviews
    WHERE product_id = pid;

    -- Update product table
    UPDATE public.products
    SET average_rating = avg_r,
        review_count = cnt_r
    WHERE id = pid;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_recalculate_product_ratings ON public.product_reviews;
CREATE TRIGGER tr_recalculate_product_ratings
    AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.recalculate_product_ratings();

-- ==========================================
-- 13. STORAGE BUCKET FOR REVIEWS
-- ==========================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read access to review photos" ON storage.objects;
CREATE POLICY "Allow public read access to review photos"
ON storage.objects FOR SELECT USING (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Allow authenticated users to upload review photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload review photos"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Allow users to delete their own review photos" ON storage.objects;
CREATE POLICY "Allow users to delete their own review photos"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'review-photos' AND owner = auth.uid()::text);

-- ==========================================
-- 14. ADMIN PROFILES SELECT ACCESS (RLS RECURSION FIX)
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
