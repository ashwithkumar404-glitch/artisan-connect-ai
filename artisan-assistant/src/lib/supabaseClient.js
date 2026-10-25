import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase URL or Publishable/Anon Key is missing in environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-key'
);
