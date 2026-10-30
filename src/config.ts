// Public configuration only. No secrets may ever be added here.
/** True only in the simulated showcase build (VITE_DEMO=1, served at /NagarTrace/demo/). */
export const DEMO = import.meta.env.VITE_DEMO === '1'
export const API_BASE = 'https://nagartrace-api.onrender.com'
export const SUPABASE_URL = 'https://hxolnshsffehxdairque.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_R_lRZf8CX4yGWlclflIm7w_QEAjfR9B'

// Flip to true only after the Supabase Google provider is verified live by the backend.
export const GOOGLE_AUTH_ENABLED = true

// Flip to true only after the project mail service is confirmed to send numeric codes
// (default Supabase templates are link-only; editing them needs custom SMTP - owner decision).
export const EMAIL_OTP_ENABLED = false
