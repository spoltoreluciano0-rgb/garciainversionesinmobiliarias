import { describe, it, expect } from 'vitest';
import { buildCsp, securityHeaders } from '@/lib/security/csp';

describe('CSP', () => {
  const csp = buildCsp();

  it('incluye directivas base obligatorias', () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
  it('permite los orígenes de tracking y Turnstile', () => {
    expect(csp).toContain('https://www.googletagmanager.com');
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain('https://connect.facebook.net');
  });
  it('permite connect a la API del CRM 2Clics', () => {
    expect(csp).toContain('https://api.2clics.com.ar');
  });
  it('permite los beacons de conversión de Google Ads en connect-src', () => {
    const connectSrc = csp.split(';').find((d) => d.trim().startsWith('connect-src'))!;
    expect(connectSrc).toContain('https://www.google.com');
    expect(connectSrc).toContain('https://ad.doubleclick.net');
  });
  it('permite iframes de Maps/YouTube/Vimeo/Matterport', () => {
    expect(csp).toContain('https://www.youtube-nocookie.com');
    expect(csp).toContain('https://my.matterport.com');
  });
});

describe('securityHeaders', () => {
  const h = securityHeaders();
  it('incluye HSTS 2 años + preload (informe §5.4)', () => {
    expect(h['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
  });
  it('incluye anti-clickjacking y nosniff', () => {
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
  });
  it('deshabilita cámara/micrófono/geolocalización', () => {
    expect(h['Permissions-Policy']).toContain('camera=()');
  });
});
