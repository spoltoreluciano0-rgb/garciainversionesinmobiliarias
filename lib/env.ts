import 'server-only';

// ── Acceso tipado a variables de entorno (SOLO server-side) ───────────────────
// 'server-only' garantiza que este módulo nunca se incluya en un bundle de cliente,
// protegiendo las keys sensibles (Supabase service role, Resend, CRM hash, Turnstile).

export const env = {
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // CRM 2Clics
  CRM_HASH: process.env.CRM_HASH || '',
  CRM_AGENT_ID: Number(process.env.CRM_AGENT_ID || 0),
  CRM_MESSAGE_URL: process.env.CRM_MESSAGE_URL || 'https://api.2clics.com.ar/api/external/message',

  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL || '',
  CONTACT_FROM_EMAIL:
    process.env.CONTACT_FROM_EMAIL || 'García Inversiones <onboarding@resend.dev>',

  // Supabase (service role)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Turnstile (secreta)
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',

  // Upstash Redis (rate limit global entre instancias serverless).
  // Vacío = fallback al rate limiter en memoria por-instancia.
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
};

export const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
export const CANONICAL_BASE_URL = 'https://www.garciainversionesinmobiliarias.com.ar';
