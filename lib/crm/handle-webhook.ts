import 'server-only';
import { env } from '@/lib/env';
import { checkRate } from '@/lib/security/ratelimit';
import { crmToWebProperty, validateHash, MANUAL_ONLY_FIELDS } from '@/lib/crm/twoclics';
import { dbUpsertProperty, dbDeleteProperty } from '@/lib/db/properties';
import { dbLogIntegration } from '@/lib/db/logs';
import { captureError } from '@/lib/observability';

// ── Webhook CRM 2Clics ───────────────────────────────────────────────────────
// Portado de legacy/server.js handle2ClicsWebhook (1077-1132).
// Diferencia pedida por el cliente: del_property hace DELETE FÍSICO (dbDeleteProperty).

const MAX_BODY_BYTES = 50 * 1024; // 50 KB (paridad con el límite del webhook legacy)

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

export async function handle2ClicsWebhook(req: Request): Promise<Response> {
  // Solo JSON
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    return text('UNSUPPORTED_MEDIA_TYPE', 415);
  }
  // Límite de payload
  const len = Number(req.headers.get('content-length') || 0);
  if (len && len > MAX_BODY_BYTES) return text('PAYLOAD_TOO_LARGE', 413);

  // Rate limit: máx 120 llamadas por minuto por IP
  if (!(await checkRate(clientIp(req), '2clics', 120, 60_000))) {
    return text('TOO_MANY_REQUESTS', 429);
  }

  let body: Record<string, any>;
  try {
    body = (await req.json()) as Record<string, any>;
  } catch {
    return text('INVALID_REQUEST', 400);
  }

  const prop = body.prop || body;

  if (!body.getprop || !prop || !prop.action) {
    return text('INVALID_REQUEST', 400);
  }

  // Hash de autorización: sin hash válido → 403 inmediato
  if (!validateHash(prop.hash)) {
    return text('INVALID_HASH', 403);
  }

  const crmAppId = String(prop.prop_id || prop.id_prop_houzez_cli || prop.app_id || '');

  // ── del_property → DELETE físico ──────────────────────────────────────────
  if (prop.action === 'del_property') {
    try {
      await dbDeleteProperty(crmAppId);
      await dbLogIntegration({ provider: '2clics', event_type: 'del_property', crm_app_id: crmAppId, status: 'ok' });
    } catch (err) {
      captureError(err, { source: 'webhook', action: 'del_property', crm_app_id: crmAppId });
      await dbLogIntegration({
        provider: '2clics',
        event_type: 'del_property',
        crm_app_id: crmAppId,
        status: 'error',
        error_message: (err as Error).message,
      });
      return text('DB_ERROR', 500);
    }
    return text('SUCCESS');
  }

  if (!['add_property', 'update_property'].includes(prop.action)) {
    return text('INVALID_ACTION', 400);
  }

  // ── add/update → upsert (sin pisar campos manuales) ───────────────────────
  const mapped = crmToWebProperty(prop) as Record<string, any>;
  for (const field of MANUAL_ONLY_FIELDS) delete mapped[field];

  try {
    await dbUpsertProperty(mapped);
    await dbLogIntegration({ provider: '2clics', event_type: prop.action, crm_app_id: crmAppId, status: 'ok' });
  } catch (err) {
    captureError(err, { source: 'webhook', action: prop.action, crm_app_id: crmAppId });
    await dbLogIntegration({
      provider: '2clics',
      event_type: prop.action,
      crm_app_id: crmAppId,
      status: 'error',
      error_message: (err as Error).message,
    });
    return text('DB_ERROR', 500);
  }

  const propertyUrl = `${env.PUBLIC_BASE_URL}/propiedad?id=${encodeURIComponent(mapped.id)}`;
  return text(`${mapped.id}|${propertyUrl}`);
}
