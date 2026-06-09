const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { Resend } = require('resend');

// v3.0 — privacy page, GTM events, SEO canonical, 404 page, newsletter_signup event
// ── Variables de entorno ─────────────────────────────────────────────────────
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = valueParts.join('=').trim();
  }
}

loadEnvFile();

const app = express();
app.disable('x-powered-by');

const PORT           = process.env.PORT    || 3000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const CRM_HASH            = process.env.CRM_HASH || '';
const CRM_AGENT_ID        = Number(process.env.CRM_AGENT_ID || 123);
const CRM_MESSAGE_URL     = process.env.CRM_MESSAGE_URL || 'https://api.2clics.com.ar/api/external/message';
const TURNSTILE_SECRET_KEY= process.env.TURNSTILE_SECRET_KEY || '';
const TURNSTILE_VERIFY_URL= 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const CONTACT_TO_EMAIL   = process.env.CONTACT_TO_EMAIL   || '';
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'García Inversiones <onboarding@resend.dev>';

const DATA_DIR        = path.join(__dirname, 'data');
const PUBLIC_DIR      = path.join(__dirname, 'public');
const PROPERTIES_FILE = path.join(DATA_DIR, 'properties.json');
const LEADS_FILE      = path.join(DATA_DIR, 'leads.json');
const NEWSLETTER_FILE = path.join(DATA_DIR, 'newsletter.json');

// ── Rate limiter simple en memoria ───────────────────────────────────────────
const _rlMap = new Map();
function checkRate(ip, key, max = 10, windowMs = 60_000) {
  const id = `${ip}:${key}`;
  const now = Date.now();
  const rec = _rlMap.get(id) || { n: 0, until: now + windowMs };
  if (now > rec.until) { rec.n = 0; rec.until = now + windowMs; }
  rec.n++;
  _rlMap.set(id, rec);
  return rec.n <= max;
}
// Limpiar entradas expiradas cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rlMap) { if (now > v.until) _rlMap.delete(k); }
}, 600_000);

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use((req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || '';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // GTM + GA4 + Google Ads + Meta Pixel
      "script-src 'self' 'unsafe-inline'"
        + " https://www.googletagmanager.com"
        + " https://www.google-analytics.com"
        + " https://ssl.google-analytics.com"
        + " https://www.googleadservices.com"
        + " https://googleads.g.doubleclick.net"
        + " https://www.google.com"
        + " https://connect.facebook.net"
        + " https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      // Fetch/XHR: analytics + CRM + Meta CAPI
      "connect-src 'self'"
        + " https://www.google-analytics.com"
        + " https://analytics.google.com"
        + " https://region1.google-analytics.com"
        + " https://stats.g.doubleclick.net"
        + " https://www.googleadservices.com"
        + " https://googleads.g.doubleclick.net"
        + " https://connect.facebook.net"
        + " https://www.facebook.com"
        + " https://facebook.com"
        + " https://challenges.cloudflare.com"
        + " https://api.2clics.com.ar",
      // iframes: Google Maps + YouTube + GTM noscript
      "frame-src"
        + " https://www.google.com"
        + " https://maps.google.com"
        + " https://www.youtube.com"
        + " https://www.googletagmanager.com"
        + " https://td.doubleclick.net"
        + " https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  // Adjuntar IP al request para uso en rate limiting
  req._clientIp = ip;
  next();
});

