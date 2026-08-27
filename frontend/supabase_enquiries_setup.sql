-- SQL Migration Script for Step 7.5: Enquiries Table and RLS Setup - Artisan Connect AI
-- Execute this script in your Supabase Dashboard SQL Editor.

-- 1. Create enquiries table
CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_enquiry_status CHECK (status IN ('pending', 'read', 'replied', 'closed'))
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_enquiries_product_id ON public.enquiries(product_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_customer_id ON public.enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_artisan_id ON public.enquiries(artisan_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON public.enquiries(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: enquiries
-- Policy: Customers can read their own enquiries, artisans can read enquiries addressed to them
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
    );

-- Policy: Customers can insert enquiries for themselves, referencing the product's actual artisan
DROP POLICY IF EXISTS insert_enquiries ON public.enquiries;
CREATE POLICY insert_enquiries ON public.enquiries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()
        AND
        artisan_id = (SELECT artisan_id FROM public.products WHERE id = product_id)
    );

-- Policy: Artisans can update enquiries addressed to them (e.g. changing status to 'read' or 'replied')
DROP POLICY IF EXISTS update_enquiries ON public.enquiries;
CREATE POLICY update_enquiries ON public.enquiries
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
    );

-- 5. RLS Policies for Profiles (Public Select Access for Artisan profiles only)
DROP POLICY IF EXISTS "Allow public read of artisan profiles" ON public.profiles;
CREATE POLICY "Allow public read of artisan profiles"
ON public.profiles
FOR SELECT
USING (role = 'artisan');

-- 6. RLS Policies for Artisans (Public Select Access for Registered Artisans)
DROP POLICY IF EXISTS "Allow public read access to artisans" ON public.artisans;
CREATE POLICY "Allow public read access to artisans"
ON public.artisans
FOR SELECT
USING (true);

-- 7. RLS Policies for Products (Allowing artisans to publish/unpublish their own products)
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
        status IN ('draft', 'pending_review', 'published', 'out_of_stock')
    );

-- 8. Enable trigger for updated_at column on enquiries
DROP TRIGGER IF EXISTS update_enquiries_updated_at ON public.enquiries;
CREATE TRIGGER update_enquiries_updated_at
    BEFORE UPDATE ON public.enquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
