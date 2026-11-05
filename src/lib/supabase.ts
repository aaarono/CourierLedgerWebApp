import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Foundation mode: show setup instructions when credentials are absent.
// Never use a Supabase service_role key in browser-side code.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
