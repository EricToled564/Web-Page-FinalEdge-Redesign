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
 *
 * Rendimiento (2026-07-13): la matemática del campo es LA MISMA del
 * original (verificado bit a bit contra el zip, error máximo 0.0), pero
 * reorganizada para no recalcular lo que no cambia dentro de un cuadro:
 * el ruido se evalúa sobre una retícula entera pequeña (~3k puntos por
 * cuadro) en vez de 16 senos por celda (~340k), los términos que solo
 * dependen de la fila o de la columna se calculan una vez por fila /
 * columna, y los glifos se dibujan agrupados por color de paleta (32
 * cambios de fillStyle por cuadro en vez de uno por glifo; los glifos
 * no se solapan — retícula de 10px, vaivén ±1.4px — así que el orden no
 * altera un solo píxel; también verificado: diff de píxeles = 0).
 * Motivo: en el demo del zip el efecto es lo ÚNICO que corre en la
 * página; aquí convive con la rueda 3D en el mismo rAF, y cada ms de
 * pintada se descuenta del presupuesto de cuadro de TODA la página. Con
 * la pintada al doble de costo el efecto bajaba de ~20 pintadas/s a
 * menos de la mitad en cuanto la página tenía carga real — eso es lo
 * que se percibía como "casi no se mueve".
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
  let baseColor = 'black'; // se recalcula del token en rebuildPalette()

  /* color ancla desde el token vivo del host (--pc en hubs, --accent en
     bandas): el truco fillStyle normaliza CUALQUIER sintaxis CSS de
     color (hex, rgb, oklch) a un hex canónico legible. */
  function anchorRgb() {
    const raw = (getComputedStyle(host).getPropertyValue('--pc')
      || getComputedStyle(document.documentElement).getPropertyValue('--accent')).trim();
    /* sin hex de respaldo (R1.1): los tokens siempre existen; si raw
       fuera inválido, fillStyle conserva su valor anterior (negro
       inicial del contexto) — jamás un color inventado aquí. */
    ctx.fillStyle = raw;
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

  /* ruido fractal del original, con la retícula entera de pseudoRandom
     precomputada por cuadro: las 4 octavas solo consultan pseudoRandom
     en puntos enteros de un rango pequeño (≈ 5.3·frecuencia + 2 por
     eje), así que se evalúa UNA vez cada punto y las celdas interpolan
     sobre el arreglo. Mismas frecuencias y amplitudes acumuladas en el
     mismo orden que el bucle original (amplitude·=0.5, frequency·=2.03)
     — los dobles resultantes son idénticos, no aproximados. */
  const FREQS = [1, 2.03, 2.03 * 2.03, 2.03 * 2.03 * 2.03];
  const AMPS = [0.58, 0.58 * 0.5, 0.58 * 0.5 * 0.5, 0.58 * 0.5 * 0.5 * 0.5];
  const NORM = AMPS[0] + AMPS[1] + AMPS[2] + AMPS[3];
  const lattice = FREQS.map(() => ({ x0: 0, y0: 0, w: 0, h: 0, v: new Float64Array(0) }));

  function buildLattice(time) {
    const bx = time * 0.021, by = -time * 0.014;
    for (let o = 0; o < 4; o += 1) {
      const f = FREQS[o];
      const xmin = Math.floor(Math.min(bx, 5.3 + bx) * f);
      const xmax = Math.floor(Math.max(bx, 5.3 + bx) * f) + 1;
      const ymin = Math.floor(Math.min(by, 5.3 + by) * f);
      const ymax = Math.floor(Math.max(by, 5.3 + by) * f) + 1;
      const w = xmax - xmin + 1, h = ymax - ymin + 1;
      const L = lattice[o];
      if (L.v.length < w * h) L.v = new Float64Array(w * h);
      L.x0 = xmin; L.y0 = ymin; L.w = w; L.h = h;
      for (let yi = 0; yi < h; yi += 1) {
        for (let xi = 0; xi < w; xi += 1) L.v[yi * w + xi] = pseudoRandom(xmin + xi, ymin + yi);
      }
    }
  }

  /* smoothNoise del original leyendo la retícula precomputada */
  function smoothNoiseAt(L, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const i = (y0 - L.y0) * L.w + (x0 - L.x0);
    const n00 = L.v[i], n10 = L.v[i + 1];
    const n01 = L.v[i + L.w], n11 = L.v[i + L.w + 1];
    const nx0 = n00 + (n10 - n00) * sx, nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
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

  /* el campo del original celda a celda, con los términos que solo
     dependen de la fila o de la columna calculados una vez por fila /
     columna (mismas expresiones, mismos dobles) y los glifos agrupados
     por color de paleta para dibujar con 32 fillStyle por cuadro. Las
     cubetas se reutilizan entre cuadros (sin basura por cuadro). */
  const buckets = [];
  let rowSinA = new Float64Array(0), rowSwayX = new Float64Array(0), rowDy = new Float64Array(0);
  let colCosB = new Float64Array(0), colSwayY = new Float64Array(0), colX = new Float64Array(0);

  let lastTime = 7.5;
  function paint(time) {
    lastTime = time;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, width, height);
    const spacing = CONFIG.gridSize;
    const nCols = Math.max(1, cols), nRows = Math.max(1, rows);

    buildLattice(time);
    while (buckets.length < palette.length) buckets.push([]);
    for (const b of buckets) b.length = 0;
    if (rowSinA.length < rows) {
      rowSinA = new Float64Array(rows); rowSwayX = new Float64Array(rows); rowDy = new Float64Array(rows);
    }
    if (colCosB.length < cols) {
      colCosB = new Float64Array(cols); colSwayY = new Float64Array(cols); colX = new Float64Array(cols);
    }

    const centerX = 0.50 + Math.sin(time * 0.18) * 0.17;
    const centerY = 0.48 + Math.cos(time * 0.14) * 0.14;
    const driftX = time * 0.021;
    const driftY = time * 0.014;
    const shimmerK = Math.floor(time * 3);

    for (let row = 0; row < rows; row += 1) {
      const y = row / nRows;
      rowSinA[row] = Math.sin(y * 9.0 + time * 0.54) * 2.5;
      rowSwayX[row] = Math.sin(row * 0.18 + time * 0.9) * 1.4;
      rowDy[row] = y - centerY;
    }
    for (let column = 0; column < cols; column += 1) {
      const x = column / nCols;
      colX[column] = x;
      colCosB[column] = Math.cos(x * 8.0 - time * 0.36) * 2.1;
      colSwayY[column] = Math.cos(column * 0.15 - time * 0.75) * 1.3;
    }

    for (let row = 0; row < rows; row += 1) {
      const y = row / nRows;
      const noiseY = y * 5.3 - driftY;
      const dy = rowDy[row];
      const sinA = rowSinA[row];
      const swayX = rowSwayX[row];
      for (let column = 0; column < cols; column += 1) {
        const x = colX[column];
        const noiseX = x * 5.3 + driftX;
        let noise = 0;
        for (let o = 0; o < 4; o += 1) {
          noise += smoothNoiseAt(lattice[o], noiseX * FREQS[o], noiseY * FREQS[o]) * AMPS[o];
        }
        noise /= NORM;
        const waveA = Math.sin(x * 20.0 + sinA + time * 0.62);
        const waveB = Math.sin(y * 24.0 - colCosB[column] - time * 0.43);
        const dx = (x - centerX) * 1.2;
        const radial = Math.sin(Math.sqrt(dx * dx + dy * dy) * 34.0 - time * 1.08);
        const value = Math.max(0, Math.min(1,
          noise * 0.60 + (waveA + 1) * 0.105 + (waveB + 1) * 0.075 + (radial + 1) * 0.055));
        if (value < CONFIG.threshold) continue;
        const normalized = (value - CONFIG.threshold) / (1 - CONFIG.threshold);
        const paletteIndex = Math.min(palette.length - 1, Math.floor(normalized * palette.length));
        const shimmer = pseudoRandom(column + shimmerK, row) * 0.15;
        buckets[paletteIndex].push(
          Math.min(1, 0.23 + normalized * 0.84 + shimmer),
          -spacing + column * spacing + swayX,
          -spacing + row * spacing + colSwayY[column],
        );
      }
    }

    for (let pi = 0; pi < buckets.length; pi += 1) {
      const b = buckets[pi];
      if (!b.length) continue;
      ctx.fillStyle = palette[pi];
      for (let i = 0; i < b.length; i += 3) {
        ctx.globalAlpha = b[i];
        ctx.fillText(CONFIG.glyph, b[i + 1], b[i + 2]);
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
