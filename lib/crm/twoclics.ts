// ── Mapeo y autorización del CRM 2Clics ──────────────────────────────────────
// Portado de legacy/server.js:729-800. El CRM nunca puede sobreescribir campos
// manuales (MANUAL_ONLY_FIELDS) — informe §4/§5.5.

import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { isPublicHttpsUrl } from '@/lib/security/ssrf';
import {
  formatPrice,
  getFeaturedImage,
  normalizeEstado,
  normalizeOperation,
} from '@/lib/properties/format';

// Campos manuales que el CRM NUNCA debe poder sobreescribir — server.js:733-748
export const MANUAL_ONLY_FIELDS = new Set<string>([
  // media manual
  'imagen_manual', 'og_image_manual', 'galeria_manual',
  'video_manual_url', 'tour_manual_url',
  // presentación web: ubicación y categoría
  'pais_web', 'ciudad_web', 'ubicacion_web', 'zona_web',
  'categoria_web', 'tipo_web', 'operacion_web',
  // presentación web: contenido
  'titulo_web', 'descripcion_web', 'bajada_web', 'etiqueta_web', 'destacado_web',
  // SEO
  'seo_title', 'seo_description',
  // inversiones participativas
  'ticket_minimo', 'horizonte_inversion', 'retorno_estimado',
  'modelo_inversion', 'riesgo_inversion', 'disclaimer_inversion',
  'mostrar_como_inversion',
]);

export function crmToWebProperty(prop: Record<string, any>): Record<string, any> {
  const appId = String(prop.app_id || prop.id_prop_houzez_cli || prop.codigo_propiedad || Date.now());
  const id = String(prop.id_prop_houzez_cli || appId);
  const isDevelopment = String(prop.tipo || '').toLowerCase() === 'emprendimiento';
  const operation = isDevelopment ? 'proyecto' : normalizeOperation(prop.operacion);
  const city = [prop.barrio, prop.ciudad || prop.provincia].filter(Boolean).join(' · ');

  // Sanitizar URLs externas de video/tour para evitar SSRF
  const rawVideo = String(prop.prop_video_url || '').trim();
  const rawTour = String(prop.virtual_tour || '').trim();

  return {
    id,
    app_id: appId,
    crm_code: prop.codigo_propiedad || '',
    estado: normalizeEstado(prop),
    titulo: prop.titulo || 'Propiedad sin título',
    operacion: operation,
    tipo: isDevelopment ? 'emprendimiento' : String(prop.tipo || 'propiedad').toLowerCase(),
    precio: formatPrice(prop),
    precio_numero: Number(prop.precio_propiedad || prop.precio) || null,
    moneda: prop.moneda_propiedad || prop.moneda || '',
    pais: prop.pais || prop.country || '',
    ubicacion: city || 'Ubicación a consultar',
    descripcion: prop.descripcion || '',
    imagen: getFeaturedImage(prop),
    ambientes: prop.ambientes_propiedad
      ? `${prop.ambientes_propiedad} ambientes`
      : prop.dormitorios
        ? `${prop.dormitorios} dorm.`
        : '',
    banos: prop.banos ? `${prop.banos} baños` : '',
    superficie: prop.superficie_total ? `${prop.superficie_total} m²` : '',
    tag: prop.prop_featured
      ? 'Destacada'
      : isDevelopment
        ? 'Proyecto'
        : prop.operacion || 'Propiedad',
    linkWhatsapp: `https://wa.me/5491167240353?text=${encodeURIComponent(
      `Hola, me interesa ${prop.titulo || 'esta propiedad'}`,
    )}`,
    linkMercadoLibre: '',
    linkZonaprop: '',
    // Video y tour: solo https público (YouTube, Vimeo, etc.)
    video: rawVideo && rawVideo !== 'null' && isPublicHttpsUrl(rawVideo) ? rawVideo : '',
    tour: rawTour && rawTour !== 'null' && isPublicHttpsUrl(rawTour) ? rawTour : '',
    productorNombre: prop.productorNombre || prop.productor_nombre || '',
    productorEmail: prop.productorEmail || prop.productor_email || env.CONTACT_TO_EMAIL || '',
    amenities: Array.isArray(prop.amenities)
      ? prop.amenities.map((a: any) => a.name).filter(Boolean)
      : [],
    raw: prop,
    updated_at: new Date().toISOString(),
    // NOTA: imagen_manual, og_image_manual, galeria_manual NO se incluyen aquí.
    // Se preservan del registro existente en el merge del webhook.
  };
}

// validateHash rechaza si el hash no está configurado en .env — server.js:796-800
export function validateHash(hash: unknown): boolean {
  if (!env.CRM_HASH) return false;
  // Comparación constante para no filtrar info por timing.
  const provided = Buffer.from(typeof hash === 'string' ? hash : String(hash ?? ''), 'utf8');
  const expected = Buffer.from(env.CRM_HASH, 'utf8');
  // timingSafeEqual tira si los largos difieren: descartamos antes.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
