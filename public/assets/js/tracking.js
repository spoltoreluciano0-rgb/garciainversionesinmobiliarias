(function () {
  const STORAGE_KEY = 'garcia_attribution_v1';
  const SESSION_KEY = 'garcia_session_v1';
  const ATTR_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid'];

  window.dataLayer = window.dataLayer || [];

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2);
  }

  function getStoredJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setStoredJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function getQueryParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search).entries());
  }

  function captureAttribution() {
    const params = getQueryParams();
    const previous = getStoredJson(STORAGE_KEY, {});
    const captured = {};

    ATTR_KEYS.forEach(key => {
      if (params[key]) captured[key] = params[key];
    });

    const firstVisitDate = previous.first_visit_date || nowIso();
    const landingPage = previous.landing_page || window.location.href;
    const referrer = previous.referrer || document.referrer || '';

    const attribution = {
      ...previous,
      ...captured,
      landing_page: landingPage,
      referrer,
      first_visit_date: firstVisitDate,
      last_visit_date: nowIso(),
      last_page: window.location.href
    };

    setStoredJson(STORAGE_KEY, attribution);

    const session = getStoredJson(SESSION_KEY, {});
    if (!session.session_id) {
      setStoredJson(SESSION_KEY, { session_id: uuid(), started_at: nowIso() });
    }

    return attribution;
  }

  function getAttribution() {
    return getStoredJson(STORAGE_KEY, captureAttribution());
  }

  function getSession() {
    return getStoredJson(SESSION_KEY, {});
  }

  function eventId(prefix) {
    return `${prefix || 'event'}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function pushEvent(eventName, params) {
    const attribution = getAttribution();
    const session = getSession();
    const payload = {
      event: eventName,
      event_id: params?.event_id || eventId(eventName),
      page_location: window.location.href,
      page_title: document.title,
      lead_source: attribution.utm_source || attribution.gclid ? 'paid' : (document.referrer ? 'referral' : 'direct'),
      ...attribution,
      ...session,
      ...(params || {})
    };

    window.dataLayer.push(payload);

    try {
      document.dispatchEvent(new CustomEvent('garcia:tracking-event', { detail: payload }));
    } catch (_) {}

    return payload;
  }

  function enrichPayload(data) {
    return {
      ...data,
      ...getAttribution(),
      ...getSession(),
      page_location: window.location.href,
      page_title: document.title
    };
  }

  function addHiddenFields(form) {
    if (!form || form.dataset.trackingPrepared === 'true') return;
    form.dataset.trackingPrepared = 'true';

    const attribution = getAttribution();
    const session = getSession();
    const hiddenData = {
      ...attribution,
      ...session,
      landing_page: attribution.landing_page || window.location.href,
      current_page: window.location.href,
      page_title: document.title
    };

    Object.entries(hiddenData).forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') return;
      const exists = Array.from(form.elements || []).some(element => element.name === name);
      if (exists) return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });
  }

  function getFormName(form) {
    if (form.dataset.newsletter !== undefined) return 'Newsletter';
    if (form.classList.contains('detail-contact-form')) return 'Consulta de propiedad';
    if (form.classList.contains('property-contact-form')) return 'Consulta de propiedad';
    if (form.classList.contains('contact-form')) return 'Formulario principal';
    return form.getAttribute('name') || form.id || 'Formulario web';
  }

  function getLeadType(form) {
    if (form.dataset.newsletter !== undefined) return 'newsletter';
    if (form.classList.contains('detail-contact-form')) return 'consulta_propiedad';
    if (form.classList.contains('property-contact-form')) return 'consulta_propiedad';
    return 'consulta_general';
  }

  // Tracking de inicio de llenado de formularios (una sola vez por formulario)
  function trackForms() {
    document.querySelectorAll('form').forEach(form => {
      if (form.dataset.trackingFormStart === 'true') return;
      form.dataset.trackingFormStart = 'true';

      addHiddenFields(form);

      const formName = getFormName(form);
      const leadType = getLeadType(form);
      let started = false;

      function onFormInteraction() {
        if (started) return;
        started = true;
        pushEvent('form_start', {
          form_name: formName,
          lead_type: leadType
        });
      }

      form.addEventListener('input', onFormInteraction, { passive: true });
      form.addEventListener('focusin', onFormInteraction, { passive: true });
    });
  }

  function trackWhatsAppClicks() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]');
      if (!link) return;

      const params = {
        whatsapp_number: link.dataset.whatsappNumber || '5491167240353',
        button_text: (link.textContent || 'WhatsApp').trim(),
        lead_type: link.dataset.leadType || 'whatsapp',
        property_id: link.dataset.propertyId || '',
        property_name: link.dataset.propertyName || '',
        property_country: link.dataset.propertyCountry || '',
        estimated_value: link.dataset.estimatedValue || '',
        currency: link.dataset.currency || '',
        event_id: eventId('click_whatsapp')
      };

      pushEvent('click_whatsapp', params);
      pushEvent('generate_lead', { ...params, lead_type: params.lead_type || 'whatsapp' });
    }, true);
  }

  function trackImportantClicks() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a, button');
      if (!link) return;
      const text = (link.textContent || '').trim();

      if (link.matches('[href="/propiedades"], [href*="/propiedades"]')) {
        pushEvent('select_service', {
          service_name: 'Propiedades',
          button_text: text || 'Propiedades'
        });
      }

      if (link.matches('.property-card-link, .property-card-actions a')) {
        const card = link.closest('.property-card');
        const propId   = card?.id?.replace('property-', '') || '';
        const propName = card?.querySelector('.property-title')?.textContent?.trim() || '';
        const propParams = {
          property_id:   propId,
          property_name: propName,
          content_type:  'real_estate_property',
          button_text:   text || 'Ver ficha completa'
        };
        // Evento semántico preferido (trigger GTM: select_property)
        pushEvent('select_property', propParams);
        // Alias ecommerce GA4
        pushEvent('select_product', { product_id: propId, product_name: propName, ...propParams });
      }

      if (/agendar|asesoramiento|consulta|contacto/i.test(text) && !link.href?.includes('wa.me')) {
        pushEvent('start_quote', {
          button_text: text,
          lead_type: 'consulta_inmobiliaria'
        });
      }
    }, true);
  }

  function trackPageView() {
    pushEvent('page_view_custom', {
      content_type: document.body?.dataset.pageType || 'page'
    });

    if (location.pathname.includes('propiedades')) {
      pushEvent('view_content', {
        content_name: 'Listado de propiedades',
        content_type: 'real_estate_listing'
      });
    }
  }

  function init() {
    captureAttribution();
    trackPageView();
    trackForms();
    trackWhatsAppClicks();
    trackImportantClicks();

    // Observar nuevos formularios que se agreguen dinámicamente (ej: property-detail.js)
    const observer = new MutationObserver(() => trackForms());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.GarciaTracking = {
    getAttribution,
    getSession,
    enrichPayload,
    pushEvent,
    eventId,
    addHiddenFields
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
