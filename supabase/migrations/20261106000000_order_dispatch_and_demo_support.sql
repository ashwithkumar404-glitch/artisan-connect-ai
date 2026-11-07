-- ============================================================================
-- Migration: 20261106000000_order_dispatch_and_demo_support.sql
-- Description: Expand orders lifecycle (ready_for_dispatch), carrier tracking,
--              production guidance, and demo isolation support.
-- ============================================================================

-- 1. ADD EXTENDED TRACKING AND PRODUCTION COLUMNS TO ORDERS
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS carrier_name TEXT,
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS dispatch_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
    ADD COLUMN IF NOT EXISTS expected_ready_date DATE,
    ADD COLUMN IF NOT EXISTS preparation_stage TEXT DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS preparation_checklist JSONB DEFAULT '[]'::jsonb;

-- 2. UPDATE ORDERS STATUS CHECK CONSTRAINT TO INCLUDE ready_for_dispatch
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_order_status;
ALTER TABLE public.orders ADD CONSTRAINT chk_order_status CHECK (
    status IN (
        'placed',
        'confirmed',
        'preparing',
        'ready_for_dispatch',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'disputed'
    )
);

-- 3. ADD DEMO FLAG TO PRODUCTS, ENQUIRIES, REVIEWS
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.enquiries
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.product_reviews
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS complaint_status TEXT DEFAULT 'none' CHECK (complaint_status IN ('none', 'open', 'investigating', 'resolved', 'closed')),
    ADD COLUMN IF NOT EXISTS feedback_category TEXT DEFAULT 'general' CHECK (feedback_category IN ('general', 'positive', 'quality_issue', 'delivery_issue', 'suggestion', 'other'));

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_is_demo ON public.orders(is_demo);
CREATE INDEX IF NOT EXISTS idx_products_is_demo ON public.products(is_demo);
CREATE INDEX IF NOT EXISTS idx_enquiries_is_demo ON public.enquiries(is_demo);
CREATE INDEX IF NOT EXISTS idx_reviews_is_demo ON public.product_reviews(is_demo);

