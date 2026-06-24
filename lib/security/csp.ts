// ── Headers de seguridad HTTP — ÚNICA fuente de verdad ───────────────────────
// Portado de legacy/server.js:82-141 y vercel.json. Aplicado a TODO el sitio vía
// middleware.ts, cerrando el gap del informe §5.7 (páginas estáticas sin headers).
//
// CSP conserva 'unsafe-inline' en script-src por GTM/Turnstile (paridad con la
// auditoría). Endurecer con nonce queda como mejora futura.

export function buildCsp(): string {
  // En desarrollo Next.js usa eval() para HMR/React Refresh → se requiere 'unsafe-eval'.
  // En producción se mantiene estricto (sin unsafe-eval), igual que la auditoría (informe §5.4).
  const devEval = process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    // GTM + GA4 + Google Ads + Meta Pixel + Turnstile
    "script-src 'self' 'unsafe-inline'" +
      devEval +
      ' https://www.googletagmanager.com' +
      ' https://www.google-analytics.com' +
      ' https://ssl.google-analytics.com' +
      ' https://www.googleadservices.com' +
      ' https://googleads.g.doubleclick.net' +
      ' https://www.google.com' +
      ' https://connect.facebook.net' +
      ' https://challenges.cloudflare.com',
    // Fuentes self-hosted (next/font) → no se requieren hosts de Google Fonts.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    // Fetch/XHR: analytics + CRM + Meta CAPI
    "connect-src 'self'" +
      ' https://www.google-analytics.com' +
      ' https://analytics.google.com' +
      ' https://region1.google-analytics.com' +
      ' https://stats.g.doubleclick.net' +
      ' https://www.googleadservices.com' +
      ' https://googleads.g.doubleclick.net' +
      // Beacons de conversión de Google Ads (enhanced conversions / consent mode):
      // www.google.com/ccm/collect y ad.doubleclick.net/ccm/s/collect.
      ' https://www.google.com' +
      ' https://ad.doubleclick.net' +
      ' https://connect.facebook.net' +
      ' https://www.facebook.com' +
      ' https://facebook.com' +
      ' https://challenges.cloudflare.com' +
      ' https://api.2clics.com.ar',
    // iframes: Google Maps + YouTube + Vimeo + Matterport + GTM
    'frame-src' +
      ' https://www.google.com' +
      ' https://maps.google.com' +
      ' https://www.youtube.com' +
      ' https://www.youtube-nocookie.com' +
      ' https://player.vimeo.com' +
      ' https://my.matterport.com' +
      ' https://www.googletagmanager.com' +
      ' https://td.doubleclick.net' +
      ' https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// Conjunto completo de headers de seguridad — server.js:85-90 + vercel.json
export function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-DNS-Prefetch-Control': 'on',
    'Content-Security-Policy': buildCsp(),
  };
}
