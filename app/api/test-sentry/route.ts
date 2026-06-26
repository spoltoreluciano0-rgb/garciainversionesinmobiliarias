import * as Sentry from '@sentry/nextjs';

// ⚠️ RUTA TEMPORAL DE PRUEBA — BORRAR tras verificar Sentry. NO debe quedar en producción.
// Tira un error intencional para confirmar que el monitoreo llega a Sentry.
export const dynamic = 'force-dynamic'; // sin cacheo, siempre ejecuta

export async function GET() {
  const error = new Error('Prueba de Sentry - Luciano');
  Sentry.captureException(error); // captura explícita
  await Sentry.flush(2000); // garantiza el envío antes de que el serverless se congele
  throw error; // 500 real + captura automática vía onRequestError
}
