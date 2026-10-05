import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'amk_supabase_url';
const STORAGE_KEY_ANON = 'amk_supabase_anon_key';

// Read from import.meta.env first, with fallback to localStorage (for easy setup via Admin UI)
export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ANON) || '' : '';

  const url = (envUrl || localUrl).trim();
  const anonKey = (envKey || localKey).trim();

  return { url, anonKey };
}

export function saveSupabaseCredentials(url, anonKey) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (anonKey) localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    else localStorage.removeItem(STORAGE_KEY_ANON);
  }
  initSupabaseClient();
}

let supabaseInstance = null;

export function initSupabaseClient() {
  const { url, anonKey } = getSupabaseCredentials();

  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('Gagal menginisialisasi Supabase client:', err);
      supabaseInstance = null;
    }
  } else {
    supabaseInstance = null;
  }
  return null;
}

export function getSupabase() {
  if (!supabaseInstance) {
    initSupabaseClient();
  }
  return supabaseInstance;
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey);
}

// Initial initialization
initSupabaseClient();