// ── CORS: solo permitir mismo origen en endpoints POST de /api/ ───────────────
// Agrega aquí el dominio Vercel preview si necesitás probar desde ese entorno
const _wwwVariant = PUBLIC_BASE_URL.replace('https://', 'https://www.');
const ALLOWED_ORIGINS = [
  PUBLIC_BASE_URL,
  _wwwVariant,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin || '';
  // Si no hay Origin header (servidor→servidor, curl, Postman) se permite pasar
  // Los endpoints sensibles tienen su propia validación de hash
  if (origin && !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    return res.status(403).json({ ok: false, message: 'Origen no permitido.' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  next();
});

app.options('/api/*', (_req, res) => res.sendStatus(204));

// ── Redirecciones 301: .html → URL limpia (preserva query string) ─────────────
app.get('/index.html',         (req, res) => res.redirect(301, `/${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));
app.get('/propiedades.html',   (req, res) => res.redirect(301, `/propiedades${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));
app.get('/propiedad.html',     (req, res) => res.redirect(301, `/propiedad${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));
app.get('/gracias-consulta.html', (_req, res) => res.redirect(301, '/gracias-consulta'));

app.use(express.static(PUBLIC_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(?:png|jpe?g|svg|webp|gif)$/i.test(filePath)) {
      // Imágenes: cache largo con revalidación
      res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
    } else if (/\.(?:css|js)$/i.test(filePath)) {
      // CSS/JS: siempre revalidar (ETag permite cache hit sin re-descarga si no cambió)
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── Utilidades ───────────────────────────────────────────────────────────────
function ensureFile(filePath, fallback = []) {
  if (process.env.VERCEL) {
    return;
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath, fallback = []) {
  ensureFile(filePath, fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  if (process.env.VERCEL) {
    // En Vercel el filesystem es read-only — los datos van solo a la DB/CRM externo
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// FIX SEGURIDAD: función para escapar HTML antes de insertar inputs en emails
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// FIX SEGURIDAD: validación de formato de email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// Longitudes máximas aceptadas por campo
const MAX_LENGTHS = {
  name:    120,
  phone:    30,
  email:   254,
  message: 2000,
  motivo:  100,
};

// Validación básica de formato de teléfono
function isValidPhone(phone) {
  return /^[+\d\s\-().]{6,30}$/.test(String(phone || '').trim());
}

// Honeypot anti-bot: el campo "website" debe estar vacío (oculto para humanos, bots lo llenan)
function isBotRequest(body = {}) {
  return typeof body.website === 'string' && body.website.length > 0;
}

// ── Cloudflare Turnstile ─────────────────────────────────────────────────────
async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET_KEY) {
    // Sin clave configurada: skip (útil en desarrollo local)
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY no configurada — saltando validación.');
    return true;
  }
  if (!token) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip || '' }),
      signal:  controller.signal
    });
    clearTimeout(timer);
    const data = await response.json();
    if (!data.success) console.warn('[Turnstile] Falló. Códigos:', data['error-codes']);
    return data.success === true;
  } catch (err) {
    // Error de red → fail open para no bloquear usuarios legítimos
    console.error('[Turnstile] Error de red:', err.message);
    return true;
  }
}

// ── Filtro anti-spam por contenido ──────────────────────────────────────────
const SPAM_PHRASES = [
  'automated test', 'kindly disregard', 'this is a test message',
  'seo service', 'seo services', 'buy backlinks', 'crypto', 'casino',
  'loan offer', 'payday loan', 'viagra', 'cialis', 'free traffic',
  'backlink', 'guest post', 'adult content', 'make money fast'
];

function isSpamContent(body = {}, userAgent = '') {
  const combined = [
    body.nombre, body.apellido, body.name, body.email,
    body.telefono, body.phone, body.motivo, body.message, body.mensaje
  ].filter(Boolean).join(' ').toLowerCase();

  // 1. Frases de spam conocidas
  if (SPAM_PHRASES.some(p => combined.includes(p))) {
    console.warn('[spam] Frase detectada en payload');
    return true;
  }

  // 2. Demasiados links en el mensaje
  const msg = String(body.message || body.mensaje || '');
  if ((msg.match(/https?:\/\//gi) || []).length >= 3) {
    console.warn('[spam] Demasiados links en mensaje');
    return true;
  }

  // 3. Nombre genérico repetido (ej: "Test Test", "Xyz Xyz")
  const n = String(body.nombre || '').trim().toLowerCase();
  const a = String(body.apellido || '').trim().toLowerCase();
  if (n && a && n === a && n.length > 1) {
    console.warn('[spam] Nombre === apellido:', n);
    return true;
  }

  // 4. User-agent ausente o claramente automatizado
  const ua = String(userAgent || '').trim();
  if (!ua || ua.length < 10 || /^(curl|python|java|go-http|okhttp|axios|libwww)/i.test(ua)) {
    console.warn('[spam] User-agent sospechoso:', ua || '(vacío)');
    return true;
  }

  return false;
}

// ── Control de tiempo mínimo (timing check) ──────────────────────────────────
function isTooFast(body = {}) {
  const raw = parseInt(body._form_loaded_at || '', 10);
  if (!raw || isNaN(raw)) return false; // sin timestamp → no bloquear
  const elapsed = Date.now() - raw;
  if (elapsed < 3000) {
    console.warn('[timing] Formulario enviado demasiado rápido:', elapsed, 'ms');
    return true;
  }
  return false;
}

// Valores permitidos para el campo motivo del formulario de contacto
const MOTIVOS_PERMITIDOS = new Set([
  '', 'Inversión inmobiliaria', 'Compra de propiedad', 'Venta de propiedad',
  'Alquiler de propiedad', 'Mercados internacionales', 'Asesoramiento general'
]);

function slugify(text) {
  return String(text || 'propiedad')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'propiedad';
}

function normalizeOperation(operation = '') {
  const value = String(operation).toLowerCase();
  if (value.includes('alquiler temporario')) return 'alquiler-temporario';
  if (value.includes('alquiler'))           return 'alquiler';
  if (value.includes('venta'))              return 'venta';
  return 'proyecto';
}

function getFeaturedImage(prop) {
  const images  = Array.isArray(prop.imagenes_propiedad) ? prop.imagenes_propiedad : [];
  const featured = images.find(img => img && img.featured_image) || images[0];
  return featured?.source || 'assets/propiedades/condor-resort.jpeg';
}

function formatPrice(prop) {
  const price    = prop.precio_propiedad || prop.precio || '';
  const currency = prop.moneda_propiedad || prop.moneda || '';
  if (!price) return 'Consultar';
  const numeric  = Number(price);
  const display  = Number.isFinite(numeric) ? numeric.toLocaleString('es-AR') : String(price);
  return `${currency} ${display}`.trim();
}

function crmToWebProperty(prop) {
  const appId         = String(prop.app_id || prop.id_prop_houzez_cli || prop.codigo_propiedad || Date.now());
  const id            = String(prop.id_prop_houzez_cli || appId);
  const isDevelopment = String(prop.tipo || '').toLowerCase() === 'emprendimiento';
  const operation     = isDevelopment ? 'proyecto' : normalizeOperation(prop.operacion);
  const city          = [prop.barrio, prop.ciudad || prop.provincia].filter(Boolean).join(' · ');

  return {
    id,
    app_id:          appId,
    crm_code:        prop.codigo_propiedad || '',
    titulo:          prop.titulo           || 'Propiedad sin título',
    operacion:       operation,
    tipo:            isDevelopment ? 'emprendimiento' : (prop.tipo || 'propiedad').toLowerCase(),
    precio:          formatPrice(prop),
    precio_numero:   Number(prop.precio_propiedad || prop.precio) || null,
    moneda:          prop.moneda_propiedad || prop.moneda || '',
    pais:            prop.pais    || prop.country || '',
    ubicacion:       city || 'Ubicación a consultar',
    descripcion:     prop.descripcion || '',
    imagen:          getFeaturedImage(prop),
    ambientes:       prop.ambientes_propiedad ? `${prop.ambientes_propiedad} ambientes` : (prop.dormitorios ? `${prop.dormitorios} dorm.` : ''),
    banos:           prop.banos ? `${prop.banos} baños` : '',
    superficie:      prop.superficie_total ? `${prop.superficie_total} m²` : '',
    tag:             prop.prop_featured ? 'Destacada' : (isDevelopment ? 'Proyecto' : (prop.operacion || 'Propiedad')),
    linkWhatsapp:    `https://wa.me/5491167240353?text=${encodeURIComponent(`Hola, me interesa ${prop.titulo || 'esta propiedad'}`)}`,
    linkMercadoLibre:'',
    linkZonaprop:    '',
    video:           prop.prop_video_url && prop.prop_video_url !== 'null' ? prop.prop_video_url : '',
    tour:            prop.virtual_tour   && prop.virtual_tour   !== 'null' ? prop.virtual_tour   : '',
    productorNombre: prop.productorNombre || prop.productor_nombre || '',
    productorEmail:  prop.productorEmail  || prop.productor_email  || CONTACT_TO_EMAIL || '',
    amenities:       Array.isArray(prop.amenities) ? prop.amenities.map(a => a.name).filter(Boolean) : [],
    raw:             prop,
    updated_at:      new Date().toISOString()
  };
}

// FIX SEGURIDAD: validateHash rechaza si el hash no está configurado en .env
function validateHash(hash) {
  if (!CRM_HASH) return false;
  return hash === CRM_HASH;
}

function createEventId(prefix = 'server') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function sendEmail({ to, subject, html }) {
  console.log('[sendEmail] Enviando email...');

  if (!resend) {
    console.error('[sendEmail] RESEND_API_KEY no está configurada.');
    return { ok: false, error: 'RESEND_API_KEY no configurada' };
  }

  if (!to) {
    console.error('[sendEmail] CONTACT_TO_EMAIL no está configurado.');
    return { ok: false, error: 'Destinatario no configurado (CONTACT_TO_EMAIL)' };
  }

  try {
    const result = await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to,
      subject,
      html
    });

    if (result?.error) {
      console.error("Resend rechazó el envío:", result.error);
      return {
        ok: false,
        error: result.error.message || "Resend rechazó el envío",
        details: result.error
      };
    }

    console.log('[sendEmail] Email enviado correctamente. ID:', result.data?.id || '(sin id)');

    return {
      ok: true,
      result: result.data
    };
  } catch (error) {
    console.error("Error enviando email con Resend:", error);
    return {
      ok: false,
      error: error.message || "Error desconocido enviando email"
    };
  }
}

function pickTrackingFields(body = {}) {
  const keys = [
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term',
    'gclid','gbraid','wbraid','fbclid',
    'landing_page','referrer','first_visit_date','last_visit_date',
    'current_page','page_location','page_title','session_id','event_id',
    'form_name','lead_type'
  ];

  return keys.reduce((acc, key) => {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') acc[key] = body[key];
    return acc;
  }, {});
}

function normalizeLeadPayload(body = {}) {
  return {
    ...body,
    tracking:    pickTrackingFields(body),
    received_at: new Date().toISOString()
  };
}

// ── Rutas API ────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'garcia-web', timestamp: new Date().toISOString() });
});

