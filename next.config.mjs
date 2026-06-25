import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // paridad con app.disable('x-powered-by') del server.js legacy
  // El lint corre como aviso (local/CI con `npm run lint`), pero NO bloquea el
  // build de producción. Se puede volver bloqueante más adelante, cuando el
  // proyecto corra limpio un tiempo (decisión de Luciano, revisión semanal).
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Cuando lleguen las propiedades del CRM (Fase 5), next/image necesita los
    // hosts de las imágenes externas de 2Clics. Descomentar y completar con el/los
    // dominio(s) reales del CDN del CRM (NO usar hostname '**' por seguridad):
    // remotePatterns: [
    //   { protocol: 'https', hostname: 'cdn.2clics.com.ar' },
    // ],
  },
  // Redirecciones 301 .html → URL limpia (paridad con server.js:172-176 y vercel.json)
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/propiedades.html', destination: '/propiedades', permanent: true },
      { source: '/propiedad.html', destination: '/propiedad', permanent: true },
      { source: '/gracias-consulta.html', destination: '/gracias-consulta', permanent: true },
      { source: '/privacidad.html', destination: '/privacidad', permanent: true },
    ];
  },
};

// withSentryConfig: instrumenta el build. La subida de source maps se hace solo
// si hay SENTRY_AUTH_TOKEN (en local/sin token no falla, solo no sube mapas).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
