/**
 * Experimento 2026-07-12 (Evaluación, hero del hub): variante de fondo tipo
 * "retícula de puntos con parpadeo" — réplica del efecto del video de
 * referencia del cliente, en vez de la estática de glifos de phase-static.js.
 * Colores intactos: la tinta y el fondo son los MISMOS tokens que ya usa el
 * hub (--void-deep sobre el color de fase) — el pedido fue sustituir el
 * EFECTO, no la paleta.
 *
 * Lectura del video (frames extraídos y analizados uno por uno, con zoom a
 * la microestructura y diff entre frames): NO es ruido orgánico difuminado
 * como los glifos — es una retícula de puntos en posiciones FIJAS y
 * perfectamente regulares (los puntos nunca se mueven de su celda) cuyo
 * brillo titila independientemente por punto, como un cielo estrellado.
 * Una nube lenta de fondo modula qué región de la retícula titila más
 * fuerte (las mismas manchas oscuras orgánicas que en la estática de
 * glifos, aquí gobernando probabilidad de brillo en vez de densidad de
 * caracteres). Además, ocasionalmente cruzan destellos diagonales cortos
 * (rasguños/glitch), un acento secundario, breve e infrecuente.
 */

const CELL = 13;   // px CSS de espaciado entre puntos (retícula regular)
const FPS = 14;     // cadencia del parpadeo — discreta, no suavizada
const LEVELS = 12;  // niveles de brillo pre-rasterizados en el atlas
const DOT_R = 1.7;  // radio del punto a su brillo máximo

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

function initDotGrid(canvas) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const inkColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--void-deep').trim() || '#08080A';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cols, rows, atlas, cell, dpr;

  function buildAtlas() {
    cell = Math.ceil(CELL * dpr);
    atlas = document.createElement('canvas');
    atlas.width = cell;
    atlas.height = cell * LEVELS;
    const a = atlas.getContext('2d');
    for (let lv = 0; lv < LEVELS; lv++) {
      a.globalAlpha = lv / (LEVELS - 1);
      a.fillStyle = inkColor;
      a.beginPath();
      a.arc(cell / 2, lv * cell + cell / 2, DOT_R * dpr, 0, Math.PI * 2);
      a.fill();
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

  /* destellos diagonales cortos (acento secundario del video de
     referencia): un pool pequeño de segmentos que nacen, viven ~180-320ms
     y mueren — nunca más de unos pocos a la vez, para que sigan siendo
     un acento y no compitan con el parpadeo de la retícula. */
  const glitches = [];
  function spawnGlitch(t, w, h) {
    const len = 30 + h3(t * 1000, 1, 2) * 70;
    const ang = (h3(t * 1000, 3, 4) * 0.5 + 0.15) * Math.PI; // diagonal, nunca horizontal/vertical puro
    const x = h3(t * 1000, 5, 6) * w;
    const y = h3(t * 1000, 7, 8) * h;
    glitches.push({
      x, y, ang, len,
      born: t,
      life: 0.18 + h3(t * 1000, 9, 10) * 0.14,
    });
  }

  let frameSeed = 0;
  let nextGlitchAt = 0;
  function paint(t) {
    frameSeed++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const swell = 0.85 + 0.15 * Math.sin(t * 0.45);
    const s = 0.14;
    const driftX = t * 0.5;
    const driftY = t * 0.15;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = vnoise(x * s + driftX, y * s + driftY, t * 0.4);
        n = Math.pow(n, 1.4);
        const fl = h3(x, y, frameSeed); // titileo por punto
        const b = Math.min(1, n * (0.25 + 0.75 * fl) * swell * 1.55);
        if (b < 0.08) continue;
        const lv = Math.min(LEVELS - 1, Math.round(b * (LEVELS - 1)));
        ctx.drawImage(atlas, 0, lv * cell, cell, cell, Math.round(x * cell), Math.round(y * cell), cell, cell);
      }
    }

    // destellos: nacer/vivir/morir, dibujados sobre la retícula
    const w = canvas.width, h = canvas.height;
    if (t >= nextGlitchAt) {
      spawnGlitch(t, w, h);
      nextGlitchAt = t + 0.4 + h3(Math.floor(t * 1000), 11, 12) * 0.9;
    }
    ctx.strokeStyle = inkColor;
    ctx.lineCap = 'round';
    for (let i = glitches.length - 1; i >= 0; i--) {
      const g = glitches[i];
      const age = t - g.born;
      if (age > g.life) { glitches.splice(i, 1); continue; }
      const k = 1 - age / g.life; // se apaga hacia el final de su vida
      ctx.globalAlpha = k * 0.55;
      ctx.lineWidth = 1.4 * dpr;
      const dx = Math.cos(g.ang) * g.len * dpr;
      const dy = Math.sin(g.ang) * g.len * dpr;
      ctx.beginPath();
      ctx.moveTo(g.x - dx / 2, g.y - dy / 2);
      ctx.lineTo(g.x + dx / 2, g.y + dy / 2);
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
    initDotGrid(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
