-- ============================================================================
-- Migration: 20261105000000_enquiry_negotiation_and_messages.sql
-- Description: Enable full customer enquiry negotiation lifecycle, mutual order
--              agreement, message persistence, and repair RLS policies for enquiries.
-- ============================================================================

-- 1. EXTEND ENQUIRIES COLUMNS FOR TWO-WAY PRICE NEGOTIATION
ALTER TABLE public.enquiries 
    ADD COLUMN IF NOT EXISTS counteroffer_amount NUMERIC(12,2) CHECK (counteroffer_amount >= 0),
    ADD COLUMN IF NOT EXISTS expected_ready_date DATE,
    ADD COLUMN IF NOT EXISTS customer_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS artisan_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS production_notes TEXT,
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- 2. REVISE STATUS CHECK CONSTRAINT
-- Include all lifecycle statuses: negotiation_ongoing, offer_awaiting_response, offer_accepted, confirmed
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS chk_enquiry_status;
ALTER TABLE public.enquiries ADD CONSTRAINT chk_enquiry_status CHECK (
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
);

-- 3. FIX ENQUIRIES RLS POLICIES
-- Allow authenticated customers to update enquiries they created (e.g. counteroffer, accepting an offer)
-- while ensuring artisans and admins retain update capabilities.
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
        OR
        public.is_admin()
    )
    WITH CHECK (
        customer_id = auth.uid()
        OR
        artisan_id IN (
            SELECT id FROM public.artisans WHERE profile_id = auth.uid()
        )
        OR
        public.is_admin()
    );

-- 4. CREATE ENQUIRY MESSAGES TABLE (CONVERSATION THREAD)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_enquiry_id ON public.enquiry_messages(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_created_at ON public.enquiry_messages(created_at);

-- 5. RLS FOR ENQUIRY MESSAGES
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
                OR
                public.is_admin()
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
                OR
                public.is_admin()
            )
        )
    );

-- 6. ALLOW ARTISANS TO GENERATE CONFIRMED ORDERS FROM MUTUALLY ACCEPTED ENQUIRIES
-- Safely permit inserting into orders and order_items when fulfilling an accepted enquiry
DROP POLICY IF EXISTS insert_orders ON public.orders;
CREATE POLICY insert_orders ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()
        OR
        public.is_admin()
        OR
        EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.customer_id = orders.customer_id
            AND e.artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
            AND e.status IN ('offer_accepted', 'confirmed')
        )
    );

DROP POLICY IF EXISTS insert_order_items ON public.order_items;
CREATE POLICY insert_order_items ON public.order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_customer_order(order_id)
        OR
        public.is_admin()
        OR
        artisan_id IN (SELECT id FROM public.artisans WHERE profile_id = auth.uid())
    );
