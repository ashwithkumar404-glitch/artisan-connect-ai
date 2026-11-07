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
    quantity INTEGER CHECK (quantity > 0),
    preferred_delivery_date DATE,
    budget NUMERIC(12,2) CHECK (budget >= 0),
    reference_image_url TEXT,
    artisan_response TEXT,
    counteroffer_amount NUMERIC(12,2) CHECK (counteroffer_amount >= 0),
    expected_ready_date DATE,
    customer_accepted_at TIMESTAMPTZ,
    artisan_confirmed_at TIMESTAMPTZ,
    production_notes TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_enquiry_status CHECK (
        status IN (
            'pending',
            'submitted',
            'under_review',
            'sent_to_artisan',
            'negotiation_ongoing',
            'offer_awaiting_response',
            'responded',
            'offer_accepted',
            'confirmed',
            'closed',
            'rejected',
            'cancelled',
            'read',
            'replied'
        )
    )
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

-- Policy: Customers and Artisans can update enquiries they participate in
DROP POLICY IF EXISTS update_enquiries ON public.enquiries;
CREATE POLICY update_enquiries ON public.enquiries
    FOR UPDATE
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        customer_id = auth.uid()
        OR
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
    );

-- 4b. Table and RLS for Multi-Message Negotiation Thread
CREATE TABLE IF NOT EXISTS public.enquiry_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'artisan', 'system')),
    message TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'offer', 'counteroffer', 'acceptance', 'production_confirmation', 'status_update')),
    proposed_amount NUMERIC(12,2) CHECK (proposed_amount >= 0),
    unit_price_equivalent NUMERIC(12,2) CHECK (unit_price_equivalent >= 0),
    kannada_translation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_messages_enquiry_id ON public.enquiry_messages(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_created_at ON public.enquiry_messages(created_at);

ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_enquiry_messages ON public.enquiry_messages;
CREATE POLICY select_enquiry_messages ON public.enquiry_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = enquiry_id
            AND (
                e.customer_id = auth.uid()
                OR
                e.artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS insert_enquiry_messages ON public.enquiry_messages;
CREATE POLICY insert_enquiry_messages ON public.enquiry_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND
        EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id = enquiry_id
            AND (
                e.customer_id = auth.uid()
                OR
                e.artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
            )
        )
    );

-- Policy: Allow artisans to generate orders from accepted custom enquiries
DROP POLICY IF EXISTS insert_orders ON public.orders;
CREATE POLICY insert_orders ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.customer_id = orders.customer_id
            AND e.artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
            AND e.status IN ('offer_accepted', 'confirmed')
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
