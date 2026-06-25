import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppFloat from '@/components/layout/WhatsAppFloat';
import PropertiesComingSoon from '@/components/sections/PropertiesComingSoon';

export const metadata: Metadata = {
  title: 'Propiedades | García Inversiones Inmobiliarias',
  description:
    'Propiedades seleccionadas en Argentina y mercados internacionales: Estados Unidos, Uruguay, Dubái y España.',
  alternates: { canonical: '/propiedades' },
};

export default function PropiedadesPage() {
  return (
    <>
      <Header />
      <main>
        {/* En Fase 5 se cablea acá el listado real (PropertyFilters + PropertyGrid)
            consumiendo searchProperties(). Por ahora se muestra el placeholder. */}
        <PropertiesComingSoon />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
