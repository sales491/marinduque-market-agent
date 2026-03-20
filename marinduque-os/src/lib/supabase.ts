import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Using anon key for client & basic server operations if RLS isn't strict, or service roll key if you need bypass

export const supabase = createClient(supabaseUrl, supabaseKey);
