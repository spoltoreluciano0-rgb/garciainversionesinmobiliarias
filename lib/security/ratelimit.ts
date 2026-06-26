import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { captureError } from '@/lib/observability';

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Backend dual decidido en runtime:
//  • Sin credenciales Upstash (o NODE_ENV=test) → limiter en memoria por-instancia
//    (portado de legacy/server.js:59-73; dev y tests corren 100% offline).
//  • Con credenciales → Upstash Redis (límite global real entre instancias serverless).
// Fail-open: si Upstash falla o tarda > FAILOPEN_TIMEOUT_MS, el pedido PASA. El form
// ya tiene Turnstile + honeypot + filtro de spam como capas previas.

const FAILOPEN_TIMEOUT_MS = 1000;

// ── Backend en memoria ────────────────────────────────────────────────────────
type RateRecord = { n: number; until: number };

const _rlMap = new Map<string, RateRecord>();

function checkRateMemory(ip: string, key: string, max: number, windowMs: number): boolean {
  const id = `${ip}:${key}`;
  const now = Date.now();
  const rec = _rlMap.get(id) || { n: 0, until: now + windowMs };
  if (now > rec.until) {
    rec.n = 0;
    rec.until = now + windowMs;
  }
  rec.n++;
  _rlMap.set(id, rec);
  return rec.n <= max;
}

// Limpieza de entradas expiradas — sólo en runtime Node de larga vida.
// (En edge/serverless cada invocación es efímera; el GC del Map ocurre solo.)
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _rlMap) {
      if (now > v.until) _rlMap.delete(k);
    }
  }, 600_000);
  // No mantener vivo el proceso sólo por este timer.
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    (timer as { unref: () => void }).unref();
  }
}

// ── Backend Upstash ───────────────────────────────────────────────────────────
// Upstash usa Redis sólo si hay credenciales y no estamos en tests.
const useUpstash =
  process.env.NODE_ENV !== 'test' &&
  !!env.UPSTASH_REDIS_REST_URL &&
  !!env.UPSTASH_REDIS_REST_TOKEN;

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

// El (max, window) se fija al construir el Ratelimit, así que cacheamos una
// instancia por combinación. El bucket por pedido sigue siendo `${ip}:${key}`.
const _limiters = new Map<string, Ratelimit>();
function limiterFor(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = _limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis(),
      limiter: Ratelimit.fixedWindow(max, `${windowMs} ms`),
      prefix: 'rl',
      timeout: FAILOPEN_TIMEOUT_MS, // al vencer, Upstash hace fail-open (success=true)
    });
    _limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// ── API pública ───────────────────────────────────────────────────────────────
export async function checkRate(
  ip: string,
  key: string,
  max = 10,
  windowMs = 60_000,
): Promise<boolean> {
  if (!useUpstash) return checkRateMemory(ip, key, max, windowMs);

  try {
    const { success } = await limiterFor(max, windowMs).limit(`${ip}:${key}`);
    return success;
  } catch (err) {
    // Fail-open: dejamos pasar el pedido, pero avisamos para enterarnos si
    // Upstash empieza a fallar seguido. Sin PII (solo la key del limiter).
    captureError(err, { source: 'ratelimit-failopen', key });
    return true;
  }
}

// Sólo para tests: resetea el estado interno en memoria entre casos.
export function _resetRateLimit(): void {
  _rlMap.clear();
}
