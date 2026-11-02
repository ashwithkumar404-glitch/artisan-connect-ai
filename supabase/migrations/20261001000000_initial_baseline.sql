-- Migration: 20261001000000_initial_baseline.sql
-- Description: Baseline schema definition for Artisan Connect AI.
-- Establishes core tables, functions, triggers, indexes, storage buckets, and RLS policies
-- required prior to subsequent feature migrations. Fully idempotent for existing databases.

-- ============================================================================
-- 1. UTILITY FUNCTIONS & ROLE PROTECTION TRIGGERS
-- ============================================================================

-- Generic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Secure admin authorization check (SECURITY DEFINER with strict search_path)
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

-- ============================================================================
-- 2. CORE USERS & PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT CONSTRAINT chk_profiles_role CHECK (role IN ('buyer', 'artisan', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- Prevent non-admins from elevating their own role upon update
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

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Profiles RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read of profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read of artisan profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to read all profiles" ON public.profiles;

CREATE POLICY "Allow authenticated read of profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR
        role = 'artisan'
        OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 3. ARTISANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.artisans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT,
    bio TEXT,
    location TEXT,
    specialization TEXT,
    experience_years INTEGER,
    verification_status TEXT DEFAULT 'pending' CONSTRAINT chk_artisans_verification_status CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artisans_profile_id ON public.artisans(profile_id);
CREATE INDEX IF NOT EXISTS idx_artisans_verification_status ON public.artisans(verification_status);

ALTER TABLE public.artisans ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_artisans_updated_at ON public.artisans;
CREATE TRIGGER update_artisans_updated_at
    BEFORE UPDATE ON public.artisans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Artisans RLS Policies
DROP POLICY IF EXISTS "Allow public read access to artisans" ON public.artisans;
DROP POLICY IF EXISTS "Allow admins to read all artisans" ON public.artisans;
DROP POLICY IF EXISTS "Users can read their own artisan record" ON public.artisans;

CREATE POLICY "Allow public read access to artisans" ON public.artisans
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own artisan record" ON public.artisans;
CREATE POLICY "Users can insert their own artisan record" ON public.artisans
    FOR INSERT
    TO authenticated
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own artisan record" ON public.artisans;
CREATE POLICY "Users can update their own artisan record" ON public.artisans
    FOR UPDATE
    TO authenticated
    USING (
        profile_id = auth.uid()
        OR
        public.is_admin()
    )
    WITH CHECK (
        profile_id = auth.uid()
        OR
        public.is_admin()
    );

-- ============================================================================
-- 4. MARKETPLACE CATEGORIES & PRODUCTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS select_categories ON public.categories;
CREATE POLICY select_categories ON public.categories
    FOR SELECT
    USING (true);

-- Seed standard categories
INSERT INTO public.categories (name, description) VALUES
    ('Wood Craft', 'Traditional handcrafted woodwork and sandalwood carvings'),
    ('Pottery', 'Earthenware, terracotta pottery, and clay utility crafts'),
    ('Handloom & Textiles', 'Hand-woven silks, cotton sarees, and artisan fabrics'),
    ('Metal Craft', 'Bidriware, bronze idols, brass lamps, and metalwork'),
    ('Bamboo & Natural Craft', 'Eco-friendly bamboo, cane, and coir crafts'),
    ('Jewellery', 'Traditional handcrafted silver, terracotta, and beaded jewellery'),
    ('Other Handicrafts', 'Paintings, stone craft, leatherwork, and unique folk crafts')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'out_of_stock')),
    average_rating NUMERIC(3,2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_artisan_id ON public.products(artisan_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Initial Product RLS Policies (Will be further refined by subsequent migrations)
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

DROP POLICY IF EXISTS delete_products ON public.products;
CREATE POLICY delete_products ON public.products
    FOR DELETE
    TO authenticated
    USING (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        public.is_admin()
    );

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS insert_product_images ON public.product_images;
CREATE POLICY insert_product_images ON public.product_images
    FOR INSERT
    TO authenticated
    WITH CHECK (
        product_id IN (
            SELECT id FROM public.products 
            WHERE artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
        )
        OR
        public.is_admin()
    );

DROP POLICY IF EXISTS delete_product_images ON public.product_images;
CREATE POLICY delete_product_images ON public.product_images
    FOR DELETE
    TO authenticated
    USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
        )
        OR
        public.is_admin()
    );

-- ============================================================================
-- 5. ORDERS & ORDER ITEMS
-- ============================================================================

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
    status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

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

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Helper functions to avoid circular RLS evaluation recursion
CREATE OR REPLACE FUNCTION public.is_customer_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_uuid AND customer_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_artisan_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.artisans a ON oi.artisan_id = a.id
        WHERE oi.order_id = order_uuid AND a.profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

