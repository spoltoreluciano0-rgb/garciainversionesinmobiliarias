'use client';

import { useCallback, useEffect, useRef } from 'react';

// Turnstile invisible — porta el motor de legacy/public/assets/js/site.js
// (render explícito, execution:'execute', appearance:'interaction-only').
// Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY el widget no se renderiza y getToken
// devuelve '' (el server hace fail-open si TURNSTILE_SECRET_KEY tampoco está).

// La site key de Turnstile es PÚBLICA (va en el HTML). Prioridad: env var
// NEXT_PUBLIC_TURNSTILE_SITE_KEY; fallback al valor histórico del sitio (site.js
// legacy) para no romper si la env var no está cargada con el prefijo NEXT_PUBLIC_.
const SITEKEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAADhZ9AUzLRzsy14F';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    _tsReady?: boolean;
  }
}

export function useTurnstile(containerId: string) {
  const widgetId = useRef<string | null>(null);
  const pendingResolve = useRef<((token: string) => void) | null>(null);

  useEffect(() => {
    if (!SITEKEY) return;

    const init = () => {
      const container = document.getElementById(containerId);
      if (!container || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(container, {
        sitekey: SITEKEY,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => {
          pendingResolve.current?.(token);
          pendingResolve.current = null;
        },
        'error-callback': () => {
          console.warn('[Turnstile] Error en verificación — fail-open');
          pendingResolve.current?.('');
          pendingResolve.current = null;
        },
        'expired-callback': () => {
          pendingResolve.current?.('');
          pendingResolve.current = null;
          if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        },
      });
    };

    if (window._tsReady || window.turnstile) init();
    else document.addEventListener('ts:ready', init, { once: true });

    return () => {
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* noop */
        }
        widgetId.current = null;
      }
    };
  }, [containerId]);

  const getToken = useCallback(
    () =>
      new Promise<string>((resolve) => {
        if (!SITEKEY || !window.turnstile || widgetId.current === null) {
          resolve('');
          return;
        }
        pendingResolve.current = resolve;
        window.turnstile.execute(widgetId.current);
      }),
    [],
  );

  const reset = useCallback(() => {
    if (window.turnstile && widgetId.current !== null) window.turnstile.reset(widgetId.current);
  }, []);

  return { getToken, reset };
}
