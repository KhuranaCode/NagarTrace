// Project config. Publishable key is client-safe by design (RLS-gated); never put secret keys here.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://nagartrace-api.onrender.com'
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://hxolnshsffehxdairque.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_R_lRZf8CX4yGWlclflIm7w_QEAjfR9B'
