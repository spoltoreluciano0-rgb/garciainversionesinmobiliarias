// Footer premium — México eliminado, orden de mercados Argentina/EEUU/Uruguay/Dubái/España.
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer-premium">
      <div className="container">
        <div className="footer-premium-grid">
          <div className="footer-brand-col">
            <Link href="/" className="footer-logo-link">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/logos/Garcia.svg"
                alt="García Inversiones Inmobiliarias"
                width={800}
                height={200}
                decoding="async"
              />
            </Link>
            <p className="footer-tagline">
              Consultora boutique de real estate. Propiedades seleccionadas y asesoramiento
              personalizado en Argentina y mercados internacionales.
            </p>
            <div className="footer-contacts">
              <a
                href="https://wa.me/5491167240353"
                target="_blank"
                rel="noopener"
                className="footer-contact-item"
              >
                <span className="footer-contact-label">WhatsApp</span>
                <span>+54 9 11 6724-0353</span>
              </a>
              <a href="mailto:contacto@garciainversiones.com.ar" className="footer-contact-item">
                <span className="footer-contact-label">Email</span>
                <span>contacto@garciainversiones.com.ar</span>
              </a>
              <a
                href="https://instagram.com/inv.inmob.garcia"
                target="_blank"
                rel="noopener"
                className="footer-contact-item"
              >
                <span className="footer-contact-label">Instagram</span>
                <span>@inv.inmob.garcia</span>
              </a>
              <div className="footer-contact-item">
                <span className="footer-contact-label">Ubicación</span>
                <span>Buenos Aires, Argentina</span>
              </div>
            </div>
          </div>

          <div className="footer-col">
            <h3 className="footer-column-title">Navegación</h3>
            <ul className="footer-links">
              <li>
                <Link href="/#inicio">Inicio</Link>
              </li>
              <li>
                <Link href="/#nosotros">Nosotros</Link>
              </li>
              <li>
                <Link href="/propiedades">Propiedades</Link>
              </li>
              <li>
                <Link href="/#servicios">Servicios</Link>
              </li>
              <li>
                <Link href="/#mercados">Mercados</Link>
              </li>
              <li>
                <Link href="/#contacto">Contacto</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3 className="footer-column-title">Mercados</h3>
            <ul className="footer-links">
              <li>Argentina</li>
              <li>Estados Unidos</li>
              <li>Uruguay</li>
              <li>Dubái</li>
              <li>España</li>
            </ul>
          </div>

          <div className="footer-col">
            <h3 className="footer-column-title">Servicios</h3>
            <ul className="footer-links">
              <li>Asesoramiento en inversiones</li>
              <li>Compra y venta</li>
              <li>Alquiler de propiedades</li>
              <li>Mercados internacionales</li>
              <li>Proyectos y desarrollos</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <span>© 2026 García Inversiones Inmobiliarias. Todos los derechos reservados.</span>
          <Link href="/privacidad" className="footer-privacy-link">
            Política de Privacidad
          </Link>
          <Link href="/#inicio">↑ Volver al inicio</Link>
        </div>
      </div>
    </footer>
  );
}
