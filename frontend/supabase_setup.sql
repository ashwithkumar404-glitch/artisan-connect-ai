-- SQL Setup Script for Step 6.2 - Artisan Connect AI
-- Creates public.profiles and public.artisans tables with RLS and policies.

-- 1. Create profiles table
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

-- 2. Create artisans table
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

-- 3. Enable Row Level Security (RLS) on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisans ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for profiles table
-- Policy: SELECT their own profile
CREATE POLICY "Users can read their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Policy: INSERT their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Policy: UPDATE their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: DELETE their own profile
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
TO authenticated 
USING (auth.uid() = id);

-- 5. RLS Policies for artisans table
-- Policy: SELECT their own artisan record
CREATE POLICY "Users can read their own artisan record" 
ON public.artisans 
FOR SELECT 
TO authenticated 
USING (profile_id = auth.uid());

-- Policy: INSERT their own artisan record
CREATE POLICY "Users can insert their own artisan record" 
ON public.artisans 
FOR INSERT 
TO authenticated 
WITH CHECK (profile_id = auth.uid());

-- Policy: UPDATE their own artisan record
CREATE POLICY "Users can update their own artisan record" 
ON public.artisans 
FOR UPDATE 
TO authenticated 
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Policy: DELETE their own artisan record
CREATE POLICY "Users can delete their own artisan record" 
ON public.artisans 
FOR DELETE 
TO authenticated 
USING (profile_id = auth.uid());

-- 6. Trigger for updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_artisans_updated_at
    BEFORE UPDATE ON public.artisans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
