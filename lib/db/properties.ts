import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { getSupabase } from '@/lib/supabase';
import { isVisible } from '@/lib/properties/format';
import { sanitizeVideoUrl } from '@/lib/security/ssrf';

// ── Data layer de propiedades ────────────────────────────────────────────────
// Portado de legacy/server.js:500-696 + searchProperties() nuevo.
// El CRM (Supabase) es la fuente; property_overrides define la presentación web.

export type Property = ReturnType<typeof normalizeDbRow>;

// Fallback JSON local (sólo dev / sin Supabase) — data/properties.json
const PROPERTIES_FILE = path.join(process.cwd(), 'data', 'properties.json');

function readPropertiesJson(): any[] {
  try {
    return JSON.parse(fs.readFileSync(PROPERTIES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ── Normalizar fila de Supabase al formato que usa el resto del código ────────
// property_overrides llega como array (FK inversa en PostgREST) → tomamos [0]
export function normalizeDbRow(row: any) {
  if (!row) return null as any;
  const ov = Array.isArray(row.property_overrides)
    ? row.property_overrides[0] || {}
    : row.property_overrides || {};
  const imagesCrm = Array.isArray(row.imagenes_crm) ? row.imagenes_crm : [];
  const sourceRaw = row.source_raw_json || {};

  return {
    id: row.id,
    app_id: row.crm_app_id || row.id,
    crm_app_id: row.crm_app_id || '',
    crm_code: row.crm_code || '',
    estado: row.estado || 'activa',

    // Campos con prioridad override web → CRM
    titulo: ov.titulo_web || row.titulo || 'Propiedad sin título',
    descripcion: ov.descripcion_web || row.descripcion || '',
    operacion: ov.operacion_web || row.operacion || '',
    tipo: ov.tipo_web || row.tipo || '',
    pais: ov.pais_web || row.pais || '',
    ubicacion: ov.ubicacion_web || row.ubicacion || '',
    tag: ov.etiqueta_web || row.tag || '',
    prop_featured:
      ov.destacado_web !== null && ov.destacado_web !== undefined
        ? ov.destacado_web
        : row.prop_featured || false,

    // Campos solo del CRM
    precio: row.precio || 'Consultar',
    precio_numero: row.precio_numero ?? null,
    moneda: row.moneda || 'USD',
    imagen: row.imagen || '',
    ambientes: row.ambientes || '',
    banos: row.banos || '',
    superficie: row.superficie || '',
    dormitorios: row.dormitorios ?? null,
    linkWhatsapp: row.link_whatsapp || '',
    linkMercadoLibre: row.link_mercado_libre || '',
    linkZonaprop: row.link_zonaprop || '',
    productorNombre: row.productor_nombre || '',
    productorEmail: row.productor_email || '',
    amenities: Array.isArray(row.amenities) ? row.amenities : [],

    // Media manual — CRM nunca los toca
    imagen_manual: ov.imagen_manual || null,
    og_image_manual: ov.og_image_manual || null,
    galeria_manual: Array.isArray(ov.galeria_manual) ? ov.galeria_manual : [],
    video_manual_url: sanitizeVideoUrl(ov.video_manual_url || ''),
    tour_manual_url: sanitizeVideoUrl(ov.tour_manual_url || ''),

    // Campos resueltos: prioridad override → CRM
    video: sanitizeVideoUrl(ov.video_manual_url || row.video || ''),
    tour: sanitizeVideoUrl(ov.tour_manual_url || row.tour || ''),

    // SEO
    seo_title: ov.seo_title || null,
    seo_description: ov.seo_description || null,

    // Presentación de inversiones participativas
    bajada: ov.bajada_web || '',
    categoria: ov.categoria_web || '',
    zona_web: ov.zona_web || '',
    mostrar_como_inversion: ov.mostrar_como_inversion || false,
    ticket_minimo: ov.ticket_minimo || '',
    horizonte_inversion: ov.horizonte_inversion || '',
    retorno_estimado: ov.retorno_estimado || '',
    modelo_inversion: ov.modelo_inversion || '',
    riesgo_inversion: ov.riesgo_inversion || '',
    disclaimer_inversion: ov.disclaimer_inversion || '',

    raw: { ...sourceRaw, imagenes_propiedad: imagesCrm },
    updated_at: row.updated_at || new Date().toISOString(),
    created_at: row.created_at || new Date().toISOString(),
  };
}

// ── Todas las propiedades activas — server.js:583-597 ────────────────────────
export async function dbGetProperties(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) return readPropertiesJson().filter(isVisible);
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_overrides(*)')
      .eq('estado', 'activa')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(normalizeDbRow);
  } catch (err) {
    console.error('[db] getProperties:', (err as Error).message);
    return readPropertiesJson().filter(isVisible);
  }
}

// ── Una propiedad por id interno o crm_app_id — server.js:600-625 ────────────
export async function dbGetProperty(id: string): Promise<any | null> {
  const supabase = getSupabase();
  if (!supabase) {
    const all = readPropertiesJson();
    const sid = String(id || '');
    return (
      all.find(
        (p) =>
          String(p.id) === sid ||
          String(p.app_id) === sid ||
          String(p.crm_app_id) === sid ||
          (sid && (sid.startsWith(`${p.id}-`) || sid.startsWith(`${String(p.app_id)}-`))),
      ) || null
    );
  }
  try {
    // Whitelist de caracteres: elimina metacaracteres PostgREST (coma, paréntesis,
    // punto, etc.) para evitar inyección en el filtro .or(). Los ids del CRM son
    // alfanuméricos, así que no se ven alterados.
    const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 200);
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_overrides(*)')
      .or(`id.eq.${safeId},crm_app_id.eq.${safeId}`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data[0] ? normalizeDbRow(data[0]) : null;
  } catch (err) {
    console.error('[db] getProperty:', (err as Error).message);
    return null;
  }
}

// ── Búsqueda eficiente (filtros indexados + full-text) — "RAG" del informe ────
// Para 39 propiedades: filtrado server-side sobre columnas indexadas + textSearch
// en español sobre titulo/descripcion. Sin embeddings (over-engineering a este volumen).
export type PropertyQuery = {
  pais?: string;
  tipo?: string;
  operacion?: string;
  precioMin?: number;
  precioMax?: number;
  q?: string; // texto libre
  limit?: number;
};

export async function searchProperties(query: PropertyQuery = {}): Promise<any[]> {
  const { pais, tipo, operacion, precioMin, precioMax, q, limit = 100 } = query;
  const supabase = getSupabase();

  if (!supabase) {
    // Fallback en memoria sobre el JSON local
    const norm = (s: unknown) => String(s || '').toLowerCase();
    let rows = readPropertiesJson().filter(isVisible);
    if (pais) rows = rows.filter((p) => norm(p.pais) === norm(pais));
    if (tipo) rows = rows.filter((p) => norm(p.tipo) === norm(tipo));
    if (operacion) rows = rows.filter((p) => norm(p.operacion) === norm(operacion));
    if (typeof precioMin === 'number') rows = rows.filter((p) => (p.precio_numero ?? 0) >= precioMin);
    if (typeof precioMax === 'number') rows = rows.filter((p) => (p.precio_numero ?? Infinity) <= precioMax);
    if (q) {
      const needle = norm(q);
      rows = rows.filter((p) => `${norm(p.titulo)} ${norm(p.descripcion)} ${norm(p.ubicacion)}`.includes(needle));
    }
    return rows.slice(0, limit);
  }

  try {
    let builder = supabase
      .from('properties')
      .select('*, property_overrides(*)')
      .eq('estado', 'activa');

    if (pais) builder = builder.ilike('pais', pais);
    if (tipo) builder = builder.ilike('tipo', tipo);
    if (operacion) builder = builder.ilike('operacion', operacion);
    if (typeof precioMin === 'number') builder = builder.gte('precio_numero', precioMin);
    if (typeof precioMax === 'number') builder = builder.lte('precio_numero', precioMax);
    // Full-text en español sobre titulo+descripcion (requiere índice tsvector — ver schema)
    if (q) builder = builder.textSearch('fts', q, { type: 'websearch', config: 'spanish' });

    const { data, error } = await builder
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(normalizeDbRow);
  } catch (err) {
    console.error('[db] searchProperties:', (err as Error).message);
    return [];
  }
}

// ── Upsert propiedad desde CRM — server.js:628-679 ───────────────────────────
export async function dbUpsertProperty(mapped: Record<string, any>): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return; // sin DB: no-op (Vercel read-only)

  const imagesCrm = Array.isArray(mapped.raw?.imagenes_propiedad)
    ? mapped.raw.imagenes_propiedad
    : [];
  const row = {
    id: mapped.id,
    crm_app_id: mapped.app_id || '',
    crm_code: mapped.crm_code || '',
    estado: mapped.estado || 'activa',
    titulo: mapped.titulo || '',
    descripcion: mapped.descripcion || '',
    operacion: mapped.operacion || '',
    tipo: mapped.tipo || '',
    precio: mapped.precio || 'Consultar',
    precio_numero: mapped.precio_numero ?? null,
    moneda: mapped.moneda || 'USD',
    pais: mapped.pais || '',
    ubicacion: mapped.ubicacion || '',
    imagen: mapped.imagen || '',
    imagenes_crm: imagesCrm,
    ambientes: mapped.ambientes || '',
    banos: mapped.banos || '',
    superficie: mapped.superficie || '',
    tag: mapped.tag || '',
    prop_featured: mapped.raw?.prop_featured || false,
    link_whatsapp: mapped.linkWhatsapp || '',
    link_mercado_libre: mapped.linkMercadoLibre || '',
    link_zonaprop: mapped.linkZonaprop || '',
    video: mapped.video || '',
    tour: mapped.tour || '',
    productor_nombre: mapped.productorNombre || '',
    productor_email: mapped.productorEmail || '',
    amenities: mapped.amenities || [],
    source_raw_json: mapped.raw || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('properties').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[db] upsertProperty:', error.message);
    throw error;
  }
}

// ── DELETE físico (definitivo) — pedido del cliente para del_property ─────────
// property_overrides se elimina automáticamente por FK ON DELETE CASCADE.
export async function dbDeleteProperty(propId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  // Whitelist de caracteres: igual que en dbGetProperty, neutraliza metacaracteres
  // PostgREST en el filtro .or() sin tocar ids alfanuméricos legítimos.
  const safeId = String(propId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 200);
  const { error } = await supabase
    .from('properties')
    .delete()
    .or(`id.eq.${safeId},crm_app_id.eq.${safeId}`);
  if (error) {
    console.error('[db] deleteProperty:', error.message);
    throw error;
  }
}
