import type { MetadataRoute } from 'next';
import { CANONICAL_BASE_URL } from '@/lib/env';

// Sitemap (convención App Router). Solo rutas públicas existentes; las rutas
// dinámicas de propiedad se agregarán en Fase 5 cuando exista el listado real.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = ['/', '/propiedades', '/privacidad', '/gracias-consulta'];

  return routes.map((path) => ({
    url: `${CANONICAL_BASE_URL}${path === '/' ? '' : path}`,
    lastModified,
  }));
}