app.get('/sitemap.xml', (_req, res) => {
  // Siempre usar el dominio canónico www en el sitemap
  const base = 'https://www.garciainversionesinmobiliarias.com.ar';
  const today = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>
  <url><loc>${base}/propiedades</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>
  <url><loc>${base}/privacidad</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>`);
});

app.get('/api/properties', (_req, res) => {
  res.json(readJson(PROPERTIES_FILE, []));
});

app.get('/api/properties/:id', (req, res) => {
  const properties  = readJson(PROPERTIES_FILE, []);
  const requestedId = String(req.params.id || '');
  const property    = properties.find(item =>
    String(item.id)     === requestedId ||
    String(item.app_id) === requestedId ||
    requestedId.startsWith(`${item.id}-`) ||
    requestedId.startsWith(`${item.app_id}-`)
  );
  if (!property) return res.status(404).json({ ok: false, message: 'Propiedad no encontrada.' });
  res.json(property);
});

app.get('/propiedad/:id', (req, res) => {
  const properties  = readJson(PROPERTIES_FILE, []);
  const requestedId = String(req.params.id || '');
  const property    = properties.find(item =>
    String(item.id)     === requestedId ||
    String(item.app_id) === requestedId ||
    requestedId.startsWith(`${item.id}-`) ||
    requestedId.startsWith(`${item.app_id}-`)
  );
  if (!property) return res.redirect('/propiedades.html');
  return res.redirect(`/propiedad.html?id=${encodeURIComponent(property.id)}`);
});

// ── Webhook CRM 2Clics ───────────────────────────────────────────────────────
app.post('/api/2clics/property', (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).send('UNSUPPORTED_MEDIA_TYPE');
  }
  // Rate limit: máx 120 llamadas por minuto por IP (margen para CRM legítimo)
  if (!checkRate(req._clientIp, '2clics', 120, 60_000)) {
    return res.status(429).send('TOO_MANY_REQUESTS');
  }

  const body = req.body || {};
  const prop = body.prop || body;

  if (!body.getprop || !prop || !prop.action) {
    return res.status(400).send('INVALID_REQUEST');
  }

  if (!validateHash(prop.hash)) {
    return res.status(403).send('INVALID_HASH');
  }

  const properties = readJson(PROPERTIES_FILE, []);

  if (prop.action === 'del_property') {
    const propId   = String(prop.prop_id || prop.id_prop_houzez_cli || prop.app_id || '');
    const filtered = properties.filter(item =>
      String(item.id) !== propId && String(item.app_id) !== propId
    );
    writeJson(PROPERTIES_FILE, filtered);
    return res.type('text/plain').send('SUCCESS');
  }

  if (!['add_property', 'update_property'].includes(prop.action)) {
    return res.status(400).send('INVALID_ACTION');
  }

  const mapped = crmToWebProperty(prop);
  const index  = properties.findIndex(item =>
    String(item.app_id) === String(mapped.app_id) ||
    String(item.id)     === String(mapped.id)     ||
    (mapped.crm_code && item.crm_code === mapped.crm_code)
  );

  if (index >= 0) properties[index] = { ...properties[index], ...mapped };
  else properties.unshift(mapped);

  writeJson(PROPERTIES_FILE, properties);

  const propertyUrl = `${PUBLIC_BASE_URL}/propiedad/${encodeURIComponent(mapped.id)}-${slugify(mapped.titulo)}`;
  return res.type('text/plain').send(`${mapped.id}|${propertyUrl}`);
});

// ── Formulario de contacto ───────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ ok: false, message: 'Formato no soportado.' });
  }
  // Rate limit: 5 envíos cada 15 minutos por IP
  if (!checkRate(req._clientIp, 'contact', 5, 15 * 60_000)) {
    return res.status(429).json({ ok: false, message: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' });
  }

  // Honeypot: si el campo oculto "website" tiene contenido, es un bot
  if (isBotRequest(req.body)) {
    return res.json({ ok: true }); // silencioso
  }

  // Timing: formulario enviado en menos de 3 segundos → bot
  if (isTooFast(req.body)) {
    return res.json({ ok: true }); // silencioso
  }

  // Filtro de contenido spam
  if (isSpamContent(req.body, req.headers['user-agent'])) {
    return res.json({ ok: true }); // silencioso — no alertar al bot
  }

  const { name, nombre, apellido, phone, telefono, email, message, mensaje, motivo, property_app_id, development_app_id } = req.body || {};

  const fullName     = String(name || [nombre, apellido].filter(Boolean).join(' ') || '').trim();
  const finalPhone   = String(phone    || telefono || '').trim();
  const finalEmail   = String(email    || '').trim();
  const finalMessage = String(message  || mensaje  || '').trim();
  const motivoVal    = String(motivo   || '').trim();

  // Validaciones de presencia
  if (!fullName) {
    return res.status(400).json({ ok: false, message: 'El nombre es requerido.' });
  }
  if (!finalPhone) {
    return res.status(400).json({ ok: false, message: 'El teléfono es requerido.' });
  }
  if (!finalEmail || !isValidEmail(finalEmail)) {
    return res.status(400).json({ ok: false, message: 'Ingresá un email válido.' });
  }

  // Validaciones de longitud
  if (fullName.length > MAX_LENGTHS.name) {
    return res.status(400).json({ ok: false, message: 'El nombre es demasiado largo.' });
  }
  if (finalPhone.length > MAX_LENGTHS.phone) {
    return res.status(400).json({ ok: false, message: 'El teléfono es demasiado largo.' });
  }
  if (finalEmail.length > MAX_LENGTHS.email) {
    return res.status(400).json({ ok: false, message: 'El email es demasiado largo.' });
  }
  if (finalMessage.length > MAX_LENGTHS.message) {
    return res.status(400).json({ ok: false, message: `El mensaje no puede superar los ${MAX_LENGTHS.message} caracteres.` });
  }

  // Validación de formato de teléfono
  if (!isValidPhone(finalPhone)) {
    return res.status(400).json({ ok: false, message: 'Ingresá un teléfono válido (solo números, espacios, +, -, ()).' });
  }

  // Validación de motivo contra lista permitida
  if (motivoVal && !MOTIVOS_PERMITIDOS.has(motivoVal)) {
    return res.status(400).json({ ok: false, message: 'Motivo de consulta no válido.' });
  }

  // Cloudflare Turnstile — validar token antes de procesar
  const turnstileToken = String(req.body?.['cf-turnstile-response'] || '');
  const turnstileOk = await verifyTurnstile(turnstileToken, req._clientIp);
  if (!turnstileOk) {
    return res.status(400).json({ ok: false, message: 'Verificación de seguridad fallida. Recargá la página e intentá nuevamente.' });
  }

  const eventId = req.body?.event_id || createEventId('lead');

  const payload = {
    name:      fullName,
    phone:     finalPhone,
    email:     finalEmail,
    message:   finalMessage || 'Consulta desde la web García Inversiones Inmobiliarias',
    hash:      CRM_HASH,
    event_id:  eventId,
    source:    req.body?.utm_source   || '',
    medium:    req.body?.utm_medium   || '',
    campaign:  req.body?.utm_campaign || '',
    gclid:     req.body?.gclid        || '',
    gbraid:    req.body?.gbraid       || '',
    wbraid:    req.body?.wbraid       || '',
    fbclid:    req.body?.fbclid       || '',
    lead_type: req.body?.lead_type    || (property_app_id ? 'consulta_propiedad' : 'consulta_general'),
    form_name: req.body?.form_name    || ''
  };

  if (property_app_id)     payload.property_app_id  = Number(property_app_id);
  else if (development_app_id) payload.development_app_id = Number(development_app_id);
  else payload.agent = CRM_AGENT_ID;

  const leads = readJson(LEADS_FILE, []);
  leads.unshift({
    ...normalizeLeadPayload(req.body),
    crm_payload:      payload,
    created_at:       new Date().toISOString(),
    estado_comercial: 'nuevo'
  });
  writeJson(LEADS_FILE, leads);

  const emailTo = CONTACT_TO_EMAIL;

  // Detectar si es consulta de propiedad específica
  const isPropertyInquiry =
    req.body?.form_type === 'property' ||
    req.body?.form_type === 'consulta_propiedad' ||
    !!(req.body?.property_title) ||
    !!property_app_id;

  const propertyTitle = escapeHtml(String(req.body?.property_title || '').trim().slice(0, 200));
  const propertyUrl   = escapeHtml(String(req.body?.property_url || req.body?.page_location || '').trim());

  // Asunto diferenciado por tipo de consulta
  const emailSubject = isPropertyInquiry
    ? propertyTitle
      ? `Nueva consulta por propiedad — ${propertyTitle}`
      : 'Nueva consulta por propiedad'
    : 'Nueva consulta desde la web';

  // Bloque HTML de propiedad (solo si aplica)
  const propertyBlock = isPropertyInquiry ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="background:#f0f4f8; border-left:4px solid #cd9f4f; padding:16px 20px; border-radius:0 8px 8px 0;">
              <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#666;">Propiedad consultada</p>
              <p style="margin:0 0 4px; font-size:17px; font-weight:700; color:#071628;">${propertyTitle || '<em>Sin título</em>'}</p>
              ${propertyUrl ? `<p style="margin:6px 0 0;"><a href="${propertyUrl}" style="color:#cd9f4f; font-size:13px;">${propertyUrl}</a></p>` : ''}
            </td>
          </tr>
        </table>` : '';

  const dateStr = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  // Todos los valores del usuario escapados antes de insertar en HTML
  const emailResult = await sendEmail({
    to:      emailTo,
    subject: emailSubject,
    html: `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#071628 0%,#0c2948 100%);padding:28px 36px;">
            <p style="margin:0;font-size:13px;color:#cd9f4f;letter-spacing:2px;text-transform:uppercase;">García Inversiones Inmobiliarias</p>
            <h1 style="margin:8px 0 0;font-size:20px;color:#ffffff;font-weight:600;">${isPropertyInquiry ? '🏠 Nueva consulta por propiedad' : '📬 Nueva consulta desde la web'}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            ${propertyBlock}

            <!-- Datos del interesado -->
            <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Datos del interesado</p>
            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="width:140px;color:#666;font-size:14px;">Nombre</td>
                <td style="font-size:14px;font-weight:600;color:#071628;">${escapeHtml(fullName)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="color:#666;font-size:14px;">WhatsApp / Tel.</td>
                <td style="font-size:14px;font-weight:600;color:#071628;"><a href="https://wa.me/${encodeURIComponent(finalPhone.replace(/\D/g,''))}" style="color:#cd9f4f;">${escapeHtml(finalPhone)}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="color:#666;font-size:14px;">Email</td>
                <td style="font-size:14px;font-weight:600;color:#071628;"><a href="mailto:${escapeHtml(finalEmail)}" style="color:#cd9f4f;">${escapeHtml(finalEmail)}</a></td>
              </tr>
              ${motivoVal ? `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="color:#666;font-size:14px;">Motivo</td>
                <td style="font-size:14px;color:#071628;">${escapeHtml(motivoVal)}</td>
              </tr>` : ''}
              ${finalMessage ? `
              <tr>
                <td style="color:#666;font-size:14px;vertical-align:top;padding-top:10px;">Mensaje</td>
                <td style="font-size:14px;color:#071628;padding-top:10px;">${escapeHtml(finalMessage)}</td>
              </tr>` : ''}
            </table>

            ${(payload.source || payload.medium || payload.campaign || payload.gclid || payload.fbclid) ? `
            <!-- Origen y tracking -->
            <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Origen del lead</p>
            <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#555;margin-bottom:16px;">
              ${payload.source   ? `<tr><td style="width:140px;">UTM Source</td><td>${escapeHtml(payload.source)}</td></tr>` : ''}
              ${payload.medium   ? `<tr><td>UTM Medium</td><td>${escapeHtml(payload.medium)}</td></tr>` : ''}
              ${payload.campaign ? `<tr><td>UTM Campaign</td><td>${escapeHtml(payload.campaign)}</td></tr>` : ''}
              ${payload.gclid    ? `<tr><td>GCLID</td><td>${escapeHtml(payload.gclid)}</td></tr>` : ''}
              ${payload.fbclid   ? `<tr><td>FBCLID</td><td>${escapeHtml(payload.fbclid)}</td></tr>` : ''}
            </table>` : ''}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">Recibido el ${dateStr} · García Inversiones Inmobiliarias</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`
  });

  if (!emailResult.ok) {
    // En producción no exponer detalles internos del error de email
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    console.error('[/api/contact] Error de email:', emailResult.error);
    return res.status(500).json({
      ok: false,
      message: 'No pudimos procesar tu consulta. Por favor intentá de nuevo más tarde o escribinos por WhatsApp.',
      ...(isProduction ? {} : { debug_error: emailResult.error })
    });
  }

  let crmOk     = false;
  let crmStatus = null;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(CRM_MESSAGE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal
    });

    clearTimeout(timeout);
    crmOk     = response.ok;
    crmStatus = response.status;
  } catch (_) {
    crmOk = false;
  }

  console.log('[/api/contact] Lead procesado. event_id:', eventId, '| crmOk:', crmOk);
  res.json({ ok: true, crmOk, crmStatus, event_id: eventId, message: 'Consulta recibida correctamente.' });
});

