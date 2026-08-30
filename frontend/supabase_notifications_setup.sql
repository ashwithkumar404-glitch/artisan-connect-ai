-- SQL Migration Script: Notification System Setup - Artisan Connect AI
-- Execute this script in your Supabase Dashboard SQL Editor.

-- 1. Create notifications table
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

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Policy: Users can read their own notifications
DROP POLICY IF EXISTS select_notifications ON public.notifications;
CREATE POLICY select_notifications ON public.notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Users can update (e.g. mark as read) their own notifications
DROP POLICY IF EXISTS update_notifications ON public.notifications;
CREATE POLICY update_notifications ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Authenticated users can insert notifications for others (e.g. artisan to admin, admin to artisan)
DROP POLICY IF EXISTS insert_notifications ON public.notifications;
CREATE POLICY insert_notifications ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
