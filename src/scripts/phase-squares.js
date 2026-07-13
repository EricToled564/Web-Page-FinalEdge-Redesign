/**
 * Estática de CUADROS para los hubs de fase y las bandas Edge Blue del home
 * (pedido 2026-07-13: regresar al efecto original de estática — el de
 * phase-static.js, video de referencia del cliente 2026-07-11 — pero con
 * cuadros en lugar de letras, en un tono del color del fondo).
 *
 * Misma receta exacta que el efecto original aprobado: retícula densa cuyo
 * brillo lo gobiernan DOS señales — un campo de ruido orgánico que deriva
 * en diagonal (nubes y huecos que viajan) y un parpadeo aleatorio por celda
 * a ~12Hz (la "estática") — más un pulso global lento. Solo cambia el
 * pincel: fillRect en vez de glifos (ya ni atlas hace falta — un rect por
 * celda es más barato que rasterizar texto).
 *
 * TONO — MÁS OSCURO, no más claro (criterio pedido al asistente): los
 * fondos donde vive el efecto son claros (ámbar/cian/magenta de fase) o
 * azul Edge con texto blanco. Un tono más claro competiría con el texto
 * (menos contraste texto/fondo justo donde hay copy); el tono más oscuro
 * da el impacto visual del patrón y a la vez AUMENTA el contraste del
 * texto que tiene encima. Mismo criterio tono-sobre-tono ya aprobado para
 * la malla de puntos (2026-07-12). El color se deriva en runtime del
 * background computado del host — nunca un hex nuevo (R1.1).
 */

const CELL = 9;      // px CSS por celda (idéntico al efecto original)
const SQ = 6;        // lado del cuadro dentro de la celda (aire de retícula)
const FPS = 12;      // cadencia del original: estática discreta, no smooth
const LUZ = 0.55;    // factor de oscurecimiento del tono (ver nota de TONO)

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

/* tono más oscuro del fondo REAL del host: lee el backgroundColor computado
   (oklch o rgb, según resuelva el navegador) y escala su luz por LUZ.
   Derivado de un token vivo, no un color nuevo (R1.1). */
function darkerTone(host) {
  const bg = getComputedStyle(host).backgroundColor;
  let m = bg.match(/oklch\(([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/);
  if (m) {
    const l = parseFloat(m[1]) * (m[2] ? 0.01 : 1) * LUZ;
    return `oklch(${l} ${m[3]} ${m[4]})`;
  }
  m = bg.match(/rgba?\((\d+),?\s*(\d+),?\s*(\d+)/);
  if (m) {
    return `rgb(${Math.round(m[1] * LUZ)}, ${Math.round(m[2] * LUZ)}, ${Math.round(m[3] * LUZ)})`;
  }
  return getComputedStyle(document.documentElement).getPropertyValue('--void-deep').trim() || '#08080A';
}

function initSquares(canvas) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cols, rows, dpr, cell, sq, ink;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    cols = Math.ceil(r.width / CELL);
    rows = Math.ceil(r.height / CELL);
    cell = CELL * dpr;
    sq = SQ * dpr;
    ink = darkerTone(host);
  }

  let frameSeed = 0;
  function paint(t) {
    frameSeed++;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // el color lo pone la sección
    ctx.fillStyle = ink;
    const swell = 0.85 + 0.15 * Math.sin(t * 0.45);
    const s = 0.16;
    const driftX = t * 0.55;
    const driftY = t * 0.17;
    const off = (cell - sq) / 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = vnoise(x * s + driftX, y * s + driftY, t * 0.45);
        n = Math.pow(n, 1.5);
        const fl = h3(x, y, frameSeed);
        const b = Math.min(1, n * (0.2 + 0.8 * fl) * swell * 1.6);
        if (b < 0.06) continue;
        ctx.globalAlpha = b;
        ctx.fillRect(x * cell + off, y * cell + off, sq, sq);
      }
    }
    ctx.globalAlpha = 1;
  }

  resize();
  addEventListener('resize', resize);

  if (reduced) {
    paint(0);
    return;
  }

  let visible = true;
  /* última entrada del lote, no la primera (mismo bug que la rueda) */
  new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; }).observe(canvas);

  let last = 0;
  function loop(now) {
    if (!canvas.isConnected) return;
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (now - last < 1000 / FPS) return;
    last = now;
    paint(now / 1000);
  }
  requestAnimationFrame(loop);
}

function boot() {
  document.querySelectorAll('canvas[data-phase-squares]').forEach((c) => {
    if (c.dataset.squaresBooted) return;
    c.dataset.squaresBooted = '1';
    initSquares(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
