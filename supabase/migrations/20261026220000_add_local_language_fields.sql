-- Migration: 20261026220000_add_local_language_fields.sql
-- Description: Adds separate fields for local language (e.g. Kannada) title and description to public.products table
-- Keeps existing name and description as the English marketplace fields for backward compatibility.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS local_title TEXT NULL,
ADD COLUMN IF NOT EXISTS local_description TEXT NULL;

-- Create search index for local titles
CREATE INDEX IF NOT EXISTS idx_products_local_title ON public.products(local_title);
