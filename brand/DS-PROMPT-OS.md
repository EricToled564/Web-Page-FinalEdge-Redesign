# Sistema de diseño «>_ OS» — página principal v2 (paralela)

Fecha: 2026-07-26 · Estado: exploración aprobada por el cliente («crea uno
paralelo, no borres el sitio actual») · Ruta: `/v2/` (`src/pages/v2/index.astro`)

## Tesis

El símbolo `>_` deja de ser un logotipo que se coloca y pasa a ser el motor
narrativo de la página: la página se comporta como una sesión de terminal
viva. Cada sección «se ejecuta» como un comando (`>_ 01 · la presión`,
`>_ run valoración`), el texto del hero se teclea, y una línea de estado fija
tipo consola reporta en qué punto de la sesión está el usuario
(`~/final-edge/02-el-sistema`). La página ES una demostración del expertise:
un sistema que responde, no un folleto.

## Referencias y qué se tomó de cada una

| Referencia | Préstamo concreto |
|---|---|
| Terminal Industries (Rejouice) | Arco problema → sistema → prueba; precisión industrial; lista de casos reales como cierre de credibilidad; performance como valor de diseño. |
| Lazarev.agency | Secciones storyboard con scroll; índice fijo a la izquierda + dossier que se desplaza a la derecha (sección servicios); cada bloque orientado a conversión. |
| Subduxion | Estética mínima ingenieril: retículas hairline, mono, restraint. La referencia más cercana al ADN `>_`. |
| TRIONN | Sofisticación por movimiento (microinteracciones, profundidad por apilado sticky), no por decoración. Paleta reducida. |
| Microsoft AI | El contrapeso humano: el manifiesto «La IA ejecuta. La experiencia decide.» encendido palabra por palabra; calidez en el cierre. |

## Fundamentos (heredados, NO se tocan)

- Tokens: `src/styles/tokens.css` es la única fuente (R1.1). Cero hex nuevos.
- Sin border-radius (R3.1), sin sombras (R3.2), retículas hairline (R3.3),
  una sola curva de easing `cubic-bezier(0.2, 0.8, 0.2, 1)` (R3.4),
  piso tipográfico 14px (R2.1), copy con vocabulario gobernado (R4.x).
- Lockups solo vía `LockupMark` (R5.8).

## Gramática del sistema

1. **El prompt como marcador universal.** Todo encabezado de sección inicia
   con `>_` + índice de dos dígitos. El usuario aprende que `>_` = «aquí
   empieza una instrucción».
2. **Teclear = pensar.** Lo único que se anima con «typing» son instrucciones
   (eyebrow del hero, comando del CTA). El contenido nunca se teclea: aparece
   con reveals — la máquina teclea, el resultado simplemente está.
3. **La retícula es visible.** Fondo de líneas hairline (1px `--hairline`)
   en secciones de datos: el layout confiesa su estructura (Subduxion).
4. **Un solo acento.** `--accent` para foco/interacción; los colores de fase
   solo como marcadores pequeños en el sistema/servicios (R1.3).
5. **Línea de estado.** Elemento fijo inferior-izquierdo (desktop) con la
   ruta de la sesión: `~/final-edge/<sección>`. Scrollspy la actualiza.
6. **Movimiento con presupuesto.** Solo transform/opacity vía rAF u
   observers; `prefers-reduced-motion` desactiva typing, contadores y
   apilados. Cero librerías nuevas: la página más ligera del sitio.

## Arco narrativo (contenido 100% existente, verbatim)

| # | Sección | Contenido (fuente) |
|---|---|---|
| boot | Hero | `>_ tu ventaja definitiva▌` (typing) · H1 «30 años de experiencia dirigen. Nuestros flujos de trabajo propietarios de IA ejecutan.» · «haz más. sin contratar más.» · ticker de 7 servicios (MENU_ITEMS) |
| — | Manifiesto | «La IA ejecuta. La experiencia decide.» (título del sitio) encendido palabra por palabra |
| 01 | la presión | Las 3 cifras existentes: 48→40 horas · +26.6% salario mínimo · +52% costo laboral (contadores animados) |
| 02 | el sistema | Las 3 fases de `engine.js`: num, nombre, tagline, lead, statement — tarjetas apiladas sticky con marcador en color de fase |
| 03 | servicios | Los 6 edges de `engine.js`: lockup con punto, hook, summary, stats (3), quote, closing + enlace a su landing — índice fijo izquierda |
| 04 | casos reales | Los 12 registros de `proof` de los 6 edges (título + descriptor) |
| run | valoración | Comando tecleado + CTA existente «Agenda tu reunión de valoración» → `/#valoracion` |
| — | Cierre | `ClosingBand` + `Assistant` (heredados de Base) |

## Componentes nuevos

- `.os-status` línea de estado fija (solo ≥861px)
- `.os-head` encabezado de sección `>_ NN · nombre` + hairline
- `.os-grid` retícula hairline (gap 1px sobre `--hairline`)
- `.os-counter` contador rAF con la curva de marca
- `.os-stack` apilado sticky de fases
- `.os-dossier` índice fijo + bloques de servicio con scrollspy
- `.os-type` motor de typing (data-attrs, reduced-motion safe)