// ── Newsletter ───────────────────────────────────────────────────────────────
app.post('/api/newsletter', async (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ ok: false, message: 'Formato no soportado.' });
  }
  // Rate limit: 3 envíos cada 15 minutos por IP
  if (!checkRate(req._clientIp, 'newsletter', 3, 15 * 60_000)) {
    return res.status(429).json({ ok: false, message: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' });
  }

  // Honeypot anti-bot
  if (isBotRequest(req.body)) {
    return res.json({ ok: true }); // silencioso
  }

  // Timing: suscripción en menos de 3 segundos → bot
  if (isTooFast(req.body)) {
    return res.json({ ok: true }); // silencioso
  }

  const email = String(req.body?.newsletter_email || req.body?.email || '').trim();

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Ingresá un email válido.' });
  }
  if (email.length > MAX_LENGTHS.email) {
    return res.status(400).json({ ok: false, message: 'Email inválido.' });
  }

  // Filtro spam en email de newsletter (dominios desechables, patrones sospechosos)
  if (isSpamContent({ email }, req.headers['user-agent'])) {
    return res.json({ ok: true }); // silencioso
  }

  // Cloudflare Turnstile — validar token antes de procesar
  const turnstileToken = String(req.body?.['cf-turnstile-response'] || '');
  const turnstileOk = await verifyTurnstile(turnstileToken, req._clientIp);
  if (!turnstileOk) {
    return res.status(400).json({ ok: false, message: 'Verificación de seguridad fallida. Recargá la página e intentá nuevamente.' });
  }

  const eventId     = req.body?.event_id || createEventId('newsletter');
  const subscribers = readJson(NEWSLETTER_FILE, []);

  if (!subscribers.some(item => item.email.toLowerCase() === email.toLowerCase())) {
    subscribers.unshift({
      email,
      event_id:   eventId,
      tracking:   pickTrackingFields(req.body),
      created_at: new Date().toISOString()
    });
    writeJson(NEWSLETTER_FILE, subscribers);
  }

  const nlSource   = escapeHtml(req.body?.utm_source   || '');
  const nlMedium   = escapeHtml(req.body?.utm_medium   || '');
  const nlCampaign = escapeHtml(req.body?.utm_campaign || '');
  const nlPage     = escapeHtml(req.body?.page_location || '');
  const nlDateStr  = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const emailResult = await sendEmail({
    to:      CONTACT_TO_EMAIL,
    subject: 'Nueva suscripción al newsletter',
    html: `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#071628 0%,#0c2948 100%);padding:28px 36px;">
            <p style="margin:0;font-size:13px;color:#cd9f4f;letter-spacing:2px;text-transform:uppercase;">García Inversiones Inmobiliarias</p>
            <h1 style="margin:8px 0 0;font-size:20px;color:#ffffff;font-weight:600;">📩 Nueva suscripción al newsletter</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            <!-- Bloque email suscriptor -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f0f4f8;border-left:4px solid #cd9f4f;padding:16px 20px;border-radius:0 8px 8px 0;">
                  <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;">Nuevo suscriptor</p>
                  <p style="margin:0;font-size:17px;font-weight:700;color:#071628;">${escapeHtml(email)}</p>
                </td>
              </tr>
            </table>

            <!-- Detalles -->
            <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Detalle de la suscripción</p>
            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="width:140px;color:#666;font-size:14px;">Fecha</td>
                <td style="font-size:14px;font-weight:600;color:#071628;">${nlDateStr}</td>
              </tr>
              ${nlPage ? `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="color:#666;font-size:14px;">Página de origen</td>
                <td style="font-size:14px;color:#071628;">${nlPage}</td>
              </tr>` : ''}
            </table>

            ${(nlSource || nlMedium || nlCampaign) ? `
            <!-- Origen y tracking -->
            <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Origen del lead</p>
            <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#555;margin-bottom:16px;">
              ${nlSource   ? `<tr><td style="width:140px;">UTM Source</td><td>${nlSource}</td></tr>`   : ''}
              ${nlMedium   ? `<tr><td>UTM Medium</td><td>${nlMedium}</td></tr>`                         : ''}
              ${nlCampaign ? `<tr><td>UTM Campaign</td><td>${nlCampaign}</td></tr>`                     : ''}
            </table>` : ''}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">Recibido el ${nlDateStr} · García Inversiones Inmobiliarias</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`
  });

  if (!emailResult.ok) {
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    console.error('[/api/newsletter] Error de email:', emailResult.error);
    return res.status(500).json({
      ok: false,
      message: 'No pudimos procesar la suscripción. Por favor intentá de nuevo más tarde.',
      ...(isProduction ? {} : { debug_error: emailResult.error })
    });
  }

  console.log('[/api/newsletter] Email enviado correctamente.');

  res.json({ ok: true, event_id: eventId, message: 'Suscripción recibida correctamente.' });
});

