import type { Metadata } from 'next';
import Script from 'next/script';
import { Jost, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { CANONICAL_BASE_URL } from '@/lib/env';

const GTM_ID = 'GTM-MBNKBBSW';

// Fuentes self-hosted vía next/font (sin request a Google, con métricas de
// fallback automáticas que evitan layout shift / CLS).
const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_BASE_URL),
  title: 'García Inversiones Inmobiliarias | Real Estate Argentina y el Mundo',
  description:
    'Asesoramiento estratégico en real estate. Propiedades seleccionadas y acompañamiento personalizado para quienes invierten con criterio en Argentina, EE.UU., Uruguay, Dubái y España.',
  alternates: { canonical: '/' },
  icons: {
    icon: '/assets/logos/isotipo.png',
    apple: '/assets/logos/isotipo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'García Inversiones Inmobiliarias',
    locale: 'es_AR',
    title: 'García Inversiones Inmobiliarias | Real Estate Argentina y el Mundo',
    description:
      'Asesoramiento estratégico en real estate. Propiedades seleccionadas, mercados globales y acompañamiento personalizado.',
    url: '/',
    images: [{ url: '/assets/propiedades/condor-resort.jpeg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'García Inversiones Inmobiliarias | Real Estate Argentina y el Mundo',
    description:
      'Asesoramiento estratégico en real estate. Propiedades seleccionadas, mercados globales y acompañamiento personalizado.',
    images: ['/assets/propiedades/condor-resort.jpeg'],
  },
  formatDetection: { telephone: false },
};

// Schema.org — Organization / LocalBusiness / RealEstateAgent + WebSite
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['RealEstateAgent', 'LocalBusiness'],
      '@id': `${CANONICAL_BASE_URL}/#organization`,
      name: 'García Inversiones Inmobiliarias',
      url: CANONICAL_BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${CANONICAL_BASE_URL}/assets/logos/Garcia.svg`,
        width: 2048,
        height: 1152,
      },
      image: `${CANONICAL_BASE_URL}/assets/propiedades/condor-resort.jpeg`,
      description:
        'Asesoramiento estratégico en real estate. Propiedades seleccionadas y acompañamiento personalizado para quienes invierten con criterio.',
      telephone: '+54-9-11-6724-0353',
      email: 'contacto@garciainversiones.com.ar',
      address: { '@type': 'PostalAddress', addressLocality: 'Buenos Aires', addressCountry: 'AR' },
      sameAs: ['https://www.instagram.com/inv.inmob.garcia'],
      areaServed: [
        { '@type': 'Country', name: 'Argentina' },
        { '@type': 'Country', name: 'United States' },
        { '@type': 'Country', name: 'United Arab Emirates' },
        { '@type': 'Country', name: 'Uruguay' },
        { '@type': 'Country', name: 'Spain' },
      ],
      priceRange: '$$$$',
    },
    {
      '@type': 'WebSite',
      '@id': `${CANONICAL_BASE_URL}/#website`,
      url: CANONICAL_BASE_URL,
      name: 'García Inversiones Inmobiliarias',
      description:
        'Asesoramiento estratégico en real estate. Propiedades seleccionadas, mercados globales y acompañamiento personalizado.',
      publisher: { '@id': `${CANONICAL_BASE_URL}/#organization` },
      inLanguage: 'es-AR',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jost.variable} ${cormorant.variable}`}>
      <body data-page-type="home">
        {/* JSON-LD (hoisted a <head> por React 19). Las fuentes ahora son self-hosted (next/font). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />

        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>

        {children}

        {/* Turnstile NO se carga acá: el script vive en <TurnstileScript /> y se
            incluye solo en las rutas con formulario (hoy, la home). */}

        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      </body>
    </html>
  );
}
