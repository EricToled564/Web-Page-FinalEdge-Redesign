/**
 * Experimento 2026-07-12 (Evaluación, hero del hub): variante de fondo tipo
 * "retícula de puntos con parpadeo" — réplica del efecto del video de
 * referencia del cliente, en vez de la estática de glifos de phase-static.js.
 * Colores intactos: la tinta y el fondo son los MISMOS tokens que ya usa el
 * hub (--void-deep sobre el color de fase) — el pedido fue sustituir el
 * EFECTO, no la paleta.
 *
 * Lectura del video (corregida dos veces por el cliente hasta esta
 * versión): retícula de puntos en posiciones FIJAS cuyo brillo titila
 * por punto, modulado por una nube lenta. Y sobre eso, CUBOS 3D en
 * wireframe formados POR LOS PROPIOS PUNTOS de la retícula — no
 * ilustraciones de línea dibujadas encima: las aristas del cubo
 * "encienden" a brillo máximo los puntos que atraviesan, y el cubo
 * VIAJA por el campo y ROTA mientras avanza, cada uno en su propia
 * dirección (estilo pantalla de LEDs). Consistente con la evidencia
 * medida: puntos fijos + trayectorias diagonales continuas viajando en
 * los cortes espacio-tiempo (el patrón de brillo se mueve, los puntos
 * no).
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

  /* Cubos formados POR los puntos de la retícula (corrección del
     cliente: no son ilustraciones de línea encima — los propios puntos
     del fondo se iluminan trazando las aristas de cubos 3D que VIAJAN
     por el campo y ROTAN mientras avanzan, cada uno en su dirección,
     estilo pantalla de LEDs).
     Render: las 12 aristas del cubo (rotado en X/Y, proyección
     ortográfica) se muestrean y cada muestra "enciende" la celda de la
     retícula más cercana — el cubo se dibuja EXCLUSIVAMENTE con los
     puntos existentes, ninguna línea. Entra y sale con fundido. */
  const CUBE_EDGES = [
    [0,1],[1,3],[3,2],[2,0], // cara trasera
    [4,5],[5,7],[7,6],[6,4], // cara delantera
    [0,4],[1,5],[2,6],[3,7], // aristas que las unen
  ];
  const cubes = [];
  function spawnCube(t, wCss, hCss) {
    const seed = Math.floor(t * 997);
    const ang = h3(seed, 31, 32) * Math.PI * 2;
    cubes.push({
      x: h3(seed, 23, 24) * wCss,
      y: h3(seed, 25, 26) * hCss,
      size: 40 + h3(seed, 21, 22) * 44,     // media-arista en px CSS
      vx: Math.cos(ang) * (16 + h3(seed, 33, 34) * 20), // px CSS/s — cada cubo su dirección
      vy: Math.sin(ang) * (16 + h3(seed, 35, 36) * 20),
      rx: h3(seed, 37, 38) * Math.PI,
      ry: h3(seed, 39, 40) * Math.PI,
      wrx: 0.25 + h3(seed, 41, 42) * 0.35,  // rad/s
      wry: 0.2 + h3(seed, 43, 44) * 0.3,
      born: t,
      life: 6 + h3(seed, 27, 28) * 4,       // viven varios segundos: se les ve viajar
    });
  }
  /* marca en `out` (Map celda->intensidad 0..1) las celdas que este cubo
     enciende en el instante t */
  function litCellsFor(c, t, out) {
    const age = t - c.born;
    const p = age / c.life;
    const k = Math.min(1, Math.sin(Math.PI * p) * 1.6); // fundido entrada/salida
    if (k <= 0.02) return;
    const cx = c.x + c.vx * age;
    const cy = c.y + c.vy * age;
    const rx = c.rx + c.wrx * age;
    const ry = c.ry + c.wry * age;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const vs = [];
    for (let i = 0; i < 8; i++) {
      const x = (i & 1) ? 1 : -1;
      const y = (i & 2) ? 1 : -1;
      const z = (i & 4) ? 1 : -1;
      const y2 = y * cosX - z * sinX;
      const z2 = y * sinX + z * cosX;
      const x2 = x * cosY + z2 * sinY;
      vs.push([cx + x2 * c.size, cy + y2 * c.size]);
    }
    for (const [a, b] of CUBE_EDGES) {
      const [x1, y1] = vs[a], [x2, y2] = vs[b];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(2, Math.ceil(len / (CELL * 0.45)));
      for (let i = 0; i <= steps; i++) {
        const px = x1 + ((x2 - x1) * i) / steps;
        const py = y1 + ((y2 - y1) * i) / steps;
        const gx = Math.round(px / CELL);
        const gy = Math.round(py / CELL);
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        const key = gy * cols + gx;
        if ((out.get(key) ?? 0) < k) out.set(key, k);
      }
    }
  }

  let frameSeed = 0;
  let nextCubeAt = 0;
  function paint(t) {
    frameSeed++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* administrar el pool de cubos y calcular qué celdas encienden — ANTES
       del bucle de puntos: el cubo se pinta CON los puntos, no encima */
    const wCss = canvas.width / dpr, hCss = canvas.height / dpr;
    if (t >= nextCubeAt && cubes.length < 3) {
      spawnCube(t, wCss, hCss);
      nextCubeAt = t + 1.2 + h3(Math.floor(t * 1000), 11, 12) * 1.6;
    }
    const lit = new Map();
    for (let i = cubes.length - 1; i >= 0; i--) {
      const c = cubes[i];
      if (t - c.born > c.life) { cubes.splice(i, 1); continue; }
      litCellsFor(c, t, lit);
    }

    const swell = 0.85 + 0.15 * Math.sin(t * 0.45);
    const s = 0.14;
    const driftX = t * 0.5;
    const driftY = t * 0.15;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = vnoise(x * s + driftX, y * s + driftY, t * 0.4);
        n = Math.pow(n, 1.4);
        const fl = h3(x, y, frameSeed); // titileo por punto
        let b = Math.min(1, n * (0.25 + 0.75 * fl) * swell * 1.55);
        /* si una arista de cubo pasa por esta celda, el punto sube hacia
           brillo pleno (mezclado con el fundido del cubo) — así la forma
           emerge de la retícula y viaja con el cubo */
        const cubeK = lit.get(y * cols + x);
        if (cubeK) b = Math.max(b, cubeK);
        if (b < 0.08) continue;
        const lv = Math.min(LEVELS - 1, Math.round(b * (LEVELS - 1)));
        ctx.drawImage(atlas, 0, lv * cell, cell, cell, Math.round(x * cell), Math.round(y * cell), cell, cell);
      }
    }
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
