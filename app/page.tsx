import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppFloat from '@/components/layout/WhatsAppFloat';
import RevealObserver from '@/components/RevealObserver';
import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import Services from '@/components/sections/Services';
import Markets from '@/components/sections/Markets';
import PropertiesComingSoon from '@/components/sections/PropertiesComingSoon';
import Why from '@/components/sections/Why';
import CtaBand from '@/components/sections/CtaBand';
import Contact from '@/components/sections/Contact';
import Newsletter from '@/components/sections/Newsletter';
import TurnstileScript from '@/components/forms/TurnstileScript';
import { PROPERTIES_ENABLED } from '@/lib/flags';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Markets />
        {/* Mientras PROPERTIES_ENABLED=false se muestra "Selección en preparación".
            Cuando el CRM 2Clics conecte (Fase 5) se renderiza la grilla destacada. */}
        <PropertiesComingSoon />
        {PROPERTIES_ENABLED && null /* Fase 5: <FeaturedProperties /> */}
        <Why />
        <CtaBand />
        <Contact />
      </main>
      <Newsletter />
      <Footer />
      <WhatsAppFloat />
      <RevealObserver />
      {/* Turnstile: solo en la home porque es la única ruta con formularios. */}
      <TurnstileScript />
    </>
  );
}