DROP POLICY IF EXISTS insert_orders ON public.orders;
CREATE POLICY insert_orders ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid());

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
        public.is_admin()
        OR
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- ============================================================================
-- 6. PRODUCT REVIEWS & RATINGS RECALCULATION
-- ============================================================================

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
    CONSTRAINT uq_customer_order_product_review UNIQUE (customer_id, order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON public.product_reviews(customer_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER update_product_reviews_updated_at
    BEFORE UPDATE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

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

    SELECT COALESCE(AVG(rating), 0)::NUMERIC(3,2), COUNT(id)
    INTO avg_r, cnt_r
    FROM public.product_reviews
    WHERE product_id = pid;

    UPDATE public.products
    SET average_rating = avg_r,
        review_count = cnt_r
    WHERE id = pid;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_recalculate_product_ratings ON public.product_reviews;
CREATE TRIGGER tr_recalculate_product_ratings
    AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.recalculate_product_ratings();

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

-- ============================================================================
-- 7. ENQUIRIES & NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('submitted', 'under_review', 'sent_to_artisan', 'responded', 'closed', 'pending', 'read', 'replied')),
    quantity INTEGER CHECK (quantity > 0),
    preferred_delivery_date DATE,
    budget NUMERIC(12,2) CHECK (budget >= 0),
    reference_image_url TEXT,
    artisan_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_product_id ON public.enquiries(product_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_customer_id ON public.enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_artisan_id ON public.enquiries(artisan_id);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_enquiries_updated_at ON public.enquiries;
CREATE TRIGGER update_enquiries_updated_at
    BEFORE UPDATE ON public.enquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

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
        public.is_admin()
    );

DROP POLICY IF EXISTS insert_enquiries ON public.enquiries;
CREATE POLICY insert_enquiries ON public.enquiries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()
        AND
        artisan_id = (SELECT artisan_id FROM public.products WHERE id = product_id)
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
        public.is_admin()
    )
    WITH CHECK (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        public.is_admin()
    );

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_id UUID NULL,
    reference_type TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_notifications ON public.notifications;
CREATE POLICY select_notifications ON public.notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS update_notifications ON public.notifications;
CREATE POLICY update_notifications ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_notifications ON public.notifications;
CREATE POLICY insert_notifications ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- 8. ARTISAN VERIFICATIONS & ADMIN APPROVAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.artisan_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE UNIQUE,
    government_id_url TEXT NULL,
    craft_certificate_url TEXT NULL,
    workshop_photo_url TEXT NULL,
    status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (status IN ('not_submitted', 'submitted', 'under_review', 'approved', 'rejected')),
    rejection_reason TEXT NULL,
    submitted_at TIMESTAMPTZ NULL,
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artisan_verifications_artisan_id ON public.artisan_verifications(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_verifications_status ON public.artisan_verifications(status);

ALTER TABLE public.artisan_verifications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_artisan_verifications_updated_at ON public.artisan_verifications;
CREATE TRIGGER update_artisan_verifications_updated_at
    BEFORE UPDATE ON public.artisan_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.check_artisan_verification_write_restrictions()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.status IN ('approved', 'rejected', 'under_review') AND (OLD IS NULL OR NEW.status <> OLD.status) THEN
        RAISE EXCEPTION 'Artisans cannot approve, reject, or set their own verification status to under_review';
    END IF;

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
        IF NEW.reviewed_by IS NOT NULL OR NEW.rejection_reason IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
            RAISE EXCEPTION 'Artisans cannot set admin review fields on insert';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_check_artisan_verification_write_restrictions ON public.artisan_verifications;
CREATE TRIGGER tr_check_artisan_verification_write_restrictions
    BEFORE INSERT OR UPDATE ON public.artisan_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.check_artisan_verification_write_restrictions();

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_artisan_verification_status ON public.artisan_verifications;
CREATE TRIGGER tr_sync_artisan_verification_status
    AFTER INSERT OR UPDATE OF status ON public.artisan_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_artisan_verification_status();

DROP POLICY IF EXISTS select_artisan_verifications ON public.artisan_verifications;
CREATE POLICY select_artisan_verifications ON public.artisan_verifications
    FOR SELECT
    TO authenticated
    USING (
        artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
        OR
        public.is_admin()
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
        public.is_admin()
    );

-- ============================================================================
-- 9. STORAGE BUCKETS (INITIAL CONFIGURATION)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('artisan-verification', 'artisan-verification', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    ('review-photos', 'review-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 5242880;

-- A. product-images storage policies
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

-- B. artisan-verification storage policies (PRIVATE bucket)
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

-- C. review-photos storage policies (PUBLIC read, user-scoped write)
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
