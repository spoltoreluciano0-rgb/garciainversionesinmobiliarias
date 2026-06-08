(function () {
  // ── Menú mobile ────────────────────────────────────────────────────────────
  const menuToggle   = document.getElementById("menuToggle");
  const menuClose    = document.getElementById("menuClose");
  const mobileMenu   = document.getElementById("mobileMenu");
  const mobileBackdrop = document.getElementById("mobileBackdrop");
  const mobileLinks  = document.querySelectorAll(".mobile-links a");
  const mobileLogoLink = document.getElementById("mobileLogoLink");

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add("active");
    mobileMenu.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove("active");
    mobileMenu.setAttribute("aria-hidden", "true");
    document.body.classList.remove("menu-open");
  }

  menuToggle?.addEventListener("click", openMenu);
  menuClose?.addEventListener("click", closeMenu);
  mobileBackdrop?.addEventListener("click", closeMenu);
  mobileLinks.forEach(link => link.addEventListener("click", closeMenu));
  mobileLogoLink?.addEventListener("click", closeMenu);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && mobileMenu?.classList.contains("active")) {
      closeMenu();
    }
  });

  // ── Header home: oscurece al scrollear ─────────────────────────────────────
  const siteHeader = document.getElementById("siteHeader");

  if (siteHeader) {
    function onScroll() {
      siteHeader.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // estado inicial por si la página carga ya scrolleada
  }

  // ── Slideshow hero ──────────────────────────────────────────────────────────
  const slides = document.querySelectorAll(".hero-slide");
  let currentSlide = 0;

  function showSlide(index) {
    slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
  }

  if (slides.length > 1) {
    setInterval(() => {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    }, 15000);
  }

  // ── Animaciones reveal ──────────────────────────────────────────────────────
  const revealElements = document.querySelectorAll(".reveal");

  let revealObserver;
  if ("IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealElements.forEach(el => revealObserver.observe(el));
    window._revealObserver = revealObserver;
  } else {
    revealElements.forEach(el => el.classList.add("visible"));
  }

  // ── Propiedades destacadas en home ─────────────────────────────────────────
  const featuredGrid = document.getElementById("featuredPropertiesGrid");
  if (featuredGrid) {
    (async function loadFeatured() {
      try {
        const res = await fetch("/api/properties");
        if (!res.ok) throw new Error("Error al cargar propiedades");
        const all = await res.json();
        const featured = all.slice(0, 3);

        if (!featured.length) {
          featuredGrid.innerHTML = '<p class="properties-empty">Próximamente nuevas oportunidades.</p>';
          return;
        }

        featuredGrid.innerHTML = featured.map(p => {
          const meta = [p.ambientes, p.banos, p.superficie].filter(Boolean);
          return `
            <article class="property-card reveal">
              <a href="/propiedad?id=${encodeURIComponent(p.id)}" class="property-card-link">
                <div class="property-image">
                  <img src="${p.imagen}" alt="${p.titulo}" loading="lazy" decoding="async" />
                  <span class="property-tag">${p.tag || p.operacion || "Propiedad"}</span>
                </div>
                <div class="property-body">
                  <p class="property-location">${p.ubicacion || ""}</p>
                  <h3 class="property-title">${p.titulo}</h3>
                  <p class="property-price">${p.precio || "Consultar"}</p>
                  ${p.descripcion ? `<p class="property-text">${p.descripcion.slice(0, 110)}${p.descripcion.length > 110 ? "…" : ""}</p>` : ""}
                  ${meta.length ? `<div class="property-meta">${meta.map(m => `<span>${m}</span>`).join("")}</div>` : ""}
                </div>
              </a>
            </article>`;
        }).join("");

        // Animación reveal para las cards nuevas
        if (window._revealObserver) {
          featuredGrid.querySelectorAll(".reveal").forEach(el => window._revealObserver.observe(el));
        } else {
          featuredGrid.querySelectorAll(".reveal").forEach(el => el.classList.add("visible"));
        }
      } catch (_) {
        featuredGrid.innerHTML = '<p class="properties-empty">No se pudieron cargar las propiedades.</p>';
      }
    })();
  }

  // ── Formularios ─────────────────────────────────────────────────────────────
  // NOTA: el tracking de form_start está centralizado en tracking.js
  // para evitar eventos duplicados en el dataLayer.

  function getFormName(form) {
    if (form.dataset.newsletter !== undefined) return "Newsletter";
    if (form.classList.contains("detail-contact-form")) return "Consulta de propiedad";
    if (form.classList.contains("property-contact-form")) return "Consulta de propiedad";
    return "Formulario principal";
  }

  function getLeadType(form) {
    if (form.dataset.newsletter !== undefined) return "newsletter";
    if (form.classList.contains("detail-contact-form")) return "consulta_propiedad";
    if (form.classList.contains("property-contact-form")) return "consulta_propiedad";
    return "consulta_general";
  }

  function pushTrackingEvent(eventName, payload = {}) {
    window.GarciaTracking?.pushEvent?.(eventName, payload);
  }

  function createEventId(eventName) {
    return (
      window.GarciaTracking?.eventId?.(eventName) ||
      `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
  }

  function enrichPayload(payload) {
    if (window.GarciaTracking?.enrichPayload) {
      return window.GarciaTracking.enrichPayload(payload);
    }
    return {
      ...payload,
      page_location: window.location.href,
      page_title: document.title,
      referrer: document.referrer || ""
    };
  }

  function showNewsletterSuccess(form) {
    const successMessage =
      document.getElementById("newsletterSuccess") ||
      form.parentElement?.querySelector(".newsletter-success") ||
      form.querySelector(".newsletter-success");

    if (!successMessage) return;

    successMessage.classList.add("show");

    setTimeout(() => {
      successMessage.classList.remove("show");
    }, 7000);
  }

  async function postForm(form, endpoint) {
    window.GarciaTracking?.addHiddenFields?.(form);

    const button = form.querySelector('button[type="submit"]');
    const originalText = button ? button.textContent : "";
    const rawData = Object.fromEntries(new FormData(form).entries());

    const formName = getFormName(form);
    const leadType = getLeadType(form);
    const eventId = createEventId("form_submit");

    const data = enrichPayload(rawData);

    data.form_name  = formName;
    data.lead_type  = leadType;
    data.event_id   = eventId;
    data.page_location = data.page_location || window.location.href;

    pushTrackingEvent("form_submit", {
      event_id: eventId,
      form_name: formName,
      lead_type: leadType,
      property_id:   data.property_app_id || data.property_id || "",
      property_name: data.property_title || "",
      page_location: window.location.href
    });

    if (button) {
      button.disabled = true;
      button.textContent = "Enviando...";
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "No se pudo enviar.");
      }

      pushTrackingEvent("generate_lead", {
        event_id:      result.event_id || eventId,
        form_name:     formName,
        lead_type:     leadType,
        property_id:   data.property_app_id || data.property_id || "",
        property_name: data.property_title || "",
        crm_status:    result.crmStatus || "",
        crm_ok:        result.crmOk === true,
        page_location: window.location.href
      });

      // Evento específico de newsletter (solo tras éxito del backend)
      if (leadType === "newsletter") {
        pushTrackingEvent("newsletter_signup", {
          event_id:     result.event_id || eventId,
          form_name:    formName,
          page_location: window.location.href
        });
      }

      form.reset();

      if (leadType === "newsletter") {
        showNewsletterSuccess(form);
      } else {
        window.location.href = "/gracias-consulta";
      }
    } catch (error) {
      alert(error.message || "Hubo un error. Intentá nuevamente.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  document.querySelectorAll("[data-crm-contact]").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      postForm(form, "/api/contact");
    });
  });

  document.querySelectorAll("[data-newsletter]").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      postForm(form, "/api/newsletter");
    });
  });
})();
