# Final Edge AI — Inventario de recursos creativos

Fuente: `design_handoff_brand_book` (ZIP de handoff). Todos los archivos viven versionados en este
repositorio bajo `public/assets/`. Este inventario es el registro canónico: si un recurso no está
aquí, no es un recurso de marca aprobado.

---

## 1 · Logotipos (`public/assets/logos/`)

| Archivo | Qué es | Uso autorizado | Fondo autorizado |
|---|---|---|---|
| `logo-finaledge.png` | **Master.** Imagotipo 3D glossy, 2 líneas: `>_ final edge` + `[ A I ]`, transparente | Tratamiento primario | Void `#0B0B0E` / `#0E0E12` |
| `logo-mono-white.png` | Mono horneado: wordmark carbón + símbolo silver, relieve 3D intacto | Fondos claros | Blanco `#F4F4F2` |
| `logo-mono-light.png` | Mono horneado: wordmark claro + símbolo silver, relieve 3D intacto | Fondos azul / void profundo | `#1E80F0` o `#08080A` |
| `logo-strategy.png` `logo-intelligence.png` `logo-readiness.png` `logo-flow.png` `logo-systems.png` `logo-creative.png` | Wordmarks glossy de sub-marca (render con tamaños de glifo inconsistentes) | **Solo marketing.** En web los edges se construyen como lockups de TEXTO | — |

**Estructura bloqueada del logo** (no negociable): línea 1 `>_` (azul) + `final edge` (blanco glossy);
línea 2 `[ A I ]` (azul) alineada exactamente al ancho de la palabra "final" (master: "final" ≈ x377–778,
`[ A I ]` ≈ x377–771). Tres partes fijas: prompt, wordmark, tag. Nunca separar, re-espaciar, re-estilizar
ni mover. Nunca aplicar `filter` CSS al PNG para recolorear partes (los monocromos son PNGs pre-horneados
con rampa de silver idéntica en todas las variantes). Tamaño mínimo: digital ≥160px de ancho, impreso ≥28mm.
Por debajo de ~40px, usar lockup de texto: `>_` + nombre + `[AI]` compacto, ≥14px.

## 2 · Iconos de edge (`public/assets/edge-icons/`)

Line-art neón, fondo transparente, coloreado en el color de su fase (no blanco), ~66px.

| Archivo | Metáfora | Fase / color |
|---|---|---|
| `strategy.png` | brújula | Evaluación · ámbar `#F4920C` |
| `intelligence.png` | cabeza + red neuronal | Evaluación · ámbar `#F4920C` |
| `readiness.png` | batería | Capacidades · cian `#15D9D9` |
| `flow.png` | ondas de flujo | Capacidades · cian `#15D9D9` |
| `systems.png` | engranes | Ejecución · magenta `#E15CDB` |
| `creative.png` | paleta + pincel | Ejecución · magenta `#E15CDB` |

## 3 · Tipografía

| Registro | Familia | Pesos | Uso |
|---|---|---|---|
| `--font-ui` | **Geist Mono** (Google Fonts) | 400 / 500 / 600 / 700 | TODO: display, headings, hero, labels, datos, prompt. El mono ES la identidad |
| `--font-read` | Geist (sans) | 300–600 | SOLO párrafos largos y densos (reportes B2B). Nunca hero/labels/datos |

Nunca una tercera familia. Rechazadas explícitamente: Fredoka, Space Grotesk y cualquier fuente redondeada.
**Piso duro: 14px** en todo (tags, números de nav, etiquetas de la rueda, captions).

## 4 · Paleta (tokens exactos — ver `src/styles/tokens.css`)

