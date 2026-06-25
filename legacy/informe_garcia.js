const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, ExternalHyperlink,
  LevelFormat, TableOfContents
} = require('docx');
const fs = require('fs');

const NAVY = "0c2948";
const GOLD = "cda04f";
const IVORY = "f2ede4";
const LIGHT_GRAY = "f5f5f5";
const MID_GRAY = "e0e0e0";
const DARK_GRAY = "444444";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: NAVY, font: "Arial" })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: NAVY, font: "Arial" })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: "333333", font: "Arial" })]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK_GRAY, ...opts })]
  });
}

function bullet(text, bold_prefix = null) {
  const children = [];
  if (bold_prefix) {
    children.push(new TextRun({ text: bold_prefix + " ", bold: true, size: 22, font: "Arial", color: DARK_GRAY }));
  }
  children.push(new TextRun({ text: bold_prefix ? text : text, size: 22, font: "Arial", color: DARK_GRAY }));
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children
  });
}

function check(text, done = true) {
  return new Paragraph({
    numbering: { reference: done ? "checks" : "pending", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK_GRAY })]
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
    children: []
  });
}

function space(n = 1) {
  return new Paragraph({ spacing: { before: 80 * n, after: 0 }, children: [] });
}

function statusTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4200, 2580, 2580],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableCell("Ítem", true, NAVY, "FFFFFF", 4200),
          tableCell("Estado", true, NAVY, "FFFFFF", 2580),
          tableCell("Detalle", true, NAVY, "FFFFFF", 2580),
        ]
      }),
      ...rows.map(([item, estado, detalle]) =>
        new TableRow({
          children: [
            tableCell(item, false, LIGHT_GRAY, DARK_GRAY, 4200),
            tableCell(estado, false, estado.includes("Completado") || estado.includes("Activo") ? "e6f4ea" : estado.includes("Pendiente") ? "fff8e1" : "fce4ec", DARK_GRAY, 2580),
            tableCell(detalle, false, "FFFFFF", DARK_GRAY, 2580),
          ]
        })
      )
    ]
  });
}

