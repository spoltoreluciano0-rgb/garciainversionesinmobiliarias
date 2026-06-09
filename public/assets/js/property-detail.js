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

  function normalizeImages(property) {
    const rawImages = Array.isArray(property.raw?.imagenes_propiedad)
      ? property.raw.imagenes_propiedad.map(img => img?.source).filter(Boolean)
      : [];

    const localImages = [
      property.imagen,
      ...(Array.isArray(property.imagenes) ? property.imagenes : [])
    ].filter(Boolean);

    return [...new Set([...localImages, ...rawImages])].slice(0, 20);
  }

  function getDetailRows(property) {
    const raw = property.raw || {};

    return [
      ["Valor",              property.precio],
      ["Operación",          property.operacion],
      ["Tipo",               property.tipo],
      ["Ubicación",          property.ubicacion],
      ["Ambientes",          property.ambientes || raw.ambientes_propiedad],
      ["Dormitorios",        raw.dormitorios],
      ["Baños",              property.banos || raw.banos],
      ["Superficie total",   property.superficie || (raw.superficie_total ? `${raw.superficie_total} m²` : "")],
      ["Superficie cubierta",raw.superficie_cubierta ? `${raw.superficie_cubierta} m²` : ""],
      ["Antigüedad",         raw.antiguedad],
      ["Código",             property.crm_code || property.app_id || property.id]
    ].filter(([, value]) => value && value !== "Consultar" && value !== "null");
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

  async function fetchProperty() {
    if (!propertyId) {
      detailRoot.innerHTML = `
        <div class="container" style="padding: 60px 0;">
          <p class="properties-empty">No encontramos la propiedad solicitada. <a href="/propiedades">Ver todas las propiedades</a></p>
        </div>
      `;
      return;
    }

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
    const images       = normalizeImages(property);
    const details      = getDetailRows(property);
    const amenities    = getAmenities(property);
    const producer     = getProducer(property);
    const whatsappLink = getWhatsAppLink(property, producer.name);
    const mapEmbedUrl  = getMapEmbedUrl(property);
    const mapExternalUrl = getMapExternalUrl(property);

    const address =
      property.direccion         ||
      property.direccion_completa||
      property.ubicacion         ||
      "Ubicación a consultar";

    document.title = `${property.titulo || "Propiedad"} | García Inversiones`;

    detailRoot.innerHTML = `
      <section class="property-detail-hero">
        <div class="container property-detail-hero-inner">
          <div>
            <span class="eyebrow">
              ${escapeHtml(property.tag || property.operacion || "Propiedad")}
            </span>

            <h1 class="property-detail-title">
              ${escapeHtml(property.titulo || "Propiedad destacada")}
            </h1>

            <p class="property-detail-location">
              ${escapeHtml(property.ubicacion || "Ubicación a consultar")}
            </p>
          </div>
        </div>
      </section>

      <section class="property-detail-content">
        <div class="container property-detail-layout">

          <div class="property-detail-main">

            <div class="property-gallery"></div>

            <article class="property-info-card">
              <span class="eyebrow">Sobre la propiedad</span>
              <h2>Información sobre la propiedad</h2>
              <p>
                ${escapeHtml(property.descripcion || "Consultanos para recibir información completa sobre esta propiedad.")}
              </p>
            </article>

            ${
              details.length
                ? `
                  <article class="property-info-card">
                    <span class="eyebrow">Información clave</span>
                    <div class="property-key-grid">
                      ${details.map(([label, value]) => `
                        <div>
                          <small>${escapeHtml(label)}</small>
                          <strong>${escapeHtml(value)}</strong>
                        </div>
                      `).join("")}
                    </div>
                  </article>
                `
                : ""
            }

            ${
              amenities.length
                ? `
                  <article class="property-info-card">
                    <span class="eyebrow">Características</span>
                    <h2>Amenities</h2>
                    <div class="property-amenities">
                      ${amenities.map(item => `<span>${escapeHtml(item)}</span>`).join("")}
                    </div>
                  </article>
                `
                : ""
            }

            ${
              mapEmbedUrl
                ? `
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

                    ${
                      mapExternalUrl
                        ? `
                          <div class="property-map-actions">
                            <a class="btn btn-dark" href="${escapeHtml(mapExternalUrl)}" target="_blank" rel="noopener">
                              Ver en Google Maps
                            </a>
                          </div>
                        `
                        : ""
                    }
                  </article>
                `
                : ""
            }

            ${
              property.video || property.tour
                ? `
                  <article class="property-info-card">
                    <span class="eyebrow">Material adicional</span>
                    <h2>Recorridos y contenido</h2>
                    <div class="detail-links-row">
                      ${property.video ? `<a class="btn btn-dark" href="${escapeHtml(property.video)}" target="_blank" rel="noopener">Ver video</a>` : ""}
                      ${property.tour  ? `<a class="btn btn-dark" href="${escapeHtml(property.tour)}"  target="_blank" rel="noopener">Tour virtual</a>` : ""}
                    </div>
                  </article>
                `
                : ""
            }

          </div>

          <aside class="property-contact-box">
            <h3>Consultar por esta propiedad</h3>
            <p>Dejanos tus datos y te contactamos con información completa.</p>

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
              <!-- Cloudflare Turnstile -->
              <div class="cf-turnstile cf-turnstile--property" data-theme="auto" data-language="es"></div>

              <p class="form-legal">Al enviar este formulario aceptás que García Inversiones Inmobiliarias utilice tus datos para responder tu consulta comercial. <a href="/privacidad">Ver Política de Privacidad</a>.</p>

              <
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
                Consultar por WhatsApp
              </a>
            </form>
          </aside>

        </div>
      </section>
    `;

    setupGallery(images);
    setupPropertyForm(property, producer);
    // click_whatsapp lo captura tracking.js globalmente via data-* attributes del link

    // Timestamp anti-bot: marcar cuándo se renderizó el formulario
    // Se actualiza al primer focus real para mayor precisión
    document.querySelectorAll('.js-form-loaded-at').forEach(el => {
      el.value = Date.now();
      const form = el.closest('form');
      if (form) {
        form.addEventListener('focusin', function setOnFocus() {
          el.value = Date.now();
        }, { once: true });
      }
    });

    // Cloudflare Turnstile: render explícito del widget en el formulario de propiedad
    const turnstileContainer = document.querySelector('.cf-turnstile--property');
    if (turnstileContainer && window.turnstile) {
      const siteKey = document.querySelector('.cf-turnstile[data-sitekey]')?.dataset?.sitekey
        || turnstileContainer.dataset?.sitekey || '';
      if (siteKey && siteKey !== 'TURNSTILE_SITE_KEY') {
        window.turnstile.render(turnstileContainer, { sitekey: siteKey, theme: 'auto', language: 'es' });
      }
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

  function setupPropertyForm(property, producer) {
    const form = document.querySelector("[data-property-contact]");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const button      = form.querySelector("button[type='submit']");
      const originalText = button ? button.textContent : "";
      const payload     = Object.fromEntries(new FormData(form).entries());

      payload.destinatario    = producer.email;
      payload.productor       = producer.name;
      payload.lead_type       = "consulta_propiedad";
      payload.form_type       = "property";
      payload.property_title  = property.titulo || "";
      payload.property_url    = window.location.href;
      payload.source          = "web";
      payload.page_location   = window.location.href;

      if (button) { button.disabled = true; button.textContent = "Enviando..."; }

      pushDataLayer("form_submit", property, {
        form_name: "consulta_propiedad",
        lead_type: "consulta_propiedad"
      });

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.ok === false) {
          throw new Error(result.message || "No se pudo enviar.");
        }

        pushDataLayer("generate_lead", property, {
          form_name: "consulta_propiedad",
          lead_type: "consulta_propiedad"
        });

        form.reset();
        // Reset Turnstile para que no quede token inválido si el usuario vuelve
        if (window.turnstile) window.turnstile.reset();
        window.location.href = "/gracias-consulta";

      } catch (error) {
        alert(error.message || "No pudimos enviar la consulta. Probá nuevamente o escribinos por WhatsApp.");
      } finally {
        if (button) { button.disabled = false; button.textContent = originalText; }
      }
    });
  }

  fetchProperty();
})();
