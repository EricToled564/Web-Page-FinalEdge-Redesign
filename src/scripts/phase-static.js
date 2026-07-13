/**
 * Estática de glifos para el landing de los hubs de fase (muestra: Evaluación).
 * Réplica del efecto de referencia (video del cliente, 2026-07-11): retícula
 * densa de caracteres monoespaciados cuyo brillo lo gobiernan DOS señales
 * superpuestas — un campo de ruido orgánico que deriva lento (nubes y huecos
 * que se mueven) y un parpadeo aleatorio por celda a ~12Hz (la "estática") —
 * más un pulso global lento. En el original los glifos son claros sobre
 * fondo oscuro; aquí la traducción de marca es glifos --void-deep sobre el
 * color de la fase (el fondo lo pinta la sección, el canvas es transparente).
 *
 * Por qué Canvas 2D y no WebGL ni DOM: a ~9px de celda un viewport de
 * escritorio son >15,000 celdas — imposible como DOM; y un segundo contexto
 * WebGL junto a la rueda ENGINE es costo sin beneficio cuando un atlas de
 * glifos pre-rasterizado (drawImage, nunca fillText por celda) pinta el
 * cuadro completo de sobra dentro del presupuesto de 12fps del efecto.
 * Los glifos son textura decorativa (canvas aria-hidden), no texto legible —
 * el piso tipográfico de 14px (R2.1) aplica a contenido, no a esta gráfica.
 */

const CELL = 9;    // px CSS por celda
const FPS = 12;    // cadencia del original: estática discreta, no smooth
const CHARS = 'abcdefghijkmnopqrstuvwxyz0123456789[]{}()<>+-=_:;.#$%&*';
const LEVELS = 14; // niveles de alfa pre-rasterizados en el atlas

/* hash determinista entero→[0,1) — la misma celda con la misma semilla
   siempre da el mismo valor (sin Math.random: el efecto es reproducible) */
function hash(x) {
  x = (x ^ 61) ^ (x >>> 16);
  x = (x + (x << 3)) | 0;
  x ^= x >>> 4;
  x = (x * 0x27d4eb2d) | 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967295;
}
const h3 = (a, b, c) => hash((a * 73856093) ^ (b * 19349663) ^ (c * 83492791));
const fade = (t) => t * t * (3 - 2 * t);

/* value noise 3D (x, y, tiempo) — las "nubes" orgánicas del efecto */
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const c = (dx, dy, dz) => h3(xi + dx, yi + dy, zi + dz);
  const l1 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u;
  const l2 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const l3 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u;
  const l4 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  return (l1 + (l2 - l1) * v) * (1 - w) + (l3 + (l4 - l3) * v) * w;
}

function initStatic(canvas) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  /* color de glifo desde el token computado — nunca un hex nuevo aquí (R1.1) */
  const glyphColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--void-deep').trim() || '#08080A';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cols, rows, atlas, aw, ah, dpr;

  function buildAtlas() {
    aw = Math.ceil(CELL * dpr);
    ah = aw;
    atlas = document.createElement('canvas');
    atlas.width = aw * CHARS.length;
    atlas.height = ah * LEVELS;
    const a = atlas.getContext('2d');
    a.font = `${Math.round(8 * dpr)}px "Geist Mono", ui-monospace, monospace`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    for (let lv = 0; lv < LEVELS; lv++) {
      a.globalAlpha = lv / (LEVELS - 1);
      a.fillStyle = glyphColor;
      for (let i = 0; i < CHARS.length; i++) {
        a.fillText(CHARS[i], i * aw + aw / 2, lv * ah + ah / 2 + dpr * 0.5);
      }
    }
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    cols = Math.ceil(r.width / CELL);
    rows = Math.ceil(r.height / CELL);
    buildAtlas();
  }

  let frameSeed = 0;
  function paint(t) {
    frameSeed++;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // el ámbar lo pone la sección
    const swell = 0.85 + 0.15 * Math.sin(t * 0.45); // pulso global lento
    const s = 0.16; // escala espacial de las nubes
    /* deriva direccional (pedido explícito: el efecto se sentía estático):
       las nubes ya no solo mutan en su lugar (la coordenada z del ruido) —
       el campo entero se TRASLADA en diagonal por el área, ~3.5 celdas/s
       en x y ~1 en y, lo bastante para percibir el viaje sin volverse
       mareador. La estática por celda (h3 con frameSeed) no se mueve con
       él: el grano parpadea quieto mientras las nubes pasan por encima —
       igual que el video de referencia. */
    const driftX = t * 0.55;
    const driftY = t * 0.17;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = vnoise(x * s + driftX, y * s + driftY, t * 0.45);
        n = Math.pow(n, 1.5); // abre huecos oscuros grandes, como el original
        const fl = h3(x, y, frameSeed); // estática por celda
        const b = Math.min(1, n * (0.2 + 0.8 * fl) * swell * 1.6);
        if (b < 0.06) continue; // celda apagada: ni se dibuja
        const lv = Math.min(LEVELS - 1, Math.round(b * (LEVELS - 1)));
        const gi = Math.floor(h3(x, y, frameSeed >> 1) * CHARS.length);
        ctx.drawImage(atlas, gi * aw, lv * ah, aw, ah, x * aw, y * ah, aw, ah);
      }
    }
  }

  resize();
  addEventListener('resize', resize);

  if (reduced) {
    paint(0); // un solo cuadro fijo — textura sin movimiento
    return;
  }

  /* pausa real fuera de pantalla: cero trabajo si el hero no se ve */
  let visible = true;
  /* última entrada del lote, no la primera (mismo bug que la rueda) */
  new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; }).observe(canvas);

  let last = 0;
  function loop(now) {
    if (!canvas.isConnected) return; // la página navegó: el bucle muere solo
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (now - last < 1000 / FPS) return;
    last = now;
    paint(now / 1000);
  }
  requestAnimationFrame(loop);
}

function boot() {
  document.querySelectorAll('canvas[data-phase-static]').forEach((c) => {
    if (c.dataset.staticBooted) return;
    c.dataset.staticBooted = '1';
    initStatic(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