| Token | Hex | Rol |
|---|---|---|
| `--bg` Void | `#0E0E12` | Fondo global (≈90% de la superficie) |
| `--panel` | `#0B0B0E` | Paneles |
| `--card` | `#0A0A0C` | Tarjetas |
| `--void-deep` | `#08080A` | Fondo del mono silver / punto de "Tu ventaja final." |
| `--hairline` | `#1A1A1E` | Bordes 1px y retículas |
| `--hairline-nav` | `#16161A` | Divisores de navegación |
| `--placeholder` | `#34343C` | Barras mock |
| `--fg` | `#F4F4F2` | Texto señal |
| `--fg-2` | `#C6C6CC` | Secundario / leads |
| `--fg-muted` | `#A0A0A8` | Atenuado |
| `--fg-faint` | `#7E7E88` | Tenue (4.79:1, AA) |
| `--accent` Edge Blue | `#1E80F0` | ÚNICO acento UI: prompt, números, links, UNA placa full-bleed (≈2%) |
| `--accent-active` | `#1668C2` | Estado :active |
| `--phase-eval` | `#F4920C` | Fase Evaluación (ámbar) |
| `--phase-cap` | `#15D9D9` | Fase Capacidades (cian) |
| `--phase-exe` | `#E15CDB` | Fase Ejecución (magenta, 6.20:1 AA) |
| Semánticos | `#FF5A5A` `#3DD68C` `#F5C24B` `#1E80F0` | error / éxito / aviso / info — nunca los colores de fase |

Proporción de superficie **90 / 8 / 2**: ~90% Void, ~8% señal/blanco, ~2% acento.

## 5 · Motivos y lockups fijos

- `>_` — prompt que abre eyebrows y labels (azul).
- `[AI]` — tag; idéntico en los seis edges.
- `final edge` — wordmark, **sin punto entre las palabras**.
- `[ENGINE]` — entre corchetes, Edge Blue, en el hub de la rueda; `ENGINE™` como nombre de producto/sección.
- Fórmula de lockup de edge: `LOCKUP = >_ + nombre + [AI]`.

## 6 · Sub-marcas: fases y edges

| Fase | Color | Edges (nombres exactos, minúsculas, sin sufijo `·edge`) | Servicio (subtítulo ES aprobado) |
|---|---|---|---|
| FASE 01 · Evaluación | ámbar | `strategy` / `intelligence` | Estrategia / Business Intelligence |
| FASE 02 · Capacidades | cian | `readiness` / `flow` | Team Readiness / Optimización de Procesos |
| FASE 03 · Ejecución | magenta | `systems` / `creative` | Sistemas / Producción Creativa |

## 7 · La rueda ENGINE™ (geometría canónica)

Espacio de referencia 720×720, centro (360,360): 6 sectores internos `Ri≈96` `Ro≈232`, 60° con 4° de
gap, relleno degradado radial de fase + trazo en color de fase; banda exterior de fase `famRi≈248`
`famRo≈278`, 3 arcos de 120° (5° gap) en color sólido; etiquetas de fase FUERA de la banda
(EVALUACIÓN arriba, CAPACIDADES abajo-derecha, EJECUCIÓN abajo-izquierda, radios ≈290/348/338);
lockups de edge a radio `RL≈168`, centros de sector: strategy 330°, intelligence 30°, readiness 90°,
flow 150°, systems 210°, creative 270° (0°=arriba, horario); hub `r≈84` con `>_ final edge` sobre
`[ENGINE]`. Etiquetas SIEMPRE ≥14px y como texto nítido (HTML/SVG), nunca rasterizadas dentro del canvas.

En este sitio la rueda se implementa en **WebGL (Three.js)** por decisión del cliente (2026-07-08,
inspiración igloo.inc), manteniendo la geometría, colores y etiquetas canónicas. Nunca reintroducir
renders raster antiguos de la rueda (llevaban nombres de edge obsoletos).

## 8 · Movimiento

Una sola curva maestra `cubic-bezier(0.2, 0.8, 0.2, 1)`. Hover 160ms · UI 280ms · entrada de sección
600ms. Parpadeo de cursor `1.2s steps(1)` infinito — la única animación de marca obligatoria.
Sin rebotes, sin springs, sin spinners.

## 9 · Verbal

Copy ES-MX, tuteo. Sin emoji. Sin signos de exclamación. Plataforma paraguas: **"La IA ejecuta.
La experiencia decide."** con "Haz más. Sin contratar más." como línea de activación. Vocabulario
prohibido y gobernanza de claims: ver `brand/RULES.md` §4.