function tableCell(text, isHeader, fill, textColor, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: isHeader, size: isHeader ? 22 : 20, font: "Arial", color: isHeader ? "FFFFFF" : textColor })]
    })]
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      },
      {
        reference: "checks",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "✓", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      },
      {
        reference: "pending",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "○", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      },
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
          spacing: { after: 200 },
          tabStops: [{ type: "right", position: 8640 }],
          children: [
            new TextRun({ text: "Garcia Inversiones Inmobiliarias", bold: true, size: 18, font: "Arial", color: NAVY }),
            new TextRun({ text: "\tInforme de Desarrollo Web", size: 18, font: "Arial", color: "888888" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
          spacing: { before: 200 },
          tabStops: [{ type: "right", position: 8640 }],
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: "Confidencial — Uso interno", size: 16, font: "Arial", color: "888888" }),
            new TextRun({ text: "\tPágina ", size: 16, font: "Arial", color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "888888" }),
          ]
        })]
      })
    },
    children: [

      // ===================== PORTADA =====================
      space(4),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "GARCÍA INVERSIONES INMOBILIARIAS", bold: true, size: 52, font: "Arial", color: NAVY })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD } },
        children: [new TextRun({ text: "Informe Completo de Desarrollo Web", size: 30, font: "Arial", color: "555555" })]
      }),
      space(1),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: "garciainversionesinmobiliarias.com.ar", size: 22, font: "Arial", color: GOLD })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "Junio 2026", size: 22, font: "Arial", color: "888888" })]
      }),
      space(6),

      // Tabla resumen portada
      new Table({
        width: { size: 6000, type: WidthType.DXA },
        columnWidths: [3000, 3000],
        rows: [
          new TableRow({ children: [
            tableCell("Propietaria", true, NAVY, "FFFFFF", 3000),
            tableCell("Fabiana García", false, IVORY, DARK_GRAY, 3000),
          ]}),
          new TableRow({ children: [
            tableCell("Dominio activo", true, NAVY, "FFFFFF", 3000),
            tableCell("garciainversionesinmobiliarias.com.ar", false, IVORY, DARK_GRAY, 3000),
          ]}),
          new TableRow({ children: [
            tableCell("Dominio CRM", true, NAVY, "FFFFFF", 3000),
            tableCell("garciainversiones.com.ar", false, IVORY, DARK_GRAY, 3000),
          ]}),
          new TableRow({ children: [
            tableCell("Plataforma", true, NAVY, "FFFFFF", 3000),
            tableCell("Vercel + Node.js + Supabase", false, IVORY, DARK_GRAY, 3000),
          ]}),
          new TableRow({ children: [
            tableCell("CRM", true, NAVY, "FFFFFF", 3000),
            tableCell("2Clics Inmobiliario", false, IVORY, DARK_GRAY, 3000),
          ]}),
          new TableRow({ children: [
            tableCell("Propiedades activas", true, NAVY, "FFFFFF", 3000),
            tableCell("39 (CRM activo)", false, IVORY, DARK_GRAY, 3000),
          ]}),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== INDICE =====================
      h1("Contenido"),
      new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-3" }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 1. CONTEXTO =====================
      h1("1. Contexto del Proyecto"),
      divider(),
      p("Garcia Inversiones Inmobiliarias es una consultora boutique de real estate fundada y dirigida por Fabiana Garcia, con base en Nordelta, Tigre. La empresa opera en mercados de Argentina, Estados Unidos (Miami), Uruguay, Dubaí y España, ofreciendo asesoramiento personalizado y propiedades seleccionadas."),
      space(),
      p("El proyecto consistió en desarrollar un sitio web institucional de alta gama que refleje la identidad boutique de la marca, independiente del CRM de 2Clics (garciainversiones.com.ar) que opera el portfolio de propiedades. El nuevo sitio (garciainversionesinmobiliarias.com.ar) actúa como la cara de la empresa: institucional, elegante y orientada a la conversión."),

      space(2),
      h2("1.1 Arquitectura General"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 3430, 3430],
        rows: [
          new TableRow({ tableHeader: true, children: [
            tableCell("Capa", true, NAVY, "FFFFFF", 2500),
            tableCell("Tecnología", true, NAVY, "FFFFFF", 3430),
            tableCell("Función", true, NAVY, "FFFFFF", 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Frontend", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("HTML5 + CSS3 + Vanilla JS", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("Interfaz sin frameworks, máxima velocidad", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Backend", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Node.js + Express (Vercel Serverless)", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("API endpoints, formularios, webhooks", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Base de datos", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Supabase (PostgreSQL)", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("Almacenamiento de leads y consultas", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Hosting / Deploy", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Vercel", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("Deploy automático desde GitHub", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("CDN / Seguridad", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Cloudflare", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("DNS, HTTPS, protección DDoS", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Anti-bot", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Cloudflare Turnstile", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("Protección de formularios", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Analytics / Tracking", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Google Tag Manager (GTM-MBNKBBSW)", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("Events, conversiones, Meta Pixel", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("Email transaccional", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("Resend API", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("Confirmaciones de formulario", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
          new TableRow({ children: [
            tableCell("CRM de propiedades", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("2Clics Inmobiliario", false, "FFFFFF", DARK_GRAY, 3430),
            tableCell("39 propiedades activas (garciainversiones.com.ar)", false, "FFFFFF", DARK_GRAY, 3430),
          ]}),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 2. LO QUE HABIA ANTES =====================
      h1("2. Estado Inicial del Sitio (Antes de las Sesiones)"),
      divider(),
      p("Al inicio del proyecto de mejora, el sitio ya contaba con una base funcional construida previamente. Estos son los elementos que estaban implementados:"),
      space(),

      h2("2.1 Infraestructura Pre-existente"),
      bullet("Dominio garciainversionesinmobiliarias.com.ar activo y apuntando a Vercel"),
      bullet("Repositorio GitHub conectado con deploy automático en cada push a main"),
      bullet("Backend Node.js + Express funcionando como servidor Vercel Serverless"),
      bullet("Supabase conectado con tabla de leads (service role key en Vercel env vars)"),
      bullet("Cloudflare Turnstile integrado en el formulario de contacto"),
      bullet("Google Tag Manager implementado (GTM-MBNKBBSW)"),
      bullet("Resend API para envío de emails transaccionales"),
      bullet("Sistema de cache-busting con ?v=N en scripts y estilos"),
      bullet("Honeypot fields y validación de timestamp anti-bot en formularios"),
      bullet("Página 404.html personalizada"),
      bullet("Página gracias-consulta.html con tracking de conversión"),
      bullet("Página privacidad.html"),
      bullet("propiedad.html (ficha de propiedad individual)"),
      bullet("Página propiedades.html con filtros por país y tipo de operación"),
      bullet("assets/js/tracking.js para eventos GTM"),
      bullet("assets/js/properties-page.js para lógica de filtros"),
      bullet("Logo SVG: Garcia-simple.svg e isotipo.png"),
      bullet("Variables CSS: --navy, --gold, --ivory, --muted definidas"),
      bullet("Google Fonts: Cormorant Garamond como tipografía principal"),
      bullet("Hero con slider de imágenes (múltiples slides)"),
      bullet("Sección Nosotros con imagen placeholder (RS.svg)"),
      bullet("Sección Servicios con 3 tarjetas"),
      bullet("Sección Mercados con Argentina, USA, Uruguay, Dubai, España y México"),
      bullet("Sección Contacto con formulario funcional"),
      bullet("Footer con links de mercados y redes sociales"),
      bullet("Schema.org markup (LocalBusiness + RealEstateAgent)"),
      bullet("Meta tags SEO en todas las páginas"),
      bullet("WhatsApp CTA con número +54 911 6724 0353"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 3. LO QUE HICIMOS =====================
      h1("3. Trabajo Realizado en las Sesiones de Desarrollo"),
      divider(),

      h2("3.1 Eliminación Completa de México"),
      p("México fue eliminado de todo el ecosistema del sitio ya que dejó de formar parte del portfolio de mercados."),
      bullet("Eliminado de index.html: tarjeta de mercado, footer, schema.org"),
      bullet("Eliminado de propiedades.html: botón de filtro 'México', meta description"),
      bullet("Eliminado de propiedad.html, 404.html, privacidad.html, gracias-consulta.html"),
      bullet("Eliminado de properties-page.js: COUNTRY_ALIASES (mexico, méxico, riviera maya, tulum, playa del carmen)"),
      bullet("Verificación completa: 0 referencias restantes en todo el código"),

      space(),
      h2("3.2 Brief de Contenido (18 Cambios Textuales)"),
      p("Se aplicó un brief completo de contenido que reescribió los textos de la home:"),
      bullet("Título hero: cambiado a 'Real estate con visión estratégica' (dos líneas, sin punto)"),
      bullet("Hero subtitle: texto actualizado al perfil boutique"),
      bullet("Sección Nosotros: título 'Una empresa familiar con mirada global'"),
      bullet("Nombre de Fabiana García marcado en <strong> en el texto"),
      bullet("Sección Servicios: reestructurada de 3 a 4 cards"),
      bullet("Nuevo servicio 03 agregado: 'Propietarios' (gestión y alquiler)"),
      bullet("Servicio 04: 'Mercados internacionales' (antes era el 03)"),
      bullet("Textos de los 5 mercados completamente reescritos con información específica"),
      bullet("Sección Diferencial: título 'Por qué García Inversiones?' y subtítulo 'Porque no mostramos todo.'"),
      bullet("3 bloques diferenciadores reescritos"),
      bullet("Contador de mercados: 5 → +8 en el stat de mercados internacionales"),
      bullet("CTA principal: 'Tu próxima decisión inmobiliaria empieza con una conversación.'"),
      bullet("Contacto: badge actualizado ('Atención directa'), placeholder textarea actualizado"),
      bullet("Footer tagline: texto actualizado al perfil boutique"),
      bullet("Footer mercados: orden Argentina, Estados Unidos, Uruguay, Dubaí, España"),
      bullet("Sección números eliminada"),
      bullet("Sección testimonios eliminada (reemplazada por why-stats)"),

      space(),
      h2("3.3 Brief Visual (8 Cambios de Diseño)"),
      bullet("Título hero: split de color (línea 1 blanca, 'visión estratégica' en dorado)"),
      bullet("Intro-strip eliminado del HTML"),
      bullet("Stats: rediseñadas de tarjeta con borde a lista con borde-izquierdo dorado"),
      bullet("Service cards: min-height 320px, display flex column"),
      bullet("Market cards: fondo navy oscuro, borde superior dorado 3px, texto muted"),
      bullet("Why-stats strip: grid de 3 columnas con números Cormorant Garamond dorados"),
      bullet("Numbers-strip: eliminada de HTML (CSS preservado)"),
      bullet("Botón 'Enviar consulta': color gold (btn-primary)"),

      space(),
      h2("3.4 Brand Guide Visual Completo"),
      bullet("Tipografía: migración de Inter a Jost en todas las páginas (index, propiedades, propiedad, 404, privacidad, gracias)"),
      bullet("Google Fonts actualizado: Cormorant Garamond + Jost en todos los archivos"),
      bullet("Ivory actualizado a #f2ede4 (tono más cálido)"),
      bullet("Eyebrow labels: Jost 11px, letter-spacing 4px, weight 600, color gold"),
      bullet("Botones: font Jost, 13px, weight 600, border-radius 24px"),
      bullet("Service icons: números 01-04 en Cormorant Garamond 48px, dorado, 0.8 opacity"),
      bullet("Market chip: Jost 10px, letter-spacing 4px, sin background"),
      bullet("Market cards: h3 separado de service-card h3 (blanco vs navy)"),
      bullet("Market cards: p con color --muted, font-size 0.92rem, line-height 1.7"),

      space(),
      h2("3.5 Foto de Fabiana García"),
      bullet("Foto recibida en formato PNG (393 KB)"),
      bullet("Convertida a WebP con cwebp.exe -q 82: resultado 14 KB (96% de reducción)"),
      bullet("Guardada como public/assets/FabianaGarcia.webp"),
      bullet("Implementada en sección Nosotros reemplazando RS.svg placeholder"),
      bullet("CSS corregido para desktop: columna fija 380px, sin min-height, align-self: start"),
      bullet("CSS corregido para mobile: border-radius 14px, height auto, object-position top center"),
      bullet("About-grid desktop: grid-template-columns 380px 1fr, gap 56px"),

      space(),
      h2("3.6 Hero Image (Condor Resort)"),
      bullet("Video garcia_hero_real_1080.mp4 evaluado y descartado (preferencia del cliente)"),
      bullet("Segunda imagen del slider (casa-nordelta.jpeg) eliminada"),
      bullet("Slide único: condor-resort.jpeg"),
      bullet("CSS aplicado: filter saturate(1.35) brightness(1.05) para más color y vida"),

      space(),
      h2("3.7 Sección Propiedades — Coming Soon"),
      bullet("Filtros, toolbar y propertiesGrid envueltos en display:none (reversible)"),
      bullet("Placeholder 'Selección en preparación' con estilos inline agregado en index.html"),
      bullet("Misma lógica aplicada en propiedades.html"),
      bullet("Cache-buster properties-page.js actualizado a ?v=10"),

      space(),
      h2("3.8 Actualización de Todas las Páginas"),
      p("Todas las páginas del sitio fueron actualizadas de manera coherente:"),
      bullet("propiedad.html: Jost agregado, México eliminado del footer"),
      bullet("404.html: Jost agregado, México eliminado del footer"),
      bullet("privacidad.html: Jost agregado, México eliminado del footer"),
      bullet("gracias-consulta.html: Jost agregado, tracking actualizado"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 4. AUDITORIA CRM =====================
      h1("4. Auditoría del CRM Activo (garciainversiones.com.ar)"),
      divider(),
      p("Se realizó una auditoría completa del sitio CRM activo con 39 propiedades para identificar inconsistencias y oportunidades de mejora."),

      space(),
      h2("4.1 Inventario de Propiedades"),
      statusTable([
        ["Total propiedades", "Activo", "39 propiedades"],
        ["Departamentos", "Activo", "17 unidades"],
        ["Terrenos / Lotes", "Activo", "10 unidades"],
        ["Oficinas", "Activo", "7 unidades"],
        ["Casas", "Activo", "4 unidades"],
        ["Locales comerciales", "Activo", "1 unidad"],
        ["Páginas de resultados", "Activo", "5 páginas (8 por página)"],
      ]),

      space(),
      h2("4.2 Problemas Detectados en el CRM"),
      bullet("Dos emails distintos para Fabiana: fabigarciareal@gmail.com y fabianagarciareal@gmail.com"),
      bullet("Dos prefijos de ID de propiedad: GAR- y FAB- (debería ser sólo GAR-)"),
      bullet("Categoría 'Rivera Maya' todavía presente en el listado de tipos (México)"),
      bullet("Diseño genérico de 2Clics — no refleja la marca García"),
      bullet("Fichas de propiedad sin Google Maps embebido"),
      bullet("Imágenes de Palmares del Delta con marca de agua del CRM"),

      space(),
      h2("4.3 Fortalezas del CRM"),
      bullet("Fichas completas: m², ambientes, baños, cocheras, orientación, condición"),
      bullet("Galería de fotos: entre 7 y 19 imágenes por propiedad con carrusel"),
      bullet("CTAs funcionales: WhatsApp, llamada, email, formulario"),
      bullet("Propiedades relacionadas al pie de cada ficha"),
      bullet("Filtros completos: tipo, operación, ciudad, dormitorios, precio, orden"),
      bullet("Textos de descripción ricos por propiedad"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 5. SEGURIDAD =====================
      h1("5. Ciberseguridad — Auditoría Completa"),
      divider(),
      p("Se realizó una auditoría línea por línea del archivo server.js y vercel.json. El sitio ya tenía implementado un nivel de seguridad muy alto desde el inicio. A continuación el detalle completo de lo que estaba activo, lo que se agregó en esta sesión, y lo único pendiente que requiere acción del cliente."),

      space(),
      h2("5.1 Seguridad de Credenciales y Acceso"),
      check("API keys NUNCA en código fuente — solo en Vercel Environment Variables"),
      check("TURNSTILE_SECRET_KEY: variable de entorno Vercel marcada como Sensitive"),
      check("RESEND_API_KEY: variable de entorno Vercel"),
      check("SUPABASE_URL: variable de entorno Vercel"),
      check("SUPABASE_SERVICE_ROLE_KEY: variable de entorno Vercel marcada como Sensitive"),
      check("CRM_HASH: variable de entorno Vercel"),
      check("Sin archivo .env en el repositorio de GitHub"),
      check("Supabase accedido SOLO desde server.js — nunca expuesto al frontend"),
      check("Sin clave anónima/pública de Supabase en el frontend"),
      check("Repositorio privado en GitHub"),
      check("x-powered-by deshabilitado — no revela que el backend es Express"),

      space(),
      h2("5.2 Protección de Formularios Anti-Bot"),
      check("Cloudflare Turnstile en todos los formularios (verificación humana real)"),
      check("Honeypot field 'website' — campo invisible que solo los bots completan"),
      check("Timing check: formulario enviado en menos de 3 segundos → descartado silenciosamente"),
      check("Filtro de contenido spam: frases conocidas, demasiados links, user-agent sospechoso"),
      check("Nombre === apellido detectado como bot y descartado"),
      check("Rate limiting propio en memoria: /api/contact máx 5 envíos / 15 min por IP"),
      check("Rate limiting propio en memoria: /api/newsletter máx 3 envíos / 15 min por IP"),
      check("Rate limiting en webhook 2Clics: máx 120 llamadas / minuto por IP"),

      space(),
      h2("5.3 Validación y Sanitización de Inputs"),
      check("Validación de formato de email con regex"),
      check("Validación de formato de teléfono (solo números, +, -, espacios, paréntesis)"),
      check("Longitudes máximas por campo: nombre 120, teléfono 30, email 254, mensaje 2000 chars"),
      check("Motivos de consulta validados contra lista blanca (Set de valores permitidos)"),
      check("Escape HTML en todos los inputs antes de insertarlos en emails (XSS prevention)"),
      check("Payload size limit: 10 KB para endpoints generales, 50 KB para webhook CRM"),
      check("Protección contra log injection: event names sanitizados a solo alfanumérico"),

      space(),
      h2("5.4 Headers de Seguridad HTTP"),
      check("Content-Security-Policy completo: controla qué scripts, fonts, imágenes e iframes se cargan"),
      check("X-Content-Type-Options: nosniff — previene MIME sniffing"),
      check("X-Frame-Options: SAMEORIGIN — previene clickjacking"),
      check("Referrer-Policy: strict-origin-when-cross-origin"),
      check("Permissions-Policy: deshabilita cámara, micrófono y geolocalización"),
      check("STRICT-TRANSPORT-SECURITY (HSTS): max-age 2 años + preload — AGREGADO en esta sesion"),
      check("X-DNS-Prefetch-Control: on — AGREGADO en esta sesion"),
      check("Headers aplicados a rutas Express (server.js) — ya existía"),
      check("Headers aplicados a páginas HTML estáticas (vercel.json) — GAP CORREGIDO en esta sesion"),

      space(),
      h2("5.5 Protección de Infraestructura"),
      check("HTTPS obligatorio: Vercel + Cloudflare, certificado SSL automático"),
      check("CORS con lista blanca de orígenes permitidos (dominios propios + localhost)"),
      check("Protección SSRF: función isPublicHttpsUrl bloquea IPs privadas, localhost, cloud metadata (169.254.x.x, 10.x, 192.168.x)"),
      check("Sanitización de URLs de video/tour: solo hosts conocidos permitidos (YouTube, Vimeo, Matterport)"),
      check("Hash de autorización en webhook CRM: sin hash válido → 403 inmediato"),
      check("Soft delete de propiedades: nunca se borran, se marcan como 'eliminada'"),
      check("Redirecciones 301 para URLs con extensión .html (evita duplicado de contenido)"),

      space(),
      h2("5.6 Privacidad y Trazabilidad"),
      check("Logs de producción sin datos personales (PII): solo event_id, tipo, timestamps"),
      check("Errores de producción genéricos: sin detalles internos expuestos al usuario"),
      check("Alerta técnica de fallos en 2Clics: sin nombre/teléfono/email del usuario"),
      check("Meta Pixel SOLO vía Google Tag Manager — nunca hardcodeado en HTML"),
      check("Todo el tracking centralizado en GTM (GTM-MBNKBBSW)"),

      space(),
      h2("5.7 Gap Detectado y Corregido en Esta Sesión"),
      p("Durante la auditoría se identificó un gap real: las páginas HTML servidas directamente por Vercel (index.html, propiedades.html, privacidad.html, gracias-consulta.html) NO pasaban por el middleware de Express y por lo tanto NO recibían los headers de seguridad."),
      space(),
      p("Solución implementada: se agregaron los headers de seguridad completos en vercel.json con alcance global (source: /(.*)) para cubrir el 100% del tráfico del sitio, incluyendo archivos estáticos. También se agregaron HSTS y X-DNS-Prefetch-Control tanto en vercel.json como en server.js para consistencia total. Commit: 5f64919 — pusheado a producción."),

      space(),
      h2("5.8 Pendientes que Requieren Acción del Cliente (no son código)"),
      statusTable([
        ["Upgrade Supabase a Pro", "Pendiente", "Plan gratuito se pausa automáticamente — migrar antes de activar webhook CRM ($25/mes)"],
        ["Rotación de API keys", "Pendiente", "Rotar keys de Resend, Supabase y Turnstile cada 6-12 meses"],
        ["Monitoring de errores", "Pendiente", "Integrar Sentry (plan gratuito) para alertas automáticas de errores en producción"],
      ]),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 6. PENDIENTES =====================
      h1("6. Tareas Pendientes"),
      divider(),

      h2("6.1 Integración CRM (Prioridad Alta)"),
      statusTable([
        ["Webhook 2Clics → nuevo sitio", "Pendiente", "URL: /api/2clics/webhook"],
        ["CRM_HASH de 2Clics", "Pendiente", "Solicitar a 2Clics el hash"],
        ["CRM_AGENT_ID de 2Clics", "Pendiente", "Solicitar a 2Clics el agent ID"],
        ["Upgrade Supabase Pro", "Pendiente", "Antes de activar el webhook"],
        ["Activar sección propiedades", "Pendiente", "Quitar display:none cuando CRM conecte"],
      ]),

      space(),
      h2("6.2 Diseño Propiedades (Post-CRM)"),
      statusTable([
        ["Rediseño cards de propiedad", "Pendiente", "Inspirado en Nikota Realty"],
        ["Rediseño ficha de propiedad", "Pendiente", "Tabs: Galería / Detalles / Mapa / Consultar"],
        ["Google Maps en fichas", "Pendiente", "Usar dirección del CRM"],
        ["Filtros avanzados", "Pendiente", "Vistas, pileta, características"],
        ["Precio por m² calculado", "Pendiente", "En ficha de propiedad"],
      ]),

      space(),
      h2("6.3 Mejoras de Contenido"),
      statusTable([
        ["Testimonios reales", "Pendiente", "Agregar cuando Fabiana provea textos"],
        ["Sección Off-Market", "Pendiente", "Propiedades exclusivas no publicadas"],
        ["Fotogalería home", "Pendiente", "10 mejores fotos del CRM seleccionadas"],
        ["Floor plans descargables", "Pendiente", "PDF por propiedad (si el CRM los provee)"],
      ]),

      space(),
      h2("6.4 CRM (Acciones del Cliente en 2Clics)"),
      statusTable([
        ["Unificar email de Fabiana", "Pendiente", "Usar un solo email en todas las fichas"],
        ["Unificar prefijo de IDs", "Pendiente", "Usar GAR- en todas las propiedades"],
        ["Eliminar Rivera Maya", "Pendiente", "Borrar propiedades/categoría México del CRM"],
      ]),

      space(),
      h2("6.5 Seguridad (Pendientes del Cliente — no son código)"),
      statusTable([
        ["Upgrade Supabase Pro", "Pendiente", "Necesario antes de activar webhook — plan gratuito se pausa"],
        ["Monitoring con Sentry", "Pendiente", "Alertas automáticas de errores en producción (plan gratuito)"],
        ["Rotación de API keys", "Pendiente", "Rotar Resend, Supabase y Turnstile cada 6-12 meses"],
      ]),
      space(),
      p("Nota: Rate limiting, CSP headers, HSTS y todos los headers de seguridad ya están implementados y en producción desde el commit 5f64919."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 7. ARCHIVOS CLAVE =====================
      h1("7. Archivos Clave del Proyecto"),
      divider(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3800, 5560],
        rows: [
          new TableRow({ tableHeader: true, children: [
            tableCell("Archivo", true, NAVY, "FFFFFF", 3800),
            tableCell("Descripción", true, NAVY, "FFFFFF", 5560),
          ]}),
          ...([
            ["public/index.html", "Home principal — el archivo más importante"],
            ["public/style.css", "Todo el CSS del sitio — variables, componentes, responsive"],
            ["public/propiedades.html", "Sección propiedades (oculta hasta CRM)"],
            ["public/propiedad.html", "Ficha individual de propiedad"],
            ["public/gracias-consulta.html", "Página post-formulario con tracking"],
            ["public/privacidad.html", "Política de privacidad"],
            ["public/404.html", "Página de error personalizada"],
            ["public/assets/FabianaGarcia.webp", "Foto de Fabiana (14 KB, optimizada)"],
            ["public/assets/logos/Garcia-simple.svg", "Logo principal SVG"],
            ["public/assets/logos/isotipo.png", "Isotipo para favicon"],
            ["public/assets/condor-resort.jpeg", "Imagen hero principal"],
            ["public/assets/js/tracking.js", "Eventos GTM y tracking"],
            ["public/assets/js/properties-page.js", "Lógica de filtros de propiedades"],
            ["server.js", "Backend Express: formularios, webhook, Supabase"],
            ["vercel.json", "Configuración de rutas y deployment en Vercel"],
          ].map(([file, desc]) => new TableRow({ children: [
            tableCell(file, false, LIGHT_GRAY, NAVY, 3800),
            tableCell(desc, false, "FFFFFF", DARK_GRAY, 5560),
          ]})))
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 8. BRAND GUIDE =====================
      h1("8. Brand Guide Técnico"),
      divider(),
      p("Referencia rápida para mantener consistencia visual en cualquier trabajo futuro:"),
      space(),

      h2("8.1 Paleta de Colores"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 2000, 4860],
        rows: [
          new TableRow({ tableHeader: true, children: [
            tableCell("Variable CSS", true, NAVY, "FFFFFF", 2500),
            tableCell("Valor Hex", true, NAVY, "FFFFFF", 2000),
            tableCell("Uso", true, NAVY, "FFFFFF", 4860),
          ]}),
          new TableRow({ children: [
            tableCell("--navy", false, "0c2948", "FFFFFF", 2500),
            tableCell("#0c2948", false, LIGHT_GRAY, DARK_GRAY, 2000),
            tableCell("Color principal, headers, fondos oscuros", false, "FFFFFF", DARK_GRAY, 4860),
          ]}),
          new TableRow({ children: [
            tableCell("--gold", false, "cda04f", "FFFFFF", 2500),
            tableCell("#cda04f", false, LIGHT_GRAY, DARK_GRAY, 2000),
            tableCell("Acentos, CTAs, eyebrows, bordes decorativos", false, "FFFFFF", DARK_GRAY, 4860),
          ]}),
          new TableRow({ children: [
            tableCell("--ivory", false, "f2ede4", "1a1a1a", 2500),
            tableCell("#f2ede4", false, LIGHT_GRAY, DARK_GRAY, 2000),
            tableCell("Fondos cálidos, sección diferencial", false, "FFFFFF", DARK_GRAY, 4860),
          ]}),
          new TableRow({ children: [
            tableCell("--muted", false, "7793ab", "FFFFFF", 2500),
            tableCell("#7793ab", false, LIGHT_GRAY, DARK_GRAY, 2000),
            tableCell("Textos secundarios, market cards", false, "FFFFFF", DARK_GRAY, 4860),
          ]}),
        ]
      }),

      space(),
      h2("8.2 Tipografía"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 2500, 4360],
        rows: [
          new TableRow({ tableHeader: true, children: [
            tableCell("Fuente", true, NAVY, "FFFFFF", 2500),
            tableCell("Pesos", true, NAVY, "FFFFFF", 2500),
            tableCell("Uso", true, NAVY, "FFFFFF", 4360),
          ]}),
          new TableRow({ children: [
            tableCell("Jost", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("300, 400, 500, 600", false, "FFFFFF", DARK_GRAY, 2500),
            tableCell("Body, nav, botones, eyebrows, UI en general", false, "FFFFFF", DARK_GRAY, 4360),
          ]}),
          new TableRow({ children: [
            tableCell("Cormorant Garamond", false, LIGHT_GRAY, DARK_GRAY, 2500),
            tableCell("300, 400, 500, 600 + itálicas", false, "FFFFFF", DARK_GRAY, 2500),
            tableCell("Títulos de sección, números decorativos grandes, stats", false, "FFFFFF", DARK_GRAY, 4360),
          ]}),
        ]
      }),

      space(),
      h2("8.3 Componentes CSS Clave"),
      bullet(".eyebrow — Jost 11px, letter-spacing 4px, weight 600, color gold"),
      bullet(".btn.btn-primary — fondo gold, texto navy, border-radius 24px"),
      bullet(".btn.btn-secondary — borde gold, texto gold, fondo transparente"),
      bullet(".service-icon — Cormorant Garamond 48px, weight 300, gold, opacity 0.8"),
      bullet(".market-card — fondo navy, borde-top 3px gold, border-radius 8px"),
      bullet(".why-stat-number — Cormorant Garamond clamp(2.4rem,4vw,3.2rem), gold"),
      bullet(".hero-slide — filter: saturate(1.35) brightness(1.05)"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===================== 9. RESUMEN EJECUTIVO =====================
      h1("9. Resumen Ejecutivo"),
      divider(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({ tableHeader: true, children: [
            tableCell("Área", true, NAVY, "FFFFFF", 4680),
            tableCell("Estado", true, NAVY, "FFFFFF", 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Sitio web institucional", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado y en producción", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Brand guide aplicado", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — Jost + Cormorant, paleta navy/gold/ivory", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Contenido y textos", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — Brief completo aplicado", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Foto de Fabiana García", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — WebP 14KB, mobile y desktop OK", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Seguridad base", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — Turnstile, honeypot, keys en env vars", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Tracking y analytics", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — GTM, eventos de conversión", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("México eliminado", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — 0 referencias en todo el código", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Integración CRM 2Clics", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Pendiente — requiere hash y agent ID de 2Clics", false, "fff8e1", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Sección propiedades activa", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Pendiente — oculta hasta conectar CRM", false, "fff8e1", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Rate limiting en /api/", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — implementado en server.js (5/15min por IP)", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("CSP + Headers de seguridad (Express)", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — CSP completo en middleware Express", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("CSP + HSTS en páginas estáticas (Vercel)", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Completado — gap corregido, agregado en vercel.json (commit 5f64919)", false, "e6f4ea", DARK_GRAY, 4680),
          ]}),
          new TableRow({ children: [
            tableCell("Supabase Pro", false, LIGHT_GRAY, DARK_GRAY, 4680),
            tableCell("Pendiente — necesario antes de activar webhook CRM", false, "fff8e1", DARK_GRAY, 4680),
          ]}),
        ]
      }),

      space(2),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 320, after: 80 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
        children: [new TextRun({ text: " ", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "García Inversiones Inmobiliarias — Documento confidencial de uso interno", size: 18, font: "Arial", color: "888888", italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Junio 2026", size: 18, font: "Arial", color: "888888" })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\Users\\Administrator\\Documents\\Informe_Garcia_Inversiones_Web_v2.docx", buffer);
  console.log("Documento creado exitosamente.");
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
