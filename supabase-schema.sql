-- ============================================================
-- García Inversiones Inmobiliarias — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Propiedades ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id                  TEXT PRIMARY KEY,
  crm_app_id          TEXT,
  crm_code            TEXT         DEFAULT '',
  slug                TEXT         DEFAULT '',
  titulo              TEXT NOT NULL DEFAULT 'Propiedad sin título',
  descripcion         TEXT         DEFAULT '',
  estado              TEXT NOT NULL DEFAULT 'activa',
  operacion           TEXT         DEFAULT '',
  tipo                TEXT         DEFAULT '',
  precio              TEXT         DEFAULT 'Consultar',
  precio_numero       NUMERIC,
  moneda              TEXT         DEFAULT 'USD',
  pais                TEXT         DEFAULT '',
  ubicacion           TEXT         DEFAULT '',
  barrio              TEXT         DEFAULT '',
  ciudad              TEXT         DEFAULT '',
  provincia           TEXT         DEFAULT '',
  imagen              TEXT         DEFAULT '',
  imagenes_crm        JSONB        DEFAULT '[]',
  ambientes           TEXT         DEFAULT '',
  banos               TEXT         DEFAULT '',
  superficie          TEXT         DEFAULT '',
  dormitorios         INTEGER,
  garages             INTEGER,
  expenses            TEXT         DEFAULT '',
  antiguedad          TEXT         DEFAULT '',
  video               TEXT         DEFAULT '',
  tour                TEXT         DEFAULT '',
  amenities           JSONB        DEFAULT '[]',
  tag                 TEXT         DEFAULT '',
  prop_featured       BOOLEAN      DEFAULT false,
  link_whatsapp       TEXT         DEFAULT '',
  link_mercado_libre  TEXT         DEFAULT '',
  link_zonaprop       TEXT         DEFAULT '',
  productor_nombre    TEXT         DEFAULT '',
  productor_email     TEXT         DEFAULT '',
  user_name           TEXT         DEFAULT '',
  user_email          TEXT         DEFAULT '',
  user_phone          TEXT         DEFAULT '',
  source_raw_json     JSONB,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- ── Overrides manuales (nunca los sobreescribe el CRM) ───────
CREATE TABLE IF NOT EXISTS property_overrides (
  property_id      TEXT PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  imagen_manual    TEXT,
  og_image_manual  TEXT,
  galeria_manual   JSONB        DEFAULT '[]',
  video_manual_url TEXT,
  tour_manual_url  TEXT,
  seo_title        TEXT,
  seo_description  TEXT,
  notas            TEXT,
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Migraciones: agregar columnas si la tabla ya fue creada ──
-- Ejecutar este bloque en Supabase SQL Editor si el schema anterior ya estaba aplicado.
-- Los CREATE TABLE IF NOT EXISTS ya incluyen las columnas nuevas para instalaciones frescas.

-- Media manual (ya existían)
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS video_manual_url TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS tour_manual_url  TEXT;

-- Presentación web: ubicación y categoría (sobreescriben portales CRM)
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS pais_web       TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS ciudad_web     TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS ubicacion_web  TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS zona_web       TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS categoria_web  TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS tipo_web       TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS operacion_web  TEXT;

-- Presentación web: contenido
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS titulo_web      TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS descripcion_web TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS bajada_web      TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS etiqueta_web    TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS destacado_web   BOOLEAN;

-- Inversiones participativas / proyectos
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS ticket_minimo        TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS horizonte_inversion  TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS retorno_estimado     TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS modelo_inversion     TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS riesgo_inversion     TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS disclaimer_inversion TEXT;
ALTER TABLE property_overrides ADD COLUMN IF NOT EXISTS mostrar_como_inversion BOOLEAN DEFAULT false;

-- ── Newsletter (independiente de 2Clics) ─────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  nombre       TEXT         DEFAULT '',
  origen       TEXT         DEFAULT '',
  utm_source   TEXT         DEFAULT '',
  utm_medium   TEXT         DEFAULT '',
  utm_campaign TEXT         DEFAULT '',
  status       TEXT         DEFAULT 'active',
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Logs de integración técnica ──────────────────────────────
CREATE TABLE IF NOT EXISTS integration_logs (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT '2clics',
  event_type    TEXT         DEFAULT '',
  crm_app_id    TEXT         DEFAULT '',
  status        TEXT NOT NULL,
  error_message TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_estado        ON properties(estado);
CREATE INDEX IF NOT EXISTS idx_properties_crm_app_id    ON properties(crm_app_id);
CREATE INDEX IF NOT EXISTS idx_properties_updated_at    ON properties(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_created_at    ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status  ON integration_logs(status);

-- ── Unicidad del app_id del CRM (anti-duplicados) ────────────
-- crm_app_id (app_id de 2Clics) debe ser único entre propiedades no vacías.
-- Índice parcial: ignora NULL y '' (PostgreSQL permite múltiples NULL en UNIQUE,
-- y el CRM siempre envía un app_id, así que en la práctica nunca habrá colisión).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_properties_crm_app_id
  ON properties(crm_app_id)
  WHERE crm_app_id IS NOT NULL AND crm_app_id <> '';

-- ── Búsqueda full-text en español (lo usa searchProperties() → textSearch('fts')) ──
-- Columna generada tsvector (config 'spanish') sobre los campos relevantes + índice GIN.
-- Coincide con lib/db/properties.ts: .textSearch('fts', q, { type:'websearch', config:'spanish' })
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish',
      coalesce(titulo, '')      || ' ' ||
      coalesce(descripcion, '') || ' ' ||
      coalesce(ubicacion, '')   || ' ' ||
      coalesce(pais, '')        || ' ' ||
      coalesce(tipo, '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_properties_fts ON properties USING GIN (fts);

-- ── Row Level Security (defensa en profundidad) ──────────────
-- Toda la app accede con la SERVICE ROLE (server-side), que BYPASSA RLS. Activar
-- RLS sin políticas deja sin acceso a los roles anon/authenticated (API pública),
-- por si alguna vez se expusiera una anon key. No rompe nada del backend actual.
ALTER TABLE properties             ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_overrides     ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs       ENABLE ROW LEVEL SECURITY;

-- ── Verificación / limpieza previa al CRM (ejecutar manualmente si hace falta) ──
-- 1) ¿Está vacía la tabla?   →  SELECT count(*) AS total FROM properties;   (esperado: 0)
-- 2) Vaciar datos de prueba  →  TRUNCATE properties CASCADE;  -- borra también property_overrides (FK ON DELETE CASCADE)
-- 3) Confirmar unicidad      →  SELECT crm_app_id, count(*) FROM properties GROUP BY crm_app_id HAVING count(*) > 1;  (esperado: 0 filas)
-- 4) Confirmar RLS activo    →  SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('properties','property_overrides','newsletter_subscribers','integration_logs');
