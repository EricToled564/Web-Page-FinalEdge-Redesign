/**
 * Experimento 2026-07-12 (Evaluación, hero del hub): variante de fondo tipo
 * "retícula de puntos con parpadeo" — réplica del efecto del video de
 * referencia del cliente, en vez de la estática de glifos de phase-static.js.
 * Colores intactos: la tinta y el fondo son los MISMOS tokens que ya usa el
 * hub (--void-deep sobre el color de fase) — el pedido fue sustituir el
 * EFECTO, no la paleta.
 *
 * Lectura del video: retícula de puntos en posiciones FIJAS (nunca se
 * mueven de su celda) cuyo brillo titila independientemente por punto,
 * modulado por una nube lenta de fondo que gobierna qué región titila
 * más fuerte. Sobre eso, el cliente identificó por observación directa
 * del video (mi primer análisis cuadro-a-cuadro no lo confirmó con
 * certeza estadística, pero la percepción de forma por movimiento
 * coordinado —efecto de profundidad cinética— es real y mis medidas
 * sobre cuadros sueltos no están hechas para captarla) que se forman y
 * disuelven CUBOS en wireframe isométrico sobre la retícula: el
 * hexágono de silueta de un cubo + las 3 aristas internas que dividen
 * sus 3 caras visibles, apareciendo y desvaneciéndose en posiciones
 * aleatorias — reemplaza los destellos diagonales sueltos de la
 * versión anterior.
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

  /* Cubos en wireframe isométrico: hexágono de silueta (6 aristas) + 3
     aristas internas del centro a vértices alternos (cada 120°) — el
     glifo clásico de "cubo aplanado" que divide la silueta en sus 3
     caras visibles (arriba, izquierda, derecha). Un pool pequeño nace,
     se dibuja con fundido de entrada/salida y se disuelve — nunca más
     de 2 a la vez, para que sigan siendo un acento sobre la retícula y
     no la dominen. */
  const HEX_ANGLES = [-90, -30, 30, 90, 150, 210].map((d) => (d * Math.PI) / 180);
  const cubes = [];
  function spawnCube(t, w, h) {
    const r = (22 + h3(t * 1000, 21, 22) * 30) * dpr;
    cubes.push({
      x: h3(t * 1000, 23, 24) * w,
      y: h3(t * 1000, 25, 26) * h,
      r,
      born: t,
      life: 1.1 + h3(t * 1000, 27, 28) * 0.9,
    });
  }
  function drawCube(c, k) {
    const pts = HEX_ANGLES.map((a) => [c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]);
    ctx.globalAlpha = k * 0.6;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    // aristas internas: centro -> vértices alternos (0, 2, 4 = cada 120°)
    for (const i of [0, 2, 4]) {
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  }

  let frameSeed = 0;
  let nextCubeAt = 0;
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

    // cubos: nacen, se dibujan con fundido de entrada/salida y se disuelven
    const w = canvas.width, h = canvas.height;
    if (t >= nextCubeAt && cubes.length < 2) {
      spawnCube(t, w, h);
      nextCubeAt = t + 0.9 + h3(Math.floor(t * 1000), 11, 12) * 1.3;
    }
    ctx.strokeStyle = inkColor;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.3 * dpr;
    for (let i = cubes.length - 1; i >= 0; i--) {
      const c = cubes[i];
      const age = t - c.born;
      if (age > c.life) { cubes.splice(i, 1); continue; }
      const p = age / c.life;
      const k = Math.sin(Math.PI * p); // 0 al nacer -> 1 a la mitad -> 0 al disolverse
      drawCube(c, k);
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
