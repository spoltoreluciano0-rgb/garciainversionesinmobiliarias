(function () {
  const propertiesGrid       = document.getElementById("propertiesGrid");
  const countryButtons       = document.querySelectorAll(".country-filter");
  const operationButtons     = document.querySelectorAll(".operation-filter");
  const searchInput          = document.getElementById("locationSearch");
  const currencySelect       = document.getElementById("currencyFilter");
  const minPriceInput        = document.getElementById("minPrice");
  const maxPriceInput        = document.getElementById("maxPrice");
  const clearAdvancedButton  = document.getElementById("clearAdvancedFilters");
  const resultsCount         = document.getElementById("resultsCount");

  let properties      = [];
  let activeCountry   = "todas";
  let activeOperation = "todas";

  const COUNTRY_ALIASES = {
    argentina:                    "argentina",
    arg:                          "argentina",
    usa:                          "usa",
    eeuu:                         "usa",
    "ee-uu":                      "usa",
    "estados unidos":             "usa",
    "united states":              "usa",
    miami:                        "usa",
    orlando:                      "usa",
    dubai:                        "dubai",
    "dubái":                      "dubai",
    "dubai city":                 "dubai",
    "emiratos arabes unidos":     "dubai",
    "emiratos arabes":            "dubai",
    "emiratos":                   "dubai",
    eau:                          "dubai",
    uae:                          "dubai",
    "united arab emirates":       "dubai",
    uruguay:                      "uruguay",
    "punta del este":             "uruguay",
    montevideo:                   "uruguay",
    espana:                       "espana",
    "españa":                     "espana",
    spain:                        "espana",
    madrid:                       "espana",
    barcelona:                    "espana",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  // FIX: se eliminó el rechazo de precios con menos de 6 dígitos.
  // Ahora acepta cualquier número positivo (incluso $1.000 ARS).
  function parsePriceInput(value) {
    const clean = String(value || "")
      .trim()
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/[^\d]/g, "");

    if (!clean) return null;

    const number = Number(clean);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function hasDisplayValue(value) {
    const clean = String(value ?? "").trim();
    if (!clean) return false;
    return normalizeText(clean) !== "consultar";
  }

  function normalizeCountry(value) {
    const normalized = normalizeText(value);
    return COUNTRY_ALIASES[normalized] || normalized.replace(/\s+/g, "-");
  }

  function normalizeOperation(value) {
    const normalized = normalizeText(value);

    if (
      normalized.includes("pre") &&
      (normalized.includes("construccion") || normalized.includes("construction"))
    ) return "pre-construccion";

    if (normalized.includes("oficina"))  return "oficinas";
    if (normalized.includes("lote") || normalized.includes("terreno")) return "lotes";

    // Categorías de inversión y proyectos
    if (
      normalized === "inversion_internacional" ||
      normalized.includes("inversion internacional") ||
      normalized.includes("internacional")
    ) return "inversion";
    if (
      normalized === "proyecto_inversion" ||
      normalized.includes("participat") ||
      normalized.includes("proyecto de inversion")
    ) return "inversion";
    if (normalized === "emprendimiento" || normalized.includes("emprendimiento")) return "emprendimiento";

    if (
      normalized.includes("proyecto") ||
      normalized.includes("desarrollo")
    ) return "proyecto";

    if (normalized.includes("alquiler")) return "alquiler";
    if (normalized.includes("venta"))    return "venta";

    return normalized;
  }

  function getPropertyCountry(property) {
    const explicit =
      property.pais    ||
      property.país    ||
      property.country ||
      property.mercado ||
      property.raw?.pais ||
      property.raw?.country;

    if (explicit) return normalizeCountry(explicit);

    const text = normalizeText([
      property.ubicacion,
      property.titulo,
      property.descripcion
    ].filter(Boolean).join(" "));

    if (text.includes("estados unidos") || text.includes("miami") || text.includes("orlando") || text.includes("usa"))
      return "usa";
    if (text.includes("dubai") || text.includes("dubái"))
      return "dubai";
    if (text.includes("uruguay") || text.includes("punta del este") || text.includes("montevideo"))
      return "uruguay";
    if (text.includes("espana") || text.includes("españa") || text.includes("madrid") || text.includes("barcelona"))
      return "espana";

    return "argentina";
  }

  function getPropertyOperation(property) {
    // categoria ya viene resuelta desde el servidor (override → CRM)
    if (property.categoria) return normalizeOperation(property.categoria);
    return normalizeOperation(property.operacion || property.tipo || property.tag || "");
  }

  function getPropertyCurrency(property) {
    const rawCurrency =
      property.moneda         ||
      property.currency       ||
      property.raw?.moneda_propiedad ||
      property.raw?.moneda   ||
      "";

    const priceText = normalizeText(property.precio || "");
    const currency  = normalizeText(rawCurrency);

    if (currency.includes("ars") || currency.includes("$") || currency.includes("peso"))
      return "ars";

    if (currency.includes("usd") || priceText.includes("usd") || priceText.includes("u$s"))
      return "usd";

    if (priceText.includes("$") && !priceText.includes("usd") && !priceText.includes("u$s"))
      return "ars";

    return "";
  }

  function getPropertyPriceNumber(property) {
    if (typeof property.precio_numero === "number") return property.precio_numero;
    if (typeof property.price_number  === "number") return property.price_number;
    if (typeof property.raw?.precio_propiedad === "number") return property.raw.precio_propiedad;

    const source = String(property.precio || property.raw?.precio_propiedad || "");
    const clean  = source.replace(/[^\d]/g, "");
    const value  = Number(clean);

    return Number.isFinite(value) ? value : null;
  }

  function getPropertyDetailUrl(property) {
    const id = property.id || property.app_id || "";
    return `/propiedad?id=${encodeURIComponent(id)}`;
  }

  function getPropertyImage(property) {
    if (property.imagen) return property.imagen;

    if (Array.isArray(property.imagenes) && property.imagenes.length) {
      return property.imagenes[0];
    }

    if (Array.isArray(property.raw?.imagenes_propiedad) && property.raw.imagenes_propiedad.length) {
      return property.raw.imagenes_propiedad[0]?.source || "assets/propiedades/condor-resort.jpeg";
    }

    return "assets/propiedades/condor-resort.jpeg";
  }

  function pushTrackingEvent(eventName, payload = {}) {
    window.GarciaTracking?.pushEvent?.(eventName, payload);
  }

  function renderProperties(items) {
    if (!propertiesGrid) return;

    if (resultsCount) {
      resultsCount.textContent =
        `${items.length} ${items.length === 1 ? "propiedad encontrada" : "propiedades encontradas"}`;
    }

    if (!items.length) {
      propertiesGrid.innerHTML =
        '<p class="properties-empty">Todavía no hay propiedades cargadas para este filtro.</p>';
      return;
    }

    propertiesGrid.innerHTML = items.map(property => {
      const detailUrl      = getPropertyDetailUrl(property);
      const propertyId     = property.id || property.app_id || "";
      const country        = getPropertyCountry(property);
      const currency       = getPropertyCurrency(property);
      const estimatedValue = getPropertyPriceNumber(property);
      const image          = getPropertyImage(property);

      return `
        <article class="property-card" id="property-${escapeHtml(propertyId)}">
          <a
            class="property-card-link"
            href="${escapeHtml(detailUrl)}"
            aria-label="Ver ficha completa de ${escapeHtml(property.titulo || "esta propiedad")}"
            data-property-id="${escapeHtml(propertyId)}"
            data-property-name="${escapeHtml(property.titulo || "")}"
            data-property-country="${escapeHtml(country)}"
            data-currency="${escapeHtml(currency)}"
            data-estimated-value="${escapeHtml(estimatedValue || "")}"
          >
            <div class="property-image">
              <img
                src="${escapeHtml(image)}"
                alt="${escapeHtml(property.titulo || "Propiedad")}"
                loading="lazy"
                decoding="async"
              />
              <span class="property-tag">${escapeHtml(
                property.tag ||
                (property.mostrar_como_inversion ? "Inversión" : "") ||
                property.operacion ||
                "Propiedad"
              )}</span>
            </div>

            <div class="property-body">
              ${hasDisplayValue(property.ubicacion) ? `<div class="property-location">${escapeHtml(property.ubicacion)}</div>` : ""}
              ${hasDisplayValue(property.titulo)    ? `<h3 class="property-title">${escapeHtml(property.titulo)}</h3>` : ""}
              ${hasDisplayValue(property.bajada)    ? `<p class="property-bajada">${escapeHtml(property.bajada)}</p>` : ""}

              ${property.mostrar_como_inversion && hasDisplayValue(property.ticket_minimo)
                ? `<div class="property-price">Desde ${escapeHtml(property.ticket_minimo)}</div>`
                : hasDisplayValue(property.precio)
                  ? `<div class="property-price">${escapeHtml(property.precio)}</div>`
                  : ""
              }

              ${!property.mostrar_como_inversion && hasDisplayValue(property.descripcion)
                ? `<p class="property-text">${escapeHtml(property.descripcion.slice(0, 110))}${property.descripcion.length > 110 ? "…" : ""}</p>`
                : ""
              }

              ${property.mostrar_como_inversion && hasDisplayValue(property.horizonte_inversion)
                ? `<div class="property-meta"><span>Horizonte: ${escapeHtml(property.horizonte_inversion)}</span>${hasDisplayValue(property.retorno_estimado) ? `<span>Retorno est.: ${escapeHtml(property.retorno_estimado)}</span>` : ""}</div>`
                : !property.mostrar_como_inversion && (
                    hasDisplayValue(property.ambientes) ||
                    hasDisplayValue(property.banos)     ||
                    hasDisplayValue(property.superficie)
                  )
                  ? `<div class="property-meta">
                      ${hasDisplayValue(property.ambientes)  ? `<span>${escapeHtml(property.ambientes)}</span>` : ""}
                      ${hasDisplayValue(property.banos)      ? `<span>${escapeHtml(property.banos)}</span>` : ""}
                      ${hasDisplayValue(property.superficie) ? `<span>${escapeHtml(property.superficie)}</span>` : ""}
                    </div>`
                  : ""
              }
            </div>
          </a>

          <div class="property-card-actions">
            <a
              class="btn btn-dark"
              href="${escapeHtml(detailUrl)}"
              data-property-detail-button
              data-property-id="${escapeHtml(propertyId)}"
              data-property-name="${escapeHtml(property.titulo || "")}"
            >
              Ver ficha completa
            </a>
          </div>
        </article>
      `;
    }).join("");

    setupPropertyClickTracking();
  }

  function setupPropertyClickTracking() {
    document.querySelectorAll(".property-card-link, [data-property-detail-button]").forEach(link => {
      link.addEventListener("click", () => {
        pushTrackingEvent("select_product", {
          product_id:       link.dataset.propertyId     || "",
          product_name:     link.dataset.propertyName   || "",
          property_id:      link.dataset.propertyId     || "",
          property_name:    link.dataset.propertyName   || "",
          property_country: link.dataset.propertyCountry|| "",
          currency:         link.dataset.currency       || "",
          estimated_value:  link.dataset.estimatedValue || "",
          page_location:    window.location.href
        });
      });
    });
  }

  function setActiveButton(buttons, datasetKey, activeValue) {
    buttons.forEach(button => {
      const isActive = button.dataset[datasetKey] === activeValue;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function applyFilters() {
    setActiveButton(countryButtons,   "country", activeCountry);
    setActiveButton(operationButtons, "filter",  activeOperation);

    const locationSearch = normalizeText(searchInput?.value || "");
    const currency       = currencySelect?.value || "todas";
    const minPrice       = parsePriceInput(minPriceInput?.value);
    const maxPrice       = parsePriceInput(maxPriceInput?.value);

    const filtered = properties.filter(property => {
      const countryMatches =
        activeCountry === "todas" ||
        getPropertyCountry(property) === activeCountry;

      const operationMatches =
        activeOperation === "todas" ||
        getPropertyOperation(property) === activeOperation;

      const searchableText = normalizeText([
        property.ubicacion,
        property.titulo,
        property.descripcion,
        property.pais,
        property.country,
        property.raw?.barrio,
        property.raw?.ciudad,
        property.raw?.provincia
      ].filter(Boolean).join(" "));

      const locationMatches = !locationSearch || searchableText.includes(locationSearch);

      const currencyMatches =
        currency === "todas" ||
        getPropertyCurrency(property) === currency;

      const price = getPropertyPriceNumber(property);
      const minMatches = minPrice === null || price === null || price >= minPrice;
      const maxMatches = maxPrice === null || price === null || price <= maxPrice;

      return countryMatches && operationMatches && locationMatches && currencyMatches && minMatches && maxMatches;
    });

    renderProperties(filtered);
  }

  countryButtons.forEach(button => {
    button.addEventListener("click", () => {
      activeCountry   = button.dataset.country || "todas";
      activeOperation = "todas";

      pushTrackingEvent("select_zone", {
        zone_name:   activeCountry,
        button_text: button.textContent.trim(),
        filter_type: "country"
      });

      applyFilters();
    });
  });

  operationButtons.forEach(button => {
    button.addEventListener("click", () => {
      activeOperation = button.dataset.filter || "todas";

      pushTrackingEvent("select_service", {
        service_name: activeOperation,
        button_text:  button.textContent.trim(),
        filter_type:  "operation"
      });

      applyFilters();
    });
  });

  [searchInput, currencySelect, minPriceInput, maxPriceInput].forEach(element => {
    element?.addEventListener("input",  applyFilters);
    element?.addEventListener("change", applyFilters);
  });

  clearAdvancedButton?.addEventListener("click", () => {
    if (searchInput)    searchInput.value    = "";
    if (currencySelect) currencySelect.value = "todas";
    if (minPriceInput)  minPriceInput.value  = "";
    if (maxPriceInput)  maxPriceInput.value  = "";

    pushTrackingEvent("clear_property_filters", { page_location: window.location.href });

    applyFilters();
  });

  window.filterProperties = function (type) {
    activeOperation = type || "todas";
    applyFilters();
  };

  function syncFilterVisibility() {
    const activeCountries  = new Set(properties.map(p => getPropertyCountry(p)));
    const activeOperations = new Set(properties.map(p => getPropertyOperation(p)));

    countryButtons.forEach(btn => {
      const country = btn.dataset.country;
      if (country === "todas") return;
      btn.style.display = activeCountries.has(country) ? "" : "none";
    });

    operationButtons.forEach(btn => {
      const filter = btn.dataset.filter;
      if (filter === "todas") return;
      btn.style.display = activeOperations.has(filter) ? "" : "none";
    });
  }

  async function loadProperties() {
    const sources = [
      "/api/properties",
      "data/properties.json",
      "../data/properties.json"
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) throw new Error("No disponible");

        const data = await response.json();
        properties = Array.isArray(data) ? data : [];

        pushTrackingEvent("view_content", {
          content_name:  "Listado de propiedades",
          content_type:  "real_estate_listing",
          items_count:   properties.length,
          page_location: window.location.href
        });

        syncFilterVisibility();
        applyFilters();
        return;
      } catch (_) {
        /* continúa al siguiente fallback */
      }
    }

    if (propertiesGrid) {
      propertiesGrid.innerHTML =
        '<p class="properties-empty">No pudimos cargar las propiedades. Ejecutá la web con <code>npm start</code> o revisá el archivo data/properties.json.</p>';
    }
  }

  loadProperties();
})();
