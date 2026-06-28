'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Header transparente (home) que se oscurece al scrollear + menú mobile.
// Porta el comportamiento de legacy/public/assets/js/site.js (menú + is-scrolled).

const NAV_LINKS = [
  { href: '/#nosotros', label: 'Nosotros' },
  { href: '/propiedades', label: 'Propiedades' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#mercados', label: 'Mercados' },
  { href: '/#contacto', label: 'Contacto' },
];

const MOBILE_LINKS = [{ href: '/#inicio', label: 'Inicio' }, ...NAV_LINKS];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`} id="siteHeader">
        <button
          className="menu-toggle"
          id="menuToggle"
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(true)}
        >
          <span className="menu-icon">☰</span>
        </button>
        <Link href="/" className="hdr-brand" aria-label="García Inversiones Inmobiliarias">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logos/Garcia-simple.svg"
            alt="García Inversiones Inmobiliarias"
            width={800}
            height={200}
            decoding="async"
          />
        </Link>
        <nav className="hdr-nav" aria-label="Navegación principal">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/propiedades" className="hdr-cta-btn">
          Propiedades
        </Link>
      </header>

      <aside
        className={`mobile-menu${menuOpen ? ' active' : ''}`}
        id="mobileMenu"
        aria-hidden={!menuOpen}
      >
        <div className="mobile-menu-backdrop" id="mobileBackdrop" onClick={close} />
        <div className="mobile-menu-inner">
          <div className="mobile-top">
            <Link href="/" className="mobile-logo" aria-label="Ir al inicio" onClick={close}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/logos/Garcia-simple.svg"
                alt="Logo García Inversiones Inmobiliarias"
                width={800}
                height={200}
                decoding="async"
              />
            </Link>
            <button className="menu-close" aria-label="Cerrar menú" onClick={close}>
              ×
            </button>
          </div>
          <nav className="mobile-links" aria-label="Navegación móvil">
            {MOBILE_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={close}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
