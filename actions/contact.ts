'use server';

import { headers } from 'next/headers';
import { env, isProduction } from '@/lib/env';
import { escapeHtml, isValidEmail, isValidPhone, MAX_LENGTHS, MOTIVOS_PERMITIDOS } from '@/lib/security/sanitize';
import { isBotRequest, isSpamContent, isTooFast } from '@/lib/security/antibot';
import { checkRate } from '@/lib/security/ratelimit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { buildCrmPayload, sendLeadToCrm } from '@/lib/crm/leads';
import { dbLogIntegration } from '@/lib/db/logs';
import { sendEmail } from '@/lib/resend';
import { createEventId } from '@/lib/tracking';
import { captureError } from '@/lib/observability';

// ── Server Action: formulario de contacto ────────────────────────────────────
// Paridad EXACTA con legacy/server.js POST /api/contact (1135-1316): mismos
// mensajes de error, mismas respuestas silenciosas anti-bot, mismo pipeline 2Clics.

export type ActionResult = { ok: boolean; message?: string; event_id?: string };

function toBody(formData: FormData): Record<string, string> {
  const body: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string') body[k] = v;
  }
  return body;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || h.get('x-real-ip') || '';
}

export async function submitContact(formData: FormData): Promise<ActionResult> {
  const body = toBody(formData);
  const ip = await clientIp();
  const userAgent = (await headers()).get('user-agent') || '';

  // Rate limit: 5 envíos cada 15 minutos por IP
  if (!(await checkRate(ip, 'contact', 5, 15 * 60_000))) {
    return { ok: false, message: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' };
  }

  // Honeypot → silencioso
  if (isBotRequest(body)) return { ok: true };
  // Timing (< 3s) → silencioso
  if (isTooFast(body)) return { ok: true };
  // Spam por contenido → silencioso
  if (isSpamContent(body, userAgent)) return { ok: true };

  const { name, nombre, apellido, phone, telefono, email, message, mensaje, motivo, property_app_id, development_app_id } = body;

  const fullName = String(name || [nombre, apellido].filter(Boolean).join(' ') || '').trim();
  const finalPhone = String(phone || telefono || '').trim();
  const finalEmail = String(email || '').trim();
  const finalMessage = String(message || mensaje || '').trim();
  const motivoVal = String(motivo || '').trim();

  // Validaciones de presencia
  if (!fullName) return { ok: false, message: 'El nombre es requerido.' };
  if (!finalPhone) return { ok: false, message: 'El teléfono es requerido.' };
  if (!finalEmail || !isValidEmail(finalEmail)) return { ok: false, message: 'Ingresá un email válido.' };

  // Validaciones de longitud
  if (fullName.length > MAX_LENGTHS.name) return { ok: false, message: 'El nombre es demasiado largo.' };
  if (finalPhone.length > MAX_LENGTHS.phone) return { ok: false, message: 'El teléfono es demasiado largo.' };
  if (finalEmail.length > MAX_LENGTHS.email) return { ok: false, message: 'El email es demasiado largo.' };
  if (finalMessage.length > MAX_LENGTHS.message)
    return { ok: false, message: `El mensaje no puede superar los ${MAX_LENGTHS.message} caracteres.` };

  // Formato de teléfono
  if (!isValidPhone(finalPhone))
    return { ok: false, message: 'Ingresá un teléfono válido (solo números, espacios, +, -, ()).' };

  // Motivo contra lista blanca
  if (motivoVal && !MOTIVOS_PERMITIDOS.has(motivoVal))
    return { ok: false, message: 'Motivo de consulta no válido.' };

  // Cloudflare Turnstile
  const turnstileToken = String(body['cf-turnstile-response'] || '');
  const turnstileOk = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileOk)
    return { ok: false, message: 'Verificación de seguridad fallida. Recargá la página e intentá nuevamente.' };

  const eventId = body.event_id || createEventId('lead');
  const isPropertyInquiry =
    !!property_app_id ||
    body.form_type === 'property' ||
    body.form_type === 'consulta_propiedad' ||
    !!body.property_title;

  const propId = property_app_id ? Number(property_app_id) : null;
  const devId = development_app_id ? Number(development_app_id) : null;
  const leadType = isPropertyInquiry ? 'consulta_propiedad' : 'consulta_general';

  // ── Fallback: CRM 2Clics aún no configurado ──────────────────────────────
  // Mientras falten CRM_HASH / CRM_AGENT_ID, no perdemos el lead: lo enviamos
  // por email (Resend) al negocio y confirmamos al usuario. Cuando se carguen
  // las credenciales de 2Clics, este branch se salta y vuelve el flujo CRM.
  const crmConfigured = !!env.CRM_HASH && (!!env.CRM_AGENT_ID || !!propId || !!devId);
  if (!crmConfigured) {
    const emailRes = await sendEmail({
      to: env.CONTACT_TO_EMAIL,
      subject: `Nueva consulta web — ${fullName}`,
      html: `<h2 style="font-family:Arial">Nueva consulta desde la web</h2>
        <p style="font-family:Arial"><b>Nombre:</b> ${escapeHtml(fullName)}<br>
        <b>Email:</b> ${escapeHtml(finalEmail)}<br>
        <b>Teléfono:</b> ${escapeHtml(finalPhone)}<br>
        <b>Motivo:</b> ${escapeHtml(motivoVal || '(no indicado)')}<br>
        <b>Mensaje:</b> ${escapeHtml(finalMessage || '(sin mensaje)')}</p>
        <p style="font-family:Arial;color:#999;font-size:12px">event_id: ${escapeHtml(eventId)} · origen: ${escapeHtml(String(body.utm_source || 'directo'))}</p>`,
    });
    if (!emailRes.ok) {
      console.error('[contact] Fallback email falló:', emailRes.error);
      captureError(new Error(`contact fallback email failed: ${emailRes.error}`), {
        source: 'contact-fallback',
        event_id: eventId,
      });
      return {
        ok: false,
        message: 'No pudimos procesar tu consulta en este momento. Por favor intentá de nuevo o escribinos por WhatsApp.',
      };
    }
    await dbLogIntegration({ provider: 'email-fallback', event_type: leadType, crm_app_id: 'fallback', status: 'ok' });
    console.log('[contact] Lead enviado por email (CRM no configurado). event_id:', eventId);
    return { ok: true, event_id: eventId, message: 'Consulta recibida correctamente.' };
  }

  const built = buildCrmPayload({
    fullName,
    phone: finalPhone,
    email: finalEmail,
    message: finalMessage,
    eventId,
    body,
    isPropertyInquiry,
    propId,
    devId,
  });

  if ('error' in built) {
    return { ok: false, message: 'No pudimos procesar tu consulta. Por favor intentá de nuevo más tarde.' };
  }

  // ── Envío a 2Clics — único destino de leads comerciales ──────────────────
  const result = await sendLeadToCrm(built.payload);
  const crmRef = String(propId || devId || 'general');

  if (result.ok) {
    await dbLogIntegration({ provider: '2clics', event_type: leadType, crm_app_id: crmRef, status: 'ok' });
    console.log('[contact] Lead enviado a 2Clics. event_id:', eventId);
    return { ok: true, event_id: eventId, message: 'Consulta recibida correctamente.' };
  }

  // Fallo/timeout — log + alerta técnica SIN PII
  await dbLogIntegration({
    provider: '2clics',
    event_type: leadType,
    crm_app_id: crmRef,
    status: 'error',
    error_message: result.error || 'unknown',
  });
  console.error('[contact] 2Clics falló. event_id:', eventId, '| error:', result.error);
  captureError(new Error(`2Clics lead send failed: ${result.error}`), {
    source: 'contact-crm',
    event_id: eventId,
    crm_ref: crmRef,
  });

  sendEmail({
    to: env.CONTACT_TO_EMAIL,
    subject: '[Alerta técnica] Fallo en envío a 2Clics',
    html: `<p><b>Evento técnico:</b> lead no pudo ser enviado a 2Clics.<br>
      <b>event_id:</b> ${escapeHtml(eventId)}<br>
      <b>form_type:</b> ${escapeHtml(leadType)}<br>
      <b>error:</b> ${escapeHtml(result.error || 'desconocido')}<br>
      <b>timestamp:</b> ${new Date().toISOString()}</p>
      <p style="color:#999;font-size:12px;">Este aviso no contiene datos personales del usuario.</p>`,
  }).catch((e) => console.error('[contact] Alerta técnica Resend falló:', e.message));

  return {
    ok: false,
    message:
      'No pudimos procesar tu consulta en este momento. Por favor intentá de nuevo o escribinos por WhatsApp.',
    ...(isProduction ? {} : { debug_error: result.error }),
  } as ActionResult;
}
