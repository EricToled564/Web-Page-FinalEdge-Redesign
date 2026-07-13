/**
 * Fondo animado "Blue Edge" — código de referencia entregado por el
 * cliente (zip 2026-07-13, blue_edge_background). PORTADO FIEL: mismo
 * campo (ruido fractal 4 octavas + dos ondas senoidales + onda radial
 * viajera), misma retícula de glifos 'a' de 10px, mismos 24fps, mismo
 * tope de dpr 1.5, mismo shimmer y vaivén por celda. Los ÚNICOS cambios
 * (los que pidió el cliente):
 *  - Colores: derivados en runtime de la paleta de marca (el --pc de la
 *    fase en los hubs, --accent Edge Blue en las bandas del home) — la
 *    base oscura y la escalera oscuro→medio→brillante se calculan del
 *    token, nunca un hex nuevo (R1.1).
 *  - Integración a nuestro ciclo de vida: múltiples canvas por atributo
 *    data-blue-edge, re-boot en astro:page-load, pausa real fuera de
 *    pantalla (IntersectionObserver, última entrada del lote) y muerte
 *    del bucle cuando la página navega (canvas.isConnected).
 * El texto encima va en blanco (pedido explícito) — la base oscura del
 * efecto le da contraste pleno.
 */

const CONFIG = {
  glyph: 'a',
  gridSize: 10,
  maxDpr: 1.5,
  fps: 24,
  speed: 0.48,
  threshold: 0.49,
  fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

function initBlueEdge(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return;
  const host = canvas.parentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let width = 0, height = 0, dpr = 1, cols = 0, rows = 0, lastFrame = 0;
  const seed = 9301;
  const palette = [];
  let baseColor = '#000';

  /* color ancla desde el token vivo del host (--pc en hubs, --accent en
     bandas): el truco fillStyle normaliza CUALQUIER sintaxis CSS de
     color (hex, rgb, oklch) a un hex canónico legible. */
  function anchorRgb() {
    const raw = (getComputedStyle(host).getPropertyValue('--pc')
      || getComputedStyle(document.documentElement).getPropertyValue('--accent')).trim();
    ctx.fillStyle = '#000';
    ctx.fillStyle = raw || '#1673FF';
    const hex = ctx.fillStyle;
    const v = Number.parseInt(hex.slice(1), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }

  const mixToward = (c, target, t) => ({
    r: c.r + (target - c.r) * t,
    g: c.g + (target - c.g) * t,
    b: c.b + (target - c.b) * t,
  });
  const css = (c) => `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)})`;
  const mixColor = (a, b, amount) => {
    const t = Math.max(0, Math.min(1, amount));
    return css({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
  };

  function rebuildPalette() {
    const anchor = anchorRgb();
    /* misma estructura de 3 anclas del original (dark → middle → bright),
       derivadas del token de marca en vez de los hexes del demo */
    const dark = mixToward(anchor, 0, 0.72);
    const middle = anchor;
    const bright = mixToward(anchor, 255, 0.5);
    baseColor = css(mixToward(anchor, 0, 0.84));
    palette.length = 0;
    for (let i = 0; i < 32; i += 1) {
      const t = i / 31;
      palette.push(t < 0.62
        ? mixColor(dark, middle, t / 0.62)
        : mixColor(middle, bright, (t - 0.62) / 0.38));
    }
  }

  function pseudoRandom(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 0.013) * 43758.5453123;
    return value - Math.floor(value);
  }

  function smoothNoise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const n00 = pseudoRandom(x0, y0), n10 = pseudoRandom(x0 + 1, y0);
    const n01 = pseudoRandom(x0, y0 + 1), n11 = pseudoRandom(x0 + 1, y0 + 1);
    const nx0 = n00 + (n10 - n00) * sx, nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  function fractalNoise(x, y) {
    let total = 0, amplitude = 0.58, frequency = 1, normalization = 0;
    for (let octave = 0; octave < 4; octave += 1) {
      total += smoothNoise(x * frequency, y * frequency) * amplitude;
      normalization += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return total / normalization;
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(devicePixelRatio || 1, CONFIG.maxDpr);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CONFIG.gridSize) + 2;
    rows = Math.ceil(height / CONFIG.gridSize) + 2;
    const fontSize = Math.max(6, CONFIG.gridSize * 0.82);
    ctx.font = `700 ${fontSize}px ${CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    rebuildPalette();
    paint(lastTime); // sin fotograma en blanco tras un resize
  }

  function fieldAt(column, row, time) {
    const x = column / Math.max(1, cols);
    const y = row / Math.max(1, rows);
    const driftX = time * 0.021;
    const driftY = time * 0.014;
    const noise = fractalNoise(x * 5.3 + driftX, y * 5.3 - driftY);
    const waveA = Math.sin(x * 20.0 + Math.sin(y * 9.0 + time * 0.54) * 2.5 + time * 0.62);
    const waveB = Math.sin(y * 24.0 - Math.cos(x * 8.0 - time * 0.36) * 2.1 - time * 0.43);
    const centerX = 0.50 + Math.sin(time * 0.18) * 0.17;
    const centerY = 0.48 + Math.cos(time * 0.14) * 0.14;
    const dx = (x - centerX) * 1.2;
    const dy = y - centerY;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const radial = Math.sin(radius * 34.0 - time * 1.08);
    const value = noise * 0.60 + (waveA + 1) * 0.105 + (waveB + 1) * 0.075 + (radial + 1) * 0.055;
    return Math.max(0, Math.min(1, value));
  }

  let lastTime = 7.5;
  function paint(time) {
    lastTime = time;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, width, height);
    const spacing = CONFIG.gridSize;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const value = fieldAt(column, row, time);
        if (value < CONFIG.threshold) continue;
        const normalized = (value - CONFIG.threshold) / (1 - CONFIG.threshold);
        const paletteIndex = Math.min(palette.length - 1, Math.floor(normalized * palette.length));
        const shimmer = pseudoRandom(column + Math.floor(time * 3), row) * 0.15;
        const alpha = Math.min(1, 0.23 + normalized * 0.84 + shimmer);
        const x = -spacing + column * spacing + Math.sin(row * 0.18 + time * 0.9) * 1.4;
        const y = -spacing + row * spacing + Math.cos(column * 0.15 - time * 0.75) * 1.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = palette[paletteIndex];
        ctx.fillText(CONFIG.glyph, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  resize();
  addEventListener('resize', resize);

  if (reducedMotion.matches) {
    paint(7.5); // un solo cuadro fijo, como el original
    return;
  }

  let visible = true;
  /* última entrada del lote, no la primera (mismo bug que la rueda) */
  new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; }).observe(canvas);

  function loop(now) {
    if (!canvas.isConnected) return; // la página navegó: el bucle muere solo
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (now - lastFrame < 1000 / CONFIG.fps) return;
    lastFrame = now;
    paint(now * 0.001 * CONFIG.speed);
  }
  requestAnimationFrame(loop);
}

function boot() {
  document.querySelectorAll('canvas[data-blue-edge]').forEach((c) => {
    if (c.dataset.blueEdgeBooted) return;
    c.dataset.blueEdgeBooted = '1';
    initBlueEdge(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
