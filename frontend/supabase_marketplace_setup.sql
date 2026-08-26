-- SQL Setup Script for Step 7.1 Marketplace Database Setup - Artisan Connect AI
-- Creates public.categories, public.products, and public.product_images tables with RLS and policies.

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    price NUMERIC(12,2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK constraints
    CONSTRAINT check_product_price_non_negative CHECK (price >= 0),
    CONSTRAINT check_product_stock_non_negative CHECK (stock_quantity >= 0),
    CONSTRAINT check_product_status CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'out_of_stock'))
);

-- 3. Create product_images table
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK constraints
    CONSTRAINT check_image_display_order_non_negative CHECK (display_order >= 0)
);

-- 4. Create database performance indexes
CREATE INDEX IF NOT EXISTS idx_products_artisan_id ON public.products(artisan_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

-- 5. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- 6. Create updated_at timestamp triggers
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. RLS Policies: categories
-- Policy: Anyone (buyers, artisans, and unauthenticated public) can read categories
DROP POLICY IF EXISTS select_categories ON public.categories;
CREATE POLICY select_categories ON public.categories
    FOR SELECT
    USING (true);

-- 8. RLS Policies: products
-- Policy: Anyone can read published products. Authenticated artisans can also read their own products.
DROP POLICY IF EXISTS select_products ON public.products;
CREATE POLICY select_products ON public.products
    FOR SELECT
    USING (
        status = 'published'
        OR 
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- Policy: Authenticated artisans can insert their own products with status restricted to 'draft' or 'pending_review'
DROP POLICY IF EXISTS insert_products ON public.products;
CREATE POLICY insert_products ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        AND
        status IN ('draft', 'pending_review')
    );

-- Policy: Authenticated artisans can update their own products with status restricted to 'draft', 'pending_review', or 'out_of_stock'
-- This prevents artisans from bypassing the admin review workflow to self-publish or approve rejected products.
DROP POLICY IF EXISTS update_products ON public.products;
CREATE POLICY update_products ON public.products
    FOR UPDATE
    TO authenticated
    USING (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        AND
        status IN ('draft', 'pending_review', 'out_of_stock')
    );

-- Policy: Authenticated artisans can delete their own products
DROP POLICY IF EXISTS delete_products ON public.products;
CREATE POLICY delete_products ON public.products
    FOR DELETE
    TO authenticated
    USING (
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- 9. RLS Policies: product_images
-- Policy: Anyone can read images of published products. Authenticated artisans can read images of their own products.
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
    );

-- Policy: Authenticated artisans can insert images for their own products
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
    );

-- Policy: Authenticated artisans can update images of their own products
DROP POLICY IF EXISTS update_product_images ON public.product_images;
CREATE POLICY update_product_images ON public.product_images
    FOR UPDATE
    TO authenticated
    USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        product_id IN (
            SELECT id FROM public.products 
            WHERE artisan_id IN (
                SELECT id FROM public.artisans WHERE profile_id = auth.uid()
            )
        )
    );

-- Policy: Authenticated artisans can delete images of their own products
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
    );
