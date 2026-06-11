(function () {
  const detailRoot = document.getElementById("propertyDetail");

  if (!detailRoot) return;

  const propertyId =
    new URLSearchParams(window.location.search).get("id") || "";

  const WHATSAPP_DEFAULT = "5491167240353";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const FALLBACK_IMAGE = 'assets/propiedades/condor-resort.jpeg';

  // ── Helpers de video/tour ────────────────────────────────────────────────
  function extractYouTubeId(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      const h = u.hostname.replace('www.', '');
      if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || '';
      if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
        if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || '';
        return u.searchParams.get('v') || '';
      }
    } catch (_) { /* invalid */ }
    return '';
  }

  // Construye el bloque de video + tour con lazy embed (facade pattern)
  function buildVideoTourBlock(property) {
    const video = property.video || '';
    const tour  = property.tour  || '';
    if (!video && !tour) return '';

    const ytId = extractYouTubeId(video);
    const embedUrl = ytId
      ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1`
      : '';
    const thumbUrl = ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : '';

    const videoBlock = video
      ? (ytId
          // YouTube: facade con thumbnail — iframe se carga solo al hacer clic
          ? `<div class="video-facade" data-embed="${escapeHtml(embedUrl)}" role="button" tabindex="0"
               aria-label="Reproducir video de la propiedad"
               style="position:relative;cursor:pointer;background:#000;border-radius:8px;overflow:hidden;aspect-ratio:16/9;">
               <img src="${escapeHtml(thumbUrl)}" alt="Miniatura del video"
                 loading="lazy" decoding="async"
                 style="width:100%;height:100%;object-fit:cover;opacity:.85;" />
               <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                 <svg width="68" height="48" viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                   <path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C56 0 34 0 34 0S12 0 7.5 1.7a8.5 8.5 0 0 0-6 6C0 12.2 0 24 0 24s0 11.8 1.5 16.3a8.5 8.5 0 0 0 6 6C12 48 34 48 34 48s22 0 26.5-1.7a8.5 8.5 0 0 0 6-6C68 35.8 68 24 68 24s0-11.8-1.5-16.3z" fill="#f00"/>
                   <path d="M27 34l18-10-18-10v20z" fill="#fff"/>
                 </svg>
               </div>
             </div>`
          // Otro proveedor (Vimeo, etc.): link externo
          : `<a class="btn btn-dark" href="${escapeHtml(video)}" target="_blank" rel="noopener noreferrer">Ver video</a>`)
      : '';

    const tourBlock = tour
      ? `<a class="btn btn-dark" href="${escapeHtml(tour)}" target="_blank" rel="noopener noreferrer">Tour virtual</a>`
      : '';

    return `
      <article class="property-info-card">
        <span class="eyebrow">Material adicional</span>
        <h2>Recorridos y contenido</h2>
        ${videoBlock}
        ${tourBlock ? `<div class="detail-links-row" style="margin-top:${video ? '16px' : '0'}">${tourBlock}</div>` : ''}
      </article>`;
  }

  function normalizeImages(property) {
    // Prioridad: galería manual → imagen manual → imagen CRM principal → imágenes CRM → galería local → fallback institucional
    const manualGallery = Array.isArray(property.galeria_manual)
      ? property.galeria_manual.filter(Boolean)
      : [];
    const manualMain  = property.imagen_manual ? [property.imagen_manual] : [];
    const crmMain     = property.imagen        ? [property.imagen]        : [];
    const crmGallery  = Array.isArray(property.raw?.imagenes_propiedad)
      ? property.raw.imagenes_propiedad.map(img => img?.source).filter(Boolean)
      : [];
    const localGallery = Array.isArray(property.imagenes) ? property.imagenes.filter(Boolean) : [];

    const all = [...new Set([...manualGallery, ...manualMain, ...crmMain, ...crmGallery, ...localGallery])];
    return all.length ? all.slice(0, 20) : [FALLBACK_IMAGE];
  }

  // Datos principales: resumen clave visible en card superior
  function getKeySummary(property) {
    if (property.mostrar_como_inversion) {
      return [
        ["Ticket mínimo",      property.ticket_minimo],
        ["Horizonte estimado", property.horizonte_inversion],
        ["Retorno estimado",   property.retorno_estimado],
        ["Modelo",             property.modelo_inversion],
        ["Tipo de oportunidad",property.tag || property.categoria],
        ["Ubicación",          property.ubicacion],
      ].filter(([, v]) => v && v !== "null");
    }
    const raw = property.raw || {};
    return [
      ["Precio",      property.precio],
      ["Ambientes",   property.ambientes  || raw.ambientes_propiedad],
      ["Dormitorios", raw.dormitorios     || property.dormitorios],
      ["Baños",       property.banos      || raw.banos],
      ["Superficie",  property.superficie || (raw.superficie_total ? `${raw.superficie_total} m²` : "")],
      ["Código",      property.crm_code  || property.app_id || property.id],
    ].filter(([, v]) => v && v !== "Consultar" && v !== "null");
  }

  // Datos complementarios: card secundaria debajo de la descripción
  function getSecondaryDetails(property) {
    if (property.mostrar_como_inversion) {
      return [
        ["País",        property.pais],
        ["Ciudad / Zona", property.zona_web || property.raw?.ciudad || ""],
        ["Riesgo", property.riesgo_inversion
          ? (property.riesgo_inversion.length > 80
              ? property.riesgo_inversion.slice(0, 77) + "…"
              : property.riesgo_inversion)
          : ""],
        ["Moneda",      property.moneda],
        ["Código",      property.crm_code || property.app_id || property.id],
      ].filter(([, v]) => v && v !== "null");
    }
    const raw = property.raw || {};
    return [
      ["Operación",     property.operacion],
      ["Tipo",          property.tipo],
      ["País",          property.pais],
      ["Dirección",     property.direccion || property.direccion_completa],
      ["Sup. cubierta", raw.superficie_cubierta ? `${raw.superficie_cubierta} m²` : ""],
      ["Antigüedad",    raw.antiguedad || property.antiguedad],
      ["Gastos",        property.expenses],
    ].filter(([, v]) => v && v !== "null" && v !== "Consultar");
  }

  function getAmenities(property) {
    const amenities = Array.isArray(property.amenities) ? property.amenities : [];

    const rawAmenities = Array.isArray(property.raw?.amenities)
      ? property.raw.amenities.map(item => item?.name).filter(Boolean)
      : [];

    return [...new Set([...amenities, ...rawAmenities])].filter(Boolean);
  }

  function getProducer(property) {
    return {
      name:
        property.productorNombre  ||
        property.productor_nombre ||
        property.productor?.nombre||
        property.raw?.productorNombre ||
        property.raw?.productor_nombre||
        "García Inversiones Inmobiliarias",

      email:
        property.productorEmail  ||
        property.productor_email ||
        property.productor?.email||
        property.raw?.productorEmail ||
        property.raw?.productor_email||
        ""
    };
  }

  function getMapEmbedUrl(property) {
    const raw = property.raw || {};

    if (property.mapaEmbed)    return property.mapaEmbed;
    if (property.mapa_embed)   return property.mapa_embed;
    if (property.googleMapEmbed) return property.googleMapEmbed;

    if (property.mapa && property.mapa.includes("output=embed")) {
      return property.mapa;
    }

    const lat = raw.latitud || raw.latitude || raw.lat || property.latitud || property.lat;
    const lng = raw.longitud|| raw.longitude|| raw.lng || property.longitud|| property.lng;

    if (lat && lng) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&output=embed`;
    }

    const query =
      property.direccion        ||
      property.direccion_completa||
      property.ubicacion        ||
      "";

    if (query) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }

    return "";
  }

  function getMapExternalUrl(property) {
    const raw = property.raw || {};

    if (property.mapa && !property.mapa.includes("output=embed")) {
      return property.mapa;
    }

    const lat = raw.latitud || raw.latitude || raw.lat || property.latitud || property.lat;
    const lng = raw.longitud|| raw.longitude|| raw.lng || property.longitud|| property.lng;

    if (lat && lng) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    }

    const query =
      property.direccion         ||
      property.direccion_completa||
      property.ubicacion         ||
      "";

    if (query) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }

    return "";
  }

  function getWhatsAppLink(property, producerName) {
    const title = property.titulo || "esta propiedad";
    const code  = property.crm_code || property.app_id || property.id || "";

    const text =
      `Hola ${producerName}, quisiera recibir más información sobre ${title}${code ? ` - Código ${code}` : ""}.`;

    return property.linkWhatsapp ||
      `https://wa.me/${WHATSAPP_DEFAULT}?text=${encodeURIComponent(text)}`;
  }

  function pushDataLayer(event, property, extra = {}) {
    window.dataLayer = window.dataLayer || [];

    window.dataLayer.push({
      event,
      property_id:        property.id        || "",
      property_code:      property.crm_code  || property.app_id || "",
      property_name:      property.titulo    || "",
      property_location:  property.ubicacion || "",
      property_country:   property.pais      || "",
      property_operation: property.operacion || "",
      property_type:      property.tipo      || "",
      property_value:     property.precio_numero || "",
      currency:           property.moneda    || "USD",
      page_location:      window.location.href,
      ...extra
    });
  }

  // ── Skeleton loader ──────────────────────────────────────────────────────────
  function showSkeleton() {
    detailRoot.innerHTML = `
      <section class="property-detail-hero property-skeleton-hero">
        <div class="container property-detail-hero-inner">
          <div class="property-skeleton-hero-content">
            <div class="skel skel-eyebrow"></div>
            <div class="skel skel-title"></div>
            <div class="skel skel-subtitle"></div>
          </div>
        </div>
      </section>
      <section class="property-detail-content">
        <div class="container property-detail-layout">
          <div class="property-detail-main">
            <div class="skel skel-gallery"></div>
            <div class="property-info-card">
              <div class="skel skel-text"></div>
              <div class="skel skel-text skel-text--short"></div>
              <div class="skel skel-text"></div>
            </div>
          </div>
          <aside class="property-contact-box property-skeleton-aside">
            <div class="skel skel-aside-title"></div>
            <div class="skel skel-aside-body"></div>
            <div class="skel skel-aside-btn"></div>
          </aside>
        </div>
      </section>
    `;
  }

  async function fetchProperty() {
    if (!propertyId) {
      detailRoot.innerHTML = `
        <div class="container" style="padding: 60px 0;">
          <p class="properties-empty">No encontramos la propiedad solicitada. <a href="/propiedades">Ver todas las propiedades</a></p>
        </div>
      `;
      return;
    }

    showSkeleton();

    const sources = [
      `/api/properties/${encodeURIComponent(propertyId)}`,
      "data/properties.json",
      "../data/properties.json"
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) throw new Error("No disponible");

        const data = await response.json();

        const property = Array.isArray(data)
          ? data.find(item =>
              String(item.id)     === String(propertyId) ||
              String(item.app_id) === String(propertyId)
            )
          : data;

        if (property) {
          renderProperty(property);
          // Evento estándar para GA4/GTM
          pushDataLayer("view_product", property);
          // Evento semántico para triggers de GTM
          pushDataLayer("property_view", property, {
            content_type: "real_estate_property",
            content_name: property.titulo || ""
          });
          return;
        }
      } catch (_) {
        /* continúa al siguiente fallback */
      }
    }

    detailRoot.innerHTML = `
      <div class="container" style="padding: 60px 0;">
        <p class="properties-empty">No pudimos cargar esta ficha. <a href="/propiedades">Ver todas las propiedades</a></p>
      </div>
    `;
  }

  function renderProperty(property) {
    const images           = normalizeImages(property);
    const keySummary       = getKeySummary(property);
    const secondaryDetails = getSecondaryDetails(property);
    const amenities        = getAmenities(property);
    const producer         = getProducer(property);
    const whatsappLink     = getWhatsAppLink(property, producer.name);
    const isInversion      = !!property.mostrar_como_inversion;
    const mapEmbedUrl      = getMapEmbedUrl(property);
    const mapExternalUrl   = getMapExternalUrl(property);

    const address =
      property.direccion         ||
      property.direccion_completa||
      property.ubicacion         ||
      "Ubicación a consultar";

    const heroTag   = property.tag || (isInversion ? "Inversión" : property.operacion) || "Propiedad";
    // En inversiones el ticket va en las cards, no en el hero
    const heroPrice = !isInversion && property.precio && property.precio !== "Consultar"
      ? property.precio
      : "";

    const disclaimerText = property.disclaimer_inversion ||
      "La información publicada no constituye asesoramiento financiero, legal ni fiscal. Las proyecciones son estimadas y no representan una garantía de rentabilidad. Toda inversión implica riesgos y está sujeta a condiciones comerciales, legales, financieras y de mercado.";

    document.title = `${property.titulo || "Propiedad"} | García Inversiones`;

    detailRoot.innerHTML = `
      <section class="property-detail-hero${isInversion ? " property-detail-hero--compact" : ""}">
        <div class="container property-detail-hero-inner">
          <div class="property-detail-hero-text">
            <span class="eyebrow">${escapeHtml(heroTag)}</span>

            <h1 class="property-detail-title">
              ${escapeHtml(property.titulo || "Propiedad destacada")}
            </h1>

            ${!isInversion && property.bajada
              ? `<p class="property-detail-bajada">${escapeHtml(property.bajada)}</p>`
              : ""}

            ${!isInversion
              ? `<p class="property-detail-location">${escapeHtml(property.ubicacion || "Ubicación a consultar")}</p>`
              : ""}

            ${heroPrice
              ? `<p class="property-detail-price">${escapeHtml(heroPrice)}</p>`
              : ""}
          </div>

          <div class="property-share-wrapper">
            <button class="property-share-btn" id="propertyShareBtn" type="button" aria-label="Compartir propiedad" aria-expanded="false" aria-haspopup="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Compartir
            </button>
            <div class="property-share-menu" id="propertyShareMenu" role="menu" hidden>
              <a class="share-menu-item" id="shareWhatsapp" href="#" target="_blank" rel="noopener noreferrer" role="menuitem">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a class="share-menu-item" id="shareFacebook" href="#" target="_blank" rel="noopener noreferrer" role="menuitem">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
              <a class="share-menu-item" id="shareLinkedin" href="#" target="_blank" rel="noopener noreferrer" role="menuitem">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
              <button class="share-menu-item share-copy-btn" id="shareCopy" type="button" role="menuitem">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Copiar link
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="property-detail-content">
        <div class="container property-detail-layout">

          <div class="property-detail-main">

            <!-- Galería -->
            <div class="property-gallery"></div>

            <!-- 1. Resumen clave -->
            ${keySummary.length ? `
              <article class="property-info-card">
                <span class="eyebrow">${isInversion ? "Datos de la oportunidad" : "Resumen"}</span>
                <div class="property-key-grid">
                  ${keySummary.map(([label, value]) => `
                    <div>
                      <small>${escapeHtml(label)}</small>
                      <strong>${escapeHtml(String(value))}</strong>
                    </div>
                  `).join("")}
                </div>
              </article>
            ` : ""}

            <!-- 2. Descripción editorial -->
            ${property.descripcion || (isInversion && property.bajada) ? `
              <article class="property-info-card">
                <span class="eyebrow">${isInversion ? "Sobre la oportunidad" : "Sobre la propiedad"}</span>
                <h2>${isInversion ? "Descripción de la inversión" : "Información sobre la propiedad"}</h2>
                ${isInversion && property.bajada
                  ? `<p class="property-description-lead">${escapeHtml(property.bajada)}</p>`
                  : ""}
                ${property.descripcion
                  ? `<p>${escapeHtml(property.descripcion)}</p>`
                  : ""}
              </article>
            ` : ""}

            <!-- 3. Detalle complementario -->
            ${secondaryDetails.length ? `
              <article class="property-info-card">
                <span class="eyebrow">Detalle</span>
                <div class="property-key-grid">
                  ${secondaryDetails.map(([label, value]) => `
                    <div>
                      <small>${escapeHtml(label)}</small>
                      <strong>${escapeHtml(String(value))}</strong>
                    </div>
                  `).join("")}
                </div>
              </article>
            ` : ""}

            <!-- 4. Amenities -->
            ${amenities.length ? `
              <article class="property-info-card">
                <span class="eyebrow">Características</span>
                <h2>Amenities</h2>
                <div class="property-amenities">
                  ${amenities.map(item => `<span>${escapeHtml(item)}</span>`).join("")}
                </div>
              </article>
            ` : ""}

            <!-- 5. Mapa (solo fichas tradicionales) -->
            ${mapEmbedUrl ? `
              <article class="property-info-card">
                <span class="eyebrow">Ubicación</span>
                <h2>Ubicación de la propiedad</h2>
                <p>${escapeHtml(address)}</p>
                <div class="property-map">
                  <iframe
                    src="${escapeHtml(mapEmbedUrl)}"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    allowfullscreen>
                  </iframe>
                </div>
                ${mapExternalUrl ? `
                  <div class="property-map-actions">
                    <a class="btn btn-dark" href="${escapeHtml(mapExternalUrl)}" target="_blank" rel="noopener">
                      Ver en Google Maps
                    </a>
                  </div>
                ` : ""}
              </article>
            ` : ""}

            <!-- 6. Video y tour -->
            ${buildVideoTourBlock(property)}

            <!-- 7. Disclaimer (solo inversiones) -->
            ${isInversion ? `
              <div class="inversion-disclaimer">
                <p class="inversion-disclaimer-title">Información importante</p>
                <p>${escapeHtml(disclaimerText)}</p>
              </div>
            ` : ""}

          </div>

          <aside class="property-contact-box">
            <h3>${isInversion ? "Quiero más información" : "Consultar por esta propiedad"}</h3>
            <p>${isInversion
              ? "Completá tus datos y nuestro equipo te contacta con información completa sobre esta oportunidad."
              : "Dejanos tus datos y te contactamos con información completa."
            }</p>

            <form class="property-contact-form" data-property-contact>
              <!-- honeypot anti-bot -->
              <div class="hp-field" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" /></div>
              <input type="hidden" name="property_id"    value="${escapeHtml(property.id     || "")}" />
              <input type="hidden" name="property_app_id"value="${escapeHtml(property.app_id || property.id || "")}" />
              <input type="hidden" name="property_title" value="${escapeHtml(property.titulo  || "")}" />
              <input type="hidden" name="property_url"   value="${escapeHtml(window.location.href)}" />
              <input type="hidden" name="destinatario"   value="${escapeHtml(producer.email)}" />
              <input type="hidden" name="productor"      value="${escapeHtml(producer.name)}" />

              <input type="text"  name="name"    placeholder="Nombre y apellido" required maxlength="120" />
              <input type="tel"   name="phone"   placeholder="WhatsApp"          required maxlength="30" />
              <input type="email" name="email"   placeholder="Email"             required maxlength="254" />

              <textarea name="message" rows="5" maxlength="2000">Hola, quisiera recibir más información sobre ${escapeHtml(property.titulo || "esta propiedad")}.</textarea>

              <button class="btn btn-primary" type="submit">
                Enviar consulta
              </button>

              <!-- Timestamp anti-bot -->
              <input type="hidden" name="_form_loaded_at" class="js-form-loaded-at" value="" />
              <!-- Turnstile invisible: contenedor oculto, sin widget visible -->
              <div id="ts-property" aria-hidden="true" style="display:none"></div>

              <p class="form-legal">Al enviar este formulario aceptás que García Inversiones Inmobiliarias utilice tus datos para responder tu consulta comercial. <a href="/privacidad">Ver Política de Privacidad</a>.</p>

              <a
                class="btn btn-outline property-whatsapp-btn"
                href="${escapeHtml(whatsappLink)}"
                target="_blank"
                rel="noopener"
                data-whatsapp-number="${escapeHtml(WHATSAPP_DEFAULT)}"
                data-property-id="${escapeHtml(String(property.id || ''))}"
                data-property-name="${escapeHtml(property.titulo || '')}"
                data-property-country="${escapeHtml(property.pais || '')}"
                data-estimated-value="${escapeHtml(String(property.precio_numero || ''))}"
                data-currency="${escapeHtml(property.moneda || 'USD')}"
                data-lead-type="whatsapp_propiedad">
                ${isInversion ? "Consultar por WhatsApp" : "Consultar por WhatsApp"}
              </a>
            </form>
          </aside>

        </div>
      </section>
    `;

    setupGallery(images);
    setupPropertyForm(property, producer);
    setupShareButton(property);
    // click_whatsapp lo captura tracking.js globalmente via data-* attributes del link

    // Timestamp anti-bot: marcar cuándo se renderizó el formulario
    document.querySelectorAll('.js-form-loaded-at').forEach(el => {
      el.value = Date.now();
      const form = el.closest('form');
      if (form) {
        form.addEventListener('focusin', function setOnFocus() {
          el.value = Date.now();
        }, { once: true });
      }
    });

    // Turnstile invisible: registrar widget en el contenedor oculto del form
    const propertyForm = detailRoot.querySelector('[data-property-contact]');
    if (propertyForm) {
      window.GarciaTurnstile?.init(propertyForm, 'ts-property');
    }
  }

  function setupGallery(images) {
    let currentIndex = 0;

    const gallery = document.querySelector(".property-gallery");

    if (!gallery || !images.length) return;

    gallery.innerHTML = `
      <div class="gallery-slider">
        <button class="gallery-arrow gallery-prev" id="galleryPrev" type="button" aria-label="Imagen anterior">
          &#8249;
        </button>

        <img
          id="galleryMainImage"
          class="gallery-main-image"
          src="${escapeHtml(images[0])}"
          alt="Imagen propiedad"
          draggable="false"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
        />

        <button class="gallery-arrow gallery-next" id="galleryNext" type="button" aria-label="Imagen siguiente">
          &#8250;
        </button>

        <div class="gallery-counter">
          <span id="galleryCurrent">1</span> / <span>${images.length}</span>
        </div>
      </div>
    `;

    const mainImage      = document.getElementById("galleryMainImage");
    const prevBtn        = document.getElementById("galleryPrev");
    const nextBtn        = document.getElementById("galleryNext");
    const currentCounter = document.getElementById("galleryCurrent");

    function updateImage() {
      mainImage.style.opacity = "0";
      setTimeout(() => {
        mainImage.onerror = function () { this.onerror = null; this.src = FALLBACK_IMAGE; };
        mainImage.src = images[currentIndex];
        if (currentCounter) currentCounter.textContent = currentIndex + 1;
        mainImage.style.opacity = "1";
      }, 150);
    }

    function nextImage() {
      currentIndex = (currentIndex + 1) % images.length;
      updateImage();
    }

    function prevImage() {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateImage();
    }

    nextBtn?.addEventListener("click", nextImage);
    prevBtn?.addEventListener("click", prevImage);

    // Navegación con teclado (solo si hay galería activa)
    document.addEventListener("keydown", (event) => {
      if (!document.getElementById("galleryMainImage")) return;
      if (event.key === "ArrowRight") nextImage();
      if (event.key === "ArrowLeft")  prevImage();
    });

    // Doble clic para fullscreen
    mainImage.addEventListener("dblclick", async () => {
      try {
        if (!document.fullscreenElement) {
          await mainImage.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (_) {}
    });

    // Swipe en mobile
    let startX = 0;
    mainImage.addEventListener("touchstart", (event) => { startX = event.touches[0].clientX; }, { passive: true });
    mainImage.addEventListener("touchend",   (event) => {
      const diff = startX - event.changedTouches[0].clientX;
      if (diff >  50) nextImage();
      if (diff < -50) prevImage();
    });
  }

  function setupShareButton(property) {
    const btn  = document.getElementById('propertyShareBtn');
    const menu = document.getElementById('propertyShareMenu');
    if (!btn || !menu) return;

    const shareUrl   = window.location.href;
    const shareTitle = property.titulo || 'Propiedad';
    const shareText  = 'Conocé esta propiedad de García Inversiones Inmobiliarias.';

    function trackShare(method) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event:          'share_property',
        property_id:    property.id    || '',
        property_title: shareTitle,
        share_method:   method,
        page_url:       shareUrl
      });
    }

    // Web Share API solo en mobile real (Chrome desktop también la soporta pero da mala UX)
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 768);
    if (navigator.share && isMobileDevice) {
      btn.addEventListener('click', async () => {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
          trackShare('native');
        } catch (e) {
          // usuario canceló o error — no hacer nada
        }
      });
      return; // en mobile no necesitamos el menú desktop
    }

    // Desktop: toggle menú
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !menu.hidden;
      menu.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', () => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });

    menu.addEventListener('click', (e) => e.stopPropagation());

    // Links de red social
    const encodedUrl  = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`${shareTitle} — ${shareUrl}`);

    const waEl = document.getElementById('shareWhatsapp');
    const fbEl = document.getElementById('shareFacebook');
    const liEl = document.getElementById('shareLinkedin');
    const cpEl = document.getElementById('shareCopy');

    if (waEl) {
      waEl.href = `https://wa.me/?text=${encodedText}`;
      waEl.addEventListener('click', () => trackShare('whatsapp'));
    }
    if (fbEl) {
      fbEl.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      fbEl.addEventListener('click', () => trackShare('facebook'));
    }
    if (liEl) {
      liEl.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
      liEl.addEventListener('click', () => trackShare('linkedin'));
    }
    if (cpEl) {
      cpEl.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          cpEl.textContent = '¡Copiado!';
          setTimeout(() => { cpEl.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar link`; }, 2000);
        } catch (_) {
          // fallback
          const ta = document.createElement('textarea');
          ta.value = shareUrl;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          cpEl.textContent = '¡Copiado!';
          setTimeout(() => { cpEl.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar link`; }, 2000);
        }
        trackShare('copy');
        menu.hidden = true;
      });
    }
  }

  function setupPropertyForm(property, producer) {
    const form = document.querySelector("[data-property-contact]");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const button       = form.querySelector("button[type='submit']");
      const originalText = button ? button.textContent : "";

      // Bloquear mientras obtenemos token Turnstile
      if (button) { button.disabled = true; button.textContent = "Verificando..."; }

      // Obtener token Turnstile invisible
      let tsToken = '';
      try {
        tsToken = await (window.GarciaTurnstile?.getToken(form) || Promise.resolve(''));
      } catch (e) {
        console.warn('[Turnstile] Error al obtener token:', e.message);
      }

      // Armar payload con token ya disponible
      const payload = Object.fromEntries(new FormData(form).entries());
      payload['cf-turnstile-response'] = tsToken || payload['cf-turnstile-response'] || '';

      payload.destinatario   = producer.email;
      payload.productor      = producer.name;
      payload.lead_type      = "consulta_propiedad";
      payload.form_type      = "property";
      payload.property_title = property.titulo || "";
      payload.property_url   = window.location.href;
      payload.source         = "web";
      payload.page_location  = window.location.href;

      if (button) button.textContent = "Enviando...";

      pushDataLayer("form_submit", property, {
        form_name: "consulta_propiedad",
        lead_type: "consulta_propiedad"
      });

      try {
        const response = await fetch("/api/contact", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.ok === false) {
          throw new Error(result.message || "No se pudo enviar.");
        }

        // Solo dispara generate_lead tras confirmación del backend
        pushDataLayer("generate_lead", property, {
          form_name: "consulta_propiedad",
          lead_type: "consulta_propiedad"
        });

        form.reset();
        window.GarciaTurnstile?.reset(form); // regenerar token para próximo uso
        window.location.href = "/gracias-consulta";

      } catch (error) {
        alert(error.message || "No pudimos enviar la consulta. Probá nuevamente o escribinos por WhatsApp.");
        window.GarciaTurnstile?.reset(form);
      } finally {
        if (button) { button.disabled = false; button.textContent = originalText; }
      }
    });
  }

  // ── Video facade: reemplaza thumbnail con iframe al hacer clic ──────────
  document.addEventListener('click', (e) => {
    const facade = e.target.closest('.video-facade');
    if (!facade) return;
    const embedUrl = facade.dataset.embed;
    if (!embedUrl) return;
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
    facade.innerHTML = '';
    facade.style.cursor = 'default';
    facade.appendChild(iframe);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('video-facade')) {
      e.preventDefault();
      e.target.click();
    }
  });

  fetchProperty();
})();
