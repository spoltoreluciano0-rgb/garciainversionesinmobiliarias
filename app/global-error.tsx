'use client';

// Página de error global (App Router). Reemplaza el layout raíz ante un error de
// render, por eso lleva estilos inline. Sentry quedó solo server-side (decisión de
// performance del cliente): los errores de servidor se capturan vía onRequestError.
export default function GlobalError(_props: { error: Error & { digest?: string } }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0c2948',
          color: '#f2ede4',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <h1 style={{ fontWeight: 400, fontSize: '28px', margin: '0 0 12px' }}>
          Algo salió mal.
        </h1>
        <p style={{ color: '#7793ab', margin: '0 0 28px', maxWidth: 420 }}>
          Tuvimos un problema inesperado. Probá recargar la página o volver al inicio.
        </p>
        <a
          href="/"
          style={{
            background: '#cda04f',
            color: '#0c2948',
            padding: '12px 28px',
            borderRadius: 24,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Volver al inicio
        </a>
      </body>
    </html>
  );
}
