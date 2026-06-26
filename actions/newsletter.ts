'use server';

import { headers } from 'next/headers';
import { env, isProduction } from '@/lib/env';
import { escapeHtml, isValidEmail, MAX_LENGTHS } from '@/lib/security/sanitize';
import { isBotRequest, isSpamContent, isTooFast } from '@/lib/security/antibot';
import { checkRate } from '@/lib/security/ratelimit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { dbInsertNewsletter } from '@/lib/db/newsletter';
import { sendEmail } from '@/lib/resend';
import { createEventId } from '@/lib/tracking';
import { captureError } from '@/lib/observability';
import type { ActionResult } from '@/actions/contact';

// ── Server Action: newsletter ────────────────────────────────────────────────
// Paridad EXACTA con legacy/server.js POST /api/newsletter (1319-1476).

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

export async function submitNewsletter(formData: FormData): Promise<ActionResult> {
  const body = toBody(formData);
  const ip = await clientIp();
  const userAgent = (await headers()).get('user-agent') || '';

  // Rate limit: 3 envíos cada 15 minutos por IP
  if (!(await checkRate(ip, 'newsletter', 3, 15 * 60_000))) {
    return { ok: false, message: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' };
  }

  // Honeypot → silencioso
  if (isBotRequest(body)) return { ok: true };
  // Timing → silencioso
  if (isTooFast(body)) return { ok: true };

  const email = String(body.newsletter_email || body.email || '').trim();

  if (!email || !isValidEmail(email)) return { ok: false, message: 'Ingresá un email válido.' };
  if (email.length > MAX_LENGTHS.email) return { ok: false, message: 'Email inválido.' };

  // Filtro spam en email → silencioso
  if (isSpamContent({ email }, userAgent)) return { ok: true };

  // Turnstile
  const turnstileToken = String(body['cf-turnstile-response'] || '');
  const turnstileOk = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileOk)
    return { ok: false, message: 'Verificación de seguridad fallida. Recargá la página e intentá nuevamente.' };

  const eventId = body.event_id || createEventId('newsletter');

  let isNewSubscriber = false;
  try {
    const result = await dbInsertNewsletter({
      email,
      origen: String(body.page_location || '').slice(0, 500),
      utm_source: String(body.utm_source || '').slice(0, 200),
      utm_medium: String(body.utm_medium || '').slice(0, 200),
      utm_campaign: String(body.utm_campaign || '').slice(0, 200),
    });
    isNewSubscriber = result?.isNew !== false;
  } catch (err) {
    console.error('[newsletter] Error DB:', (err as Error).message);
    captureError(err, { source: 'newsletter-db' });
    return {
      ok: false,
      message: 'No pudimos procesar la suscripción. Por favor intentá de nuevo más tarde.',
      ...(isProduction ? {} : { debug_error: (err as Error).message }),
    } as ActionResult;
  }

  // Si ya existía, responder OK sin re-enviar Resend
  if (!isNewSubscriber) {
    return { ok: true, event_id: eventId, message: 'Suscripción recibida correctamente.' };
  }

  const nlSource = escapeHtml(body.utm_source || '');
  const nlMedium = escapeHtml(body.utm_medium || '');
  const nlCampaign = escapeHtml(body.utm_campaign || '');
  const nlPage = escapeHtml(body.page_location || '');
  const nlDateStr = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const emailResult = await sendEmail({
    to: env.CONTACT_TO_EMAIL,
    subject: 'Nueva suscripción al newsletter',
    html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#071628 0%,#0c2948 100%);padding:28px 36px;">
        <p style="margin:0;font-size:13px;color:#cd9f4f;letter-spacing:2px;text-transform:uppercase;">García Inversiones Inmobiliarias</p>
        <h1 style="margin:8px 0 0;font-size:20px;color:#ffffff;font-weight:600;">📩 Nueva suscripción al newsletter</h1>
      </td></tr>
      <tr><td style="padding:32px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
          <td style="background:#f0f4f8;border-left:4px solid #cd9f4f;padding:16px 20px;border-radius:0 8px 8px 0;">
            <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;">Nuevo suscriptor</p>
            <p style="margin:0;font-size:17px;font-weight:700;color:#071628;">${escapeHtml(email)}</p>
          </td></tr></table>
        <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Detalle de la suscripción</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
          <tr style="border-bottom:1px solid #f0f0f0;"><td style="width:140px;color:#666;font-size:14px;">Fecha</td><td style="font-size:14px;font-weight:600;color:#071628;">${nlDateStr}</td></tr>
          ${nlPage ? `<tr style="border-bottom:1px solid #f0f0f0;"><td style="color:#666;font-size:14px;">Página de origen</td><td style="font-size:14px;color:#071628;">${nlPage}</td></tr>` : ''}
        </table>
        ${(nlSource || nlMedium || nlCampaign) ? `
        <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Origen del lead</p>
        <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#555;margin-bottom:16px;">
          ${nlSource ? `<tr><td style="width:140px;">UTM Source</td><td>${nlSource}</td></tr>` : ''}
          ${nlMedium ? `<tr><td>UTM Medium</td><td>${nlMedium}</td></tr>` : ''}
          ${nlCampaign ? `<tr><td>UTM Campaign</td><td>${nlCampaign}</td></tr>` : ''}
        </table>` : ''}
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee;">
        <p style="margin:0;font-size:12px;color:#aaa;">Recibido el ${nlDateStr} · García Inversiones Inmobiliarias</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  });

  if (!emailResult.ok) {
    console.error('[newsletter] Error de email:', emailResult.error);
    captureError(new Error(`newsletter email failed: ${emailResult.error}`), { source: 'newsletter-email' });
    return {
      ok: false,
      message: 'No pudimos procesar la suscripción. Por favor intentá de nuevo más tarde.',
      ...(isProduction ? {} : { debug_error: emailResult.error }),
    } as ActionResult;
  }

  console.log('[newsletter] Email enviado correctamente.');
  return { ok: true, event_id: eventId, message: 'Suscripción recibida correctamente.' };
}
