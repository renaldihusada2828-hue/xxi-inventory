// ============================================================
// supabase.js — Supabase client
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing Supabase env variables. Check .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export function handleError(error) {
  return error?.message || error?.details || 'Terjadi kesalahan.';
}