// ── Webhook genérico CRM ─────────────────────────────────────────────────────
app.post('/api/crm-webhook', (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ ok: false, message: 'Formato no soportado.' });
  }
  // Rate limit
  if (!checkRate(req._clientIp, 'crm_webhook', 60, 60_000)) {
    return res.status(429).json({ ok: false, message: 'Demasiadas solicitudes.' });
  }

  // Validar hash de autorización (mismo mecanismo que /api/2clics/property)
  const hash = req.body?.hash || req.headers['x-webhook-hash'] || '';
  if (!validateHash(hash)) {
    return res.status(403).json({ ok: false, message: 'No autorizado.' });
  }

  const eventId   = req.body?.event_id || createEventId('crm_webhook');
  const eventName = req.body?.event    || req.body?.action || 'crm_event';

  console.log('[/api/crm-webhook] Evento recibido. ID:', eventId, '| Tipo:', eventName);

  return res.json({ ok: true, event_id: eventId, message: 'Webhook CRM recibido correctamente.' });
});

// ── Conversiones (preparado para Meta CAPI y Google Offline) ─────────────────
app.post('/api/conversions/meta', async (req, res) => {
  const eventId = req.body?.event_id || createEventId('meta_capi');
  return res.json({
    ok:       true,
    event_id: eventId,
    prepared: true,
    message:  'Endpoint preparado para Meta CAPI. Configurar META_PIXEL_ID y META_ACCESS_TOKEN.'
  });
});

app.post('/api/conversions/google-offline', async (req, res) => {
  const eventId = req.body?.event_id || createEventId('google_offline');
  return res.json({
    ok:       true,
    event_id: eventId,
    prepared: true,
    message:  'Endpoint preparado para conversiones offline de Google Ads.'
  });
});

// ── URLs limpias: servir HTML sin extensión ───────────────────────────────────
// Express static ya resuelve "/" → index.html; estas cubren el resto.
app.get('/propiedades',     (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'propiedades.html')));
app.get('/propiedad',       (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'propiedad.html')));
app.get('/gracias-consulta',(_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'gracias-consulta.html')));

// ── Arranque ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`García Inversiones Inmobiliarias listo en http://localhost:${PORT}`);
  });
}

module.exports = app;
