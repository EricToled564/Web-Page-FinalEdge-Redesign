/**
 * Experimento 2026-07-12 v2 (Evaluación, hero del hub): campo de guiones
 * orientados ("flow field") — réplica del segundo video de referencia del
 * cliente, que sustituye al experimento anterior de cubos punteados (el
 * propio cliente lo propuso como efecto más fácil de ejecutar bien).
 * Colores intactos: tinta y fondo son los MISMOS tokens del hub.
 *
 * Lectura del video (164 cuadros extraídos, perfil de brillo por cuadro y
 * cuadros individuales a 2x): retícula regular de trazos CORTOS (guiones)
 * donde cada trazo ROTA suavemente — su ángulo lo gobierna un campo de
 * ruido continuo en espacio y tiempo, así que los vecinos apuntan a
 * ángulos parecidos y el conjunto forma ondas/remolinos que fluyen por el
 * área. El brillo también varía por zonas (campo aparte), con caídas
 * profundas ocasionales donde regiones enteras se apagan casi del todo y
 * vuelven a encender (medido en el perfil: valles de brillo medio ~0.5
 * entre picos de ~27 cada 4-6s).
 *
 * Render: los guiones se dibujan por lotes de alfa (un solo stroke() por
 * nivel de brillo por cuadro, no uno por guion) — ~7,000 segmentos por
 * cuadro a 14fps sin despeinarse, sin atlas (rotar sprites pediría
 * 32+ orientaciones × niveles; línea directa es más simple y suficiente).
 */

const CELL = 14;    // px CSS de espaciado entre guiones
const FPS = 14;     // cadencia — el video fluye suave pero discreto
const DASH_LEN = 7; // largo del guion en px CSS
const ALPHA_STEPS = 8; // lotes de brillo por cuadro

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

function initFlowField(canvas) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const inkColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--void-deep').trim() || '#08080A';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cols, rows, dpr;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    cols = Math.ceil(r.width / CELL);
    rows = Math.ceil(r.height / CELL);
  }

  /* posterizar a N niveles: convierte el ruido suave en mesetas planas con
     saltos duros — la clave del carácter del video (revisión con el
     cliente): las zonas de brillo/apagado NO son manchas suaves, son
     BLOQUES con bordes rectos que tapan y destapan regiones enteras. */
  const posterize = (v, n) => Math.floor(v * n) / (n - 1);

  function paint(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1.4 * dpr;
    ctx.lineCap = 'round';

    /* FASES alternantes (segunda corrección: el video no es un solo
       comportamiento continuo — alterna escenas): una onda lenta decide
       cuánto pesa cada régimen. verticality 0 = ondas fluidas amplias;
       1 = guiones comprimidos hacia columnas verticales apretadas. */
    const scene = vnoise(0.7, 0.7, t * 0.07);
    const verticality = Math.min(1, Math.max(0, (scene - 0.45) * 3.2));

    const sAng = 0.045;
    const half = (DASH_LEN / 2) * dpr;

    const buckets = [];
    for (let i = 0; i < ALPHA_STEPS; i++) buckets.push([]);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        /* ángulo: campo fluido, arrastrado hacia la vertical según la fase */
        const flow = vnoise(x * sAng, y * sAng, t * 0.18) * Math.PI * 2;
        const jitter = (h3(x, y, 7) - 0.5) * 0.25;
        const ang = flow * (1 - verticality) + (Math.PI / 2 + jitter) * verticality;

        /* brillo: DOS capas de bloques rectangulares posterizados con
           bordes duros (no ruido suave) —
           capa 1: bloques chicos (8×4 celdas) que parpadean por zonas
           capa 2: franjas grandes que apagan regiones completas de golpe
                   (los "apagones" medidos en el perfil de brillo del video) */
        const b1 = posterize(vnoise(Math.floor(x / 8) * 1.7, Math.floor(y / 4) * 1.7, t * 0.32), 4);
        const b2 = posterize(vnoise(Math.floor(x / 26) * 1.3 + 60, Math.floor(y / 9) * 1.3 + 60, t * 0.2), 3);
        const b = b1 * (0.25 + 0.75 * b2);
        if (b < 0.1) continue;
        const lv = Math.min(ALPHA_STEPS - 1, Math.floor(b * ALPHA_STEPS));
        const cx = (x + 0.5) * CELL * dpr;
        const cy = (y + 0.5) * CELL * dpr;
        const dx = Math.cos(ang) * half;
        const dy = Math.sin(ang) * half;
        buckets[lv].push(cx - dx, cy - dy, cx + dx, cy + dy);
      }
    }
    for (let lv = 0; lv < ALPHA_STEPS; lv++) {
      const seg = buckets[lv];
      if (!seg.length) continue;
      ctx.globalAlpha = ((lv + 1) / ALPHA_STEPS) * 0.85;
      ctx.beginPath();
      for (let i = 0; i < seg.length; i += 4) {
        ctx.moveTo(seg[i], seg[i + 1]);
        ctx.lineTo(seg[i + 2], seg[i + 3]);
      }
      ctx.stroke();
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
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(canvas);

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
  document.querySelectorAll('canvas[data-phase-dotgrid]').forEach((c) => {
    if (c.dataset.dotgridBooted) return;
    c.dataset.dotgridBooted = '1';
    initFlowField(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
