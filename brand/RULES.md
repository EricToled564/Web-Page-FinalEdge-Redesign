# Final Edge AI — Sistema de reglas de marca (normativo)

Estas reglas son **obligatorias** para todo código y contenido de este repositorio. El script
`tools/brand-guard.mjs` (se ejecuta en `npm run build` y con `npm run brand:check`) verifica de forma
automática las reglas marcadas con ⚙ y **falla el build** si se violan. Las demás se verifican en
revisión humana.

---

## 1 · Color

- ⚙ **R1.1** Solo se permiten los hex definidos en `src/styles/tokens.css`. Cualquier otro color es
  una violación (incluye `rgb()/hsl()` que no correspondan a un token).
- **R1.2** `--accent` (Edge Blue) es el ÚNICO acento de UI: prompt, números de sección, links, focos
  y exactamente **una** placa full-bleed por página.
- **R1.3** Los colores de fase (ámbar/cian/magenta) aparecen solo como marcadores pequeños, en la
  rueda ENGINE™ y en los iconos de edge. **Nunca** como rellenos grandes. **Nunca** como estado
  (para estado existen los tokens semánticos).
- **R1.4** Proporción de superficie 90/8/2 (Void / señal / acento).

## 2 · Tipografía y tamaño

- ⚙ **R2.1** Ningún `font-size` por debajo de **14px** — piso duro, sin excepciones (incluye el valor
  mínimo de todo `clamp()`).
- ⚙ **R2.2** Solo Geist Mono (`--font-ui`) y Geist (`--font-read`). Ninguna tercera familia.
- **R2.3** Geist (sans) únicamente en párrafos largos y densos; nunca en hero, labels ni datos.

## 3 · Forma, superficie y movimiento

- ⚙ **R3.1** `border-radius` distinto de 0 está prohibido (esquinas rectas siempre).
- ⚙ **R3.2** `box-shadow` / `text-shadow` / `drop-shadow` prohibidos.
- **R3.3** Bordes = 1px `--hairline`. Retículas hairline = `gap:1px` sobre fondo `--hairline`, y
  siempre `grid-template-columns: repeat(N, minmax(0,1fr))` — nunca `1fr` a secas.
- ⚙ **R3.4** Una sola curva de easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`. Prohibidos bounce, spring,
  elastic y spinners.
- **R3.5** Tema oscuro único (restricción declarada de marca). El blanco es superficie puntual, nunca
  un modo alterno.

## 4 · Verbal (copy) — incluye gobernanza de claims del Doc E

- ⚙ **R4.1** Sin emoji en ningún archivo de interfaz o contenido.
- ⚙ **R4.2** Sin signos de exclamación (`!` / `¡`) en el copy visible.
- ⚙ **R4.3** Vocabulario prohibido (bloquea build): «revolucionario», «disruptivo», «líder»,
  «el mejor», «garantizado / garantizamos / garantía de resultados», «patentado», «100% / siempre /
  nunca falla», «más preciso que humanos».
- ⚙ **R4.4** Vocabulario condicionado (aviso, requiere caveat según Doc E §8): «propietario/a»
  (solo como arquitectura, nunca como IP), «resultados medibles» (con matiz honesto), nombres de
  clientes (requieren autorización registrada — el 2026-07-08 el cliente autorizó nombrarlos en la
  página principal).
- **R4.5** ES-MX, tuteo. Sin folklorismos. Caveats como parte de la voz («un caso», «apoyado en
  mercado», «aún no repetible»).
- **R4.6** Nunca prometer: ROI repetible multi-cliente, ahorro garantizado, evitar contrataciones
  garantizado, liderazgo de mercado, superioridad sobre competidores nombrados, cumplimiento/seguridad
  certificados (sin evidencia), tecnología de IA propietaria/IP.

## 5 · Logotipo

- ⚙ **R5.1** Prohibido aplicar `filter:` CSS a los PNG del logo (los monocromos son pre-horneados).
- **R5.2** Estructura bloqueada (2 líneas, `[ A I ]` al ancho de "final"). Nunca separar/re-espaciar/
  re-estilizar las tres partes.
- **R5.3** Mínimos: digital ≥160px de ancho; bajo ~40px usar lockup de texto `>_ nombre [AI]` ≥14px.
- **R5.4** Monocromos: siempre los PNG horneados, relieve 3D intacto, un solo silver idéntico para
  `>_` y `[AI]`.

## 6 · Rueda ENGINE™

- **R6.1** Geometría, ángulos, radios y colores canónicos (INVENTORY §7). No rediseñar sin pedido
  explícito del cliente.
- **R6.2** Etiquetas de la rueda como texto DOM/SVG nítido, nunca rasterizadas en el canvas, siempre ≥14px.
- **R6.3** Nunca reintroducir renders raster antiguos de la rueda.

## 7 · Proceso

- **R7.1** Todo cambio de marca (nuevo color, tamaño, recurso) entra primero a `tokens.css` +
  `INVENTORY.md` y después al código.
- **R7.2** `npm run brand:check` debe pasar antes de cada commit que toque `src/` o `public/`.
- **R7.3** Excepciones requieren aprobación explícita del cliente y se registran en este archivo con fecha.

### Registro de decisiones del cliente

| Fecha | Decisión |
|---|---|
| 2026-07-08 | Rueda ENGINE™ en WebGL/Three.js (inspiración igloo.inc): click en fase → la fase se ilumina/gira y se vuelve menú del hub; click en servicio → el segmento se desprende/gira y se vuelve título de la página del servicio. |
| 2026-07-08 | Lockups de edge + subtítulo en español en rueda y tarjetas. |
| 2026-07-08 | Hero del Inicio: «La IA ejecuta. La experiencia decide.» / «Haz más. Sin contratar más.». |
| 2026-07-08 | Clientes nombrados públicamente en la página principal (Sports World, Tiendas Chedraui, Kanguru Beverages, hoteles VLU, Growth Hub). |
| 2026-07-11 | Excepción a R1.3 (pedido explícito del cliente, R7.3): el landing de los hubs de fase usa el color de la fase como fondo del hero, con textura de "estática de glifos" (canvas decorativo, `phase-static.js`) y texto en void para contraste ≥4.5:1. Muestra inicial: Evaluación; Capacidades/Ejecución esperan aprobación de la muestra. |
| 2026-07-11 | Muestra de Evaluación aprobada («perfecto»); el landing con estática se extiende a Capacidades (cian) y Ejecución (magenta), cada hub en su color de fase. |

- **2026-07-13 — Excepción R3.2 (sombras) para texto sobre el efecto Blue Edge.**
  Pedido explícito del cliente: "colócale ligeras sombras oscuras al texto
  para que resalte más en blanco". Aplica SOLO al texto blanco montado
  sobre el campo animado Blue Edge (títulos/statement/rótulo de los hubs
  de fase y contenido de las bandas azules del home): `text-shadow` doble
  (1px nítida + 14px difusa) con tinta derivada de `--void-deep` vía
  color-mix — nunca un hex nuevo. El resto del sitio conserva la
  prohibición de sombras intacta.
