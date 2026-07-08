# Final Edge AI — Sitio web

Sitio de Final Edge (`finaledge.mx`): la página principal y la experiencia ENGINE™ (hubs de fase y
páginas de servicio), construidos sobre el design system del brand book con gobernanza automática
de marca.

## Stack

- **Astro 5** (salida estática, 11 páginas pre-renderizadas — SEO y velocidad primero)
- **Three.js** — la rueda ENGINE™ en WebGL con navegación viva (inspiración igloo.inc):
  - click en una **fase** → se ilumina, gira una vuelta y el resto se desvanece; lo que queda se
    convierte en el menú del hub de esa fase (`/engine/<fase>/`)
  - click en un **servicio** → el segmento se desprende, gira y se acopla como título de la página
    del servicio (`/servicios/<slug>/`)
  - la isla del canvas **persiste entre navegaciones** (View Transitions), así la coreografía fluye
    sin recargas; cada página sigue siendo HTML estático indexable
  - sin WebGL o con `prefers-reduced-motion`: enlaces estáticos y navegación directa
- **Geist Mono / Geist auto-hospedadas** (`public/fonts/`) — sin dependencia del CDN en runtime
- Layout y navegación: lenguaje visual de referencia cosmos.so (nav mínima que se oculta al bajar,
  tipografía monumental, retículas hairline, aire)

## Comandos

```
npm install
npm run dev          # desarrollo
npm run build        # build + verificación de marca (falla si hay violaciones)
npm run brand:check  # solo la verificación de marca
npm run preview      # servir el build
```

## Gobernanza de marca

- `brand/INVENTORY.md` — inventario canónico de recursos creativos (logos, iconos, paleta,
  tipografía, motivos, geometría de la rueda)
- `brand/RULES.md` — sistema de reglas normativo + registro de decisiones del cliente
- `src/styles/tokens.css` — tokens (fuente única de verdad para color, tipo, movimiento)
- `tools/brand-guard.mjs` — guardián automático: bloquea el build ante colores fuera de tokens,
  `font-size` < 14px, esquinas redondeadas, sombras, easing ajeno a la curva maestra, tipografías
  no autorizadas, vocabulario prohibido (gobernanza de claims del Doc E), emoji y exclamaciones

## Estructura

```
public/assets/logos/        PNGs del logo (master glossy + monocromos horneados)
public/assets/edge-icons/   iconos neón por edge
public/fonts/               Geist Mono / Geist (woff2 + fonts.css)
src/data/engine.js          modelo canónico: 3 fases · 6 edges · copy aprobado
src/scripts/engine-wheel.js rueda ENGINE™ WebGL (apariencia exacta del brand book §07)
src/components/             Nav · Footer · Assistant · EngineWheel
src/pages/                  index · engine/ (hub por fase) · servicios/ (6 servicios)
```

## Pendientes conocidos (requieren insumos del cliente)

- URL real del LinkedIn del fundador (footer: `data-todo="url-linkedin-fundador"`)
- Asistente de IA (voz/texto) y reservación automática de la valoración: hoy son CTA honestos que
  conducen a `mailto:`; falta el backend propio
- Versión EN (el toggle ES/EN está previsto en la interfaz como «próximamente»)
