/**
 * Fondo "Blue Edge ASCII" — código WebGL 2 de referencia entregado por
 * el cliente (zip 2026-07-14, blue_edge_ascii_webgl) "para arreglar el
 * efecto": campo orgánico procedural en GLSL (fbm con dominio deformado
 * + respiración de cobertura en ciclo de 24s) sobre una retícula de
 * glifos 'a' generada en runtime. PORTADO FIEL: shaders literales,
 * mismos parámetros (cellSize 7, speed 1, contrast 1.16, glow 0.28,
 * dpr máx 1.75). Corre en GPU, así que ya no compite con la rueda 3D
 * por el hilo principal (la causa medida del entrecortado anterior).
 * Los ÚNICOS cambios (los que el cliente ya había pedido):
 *  - Colores: la escalera de 5 anclas (darkest→dark→mid→edge→highlight)
 *    se deriva en runtime del token de marca (--pc en hubs, --accent en
 *    las bandas del home) conservando las proporciones del demo, cuyo
 *    ancla es su edge — jamás un hex literal nuevo (R1.1).
 *  - Glifo con Geist Mono (la tipografía de marca) en vez de Arial; la
 *    textura se regenera cuando la webfont termina de cargar.
 *  - Integración a nuestro ciclo de vida: múltiples canvas por atributo
 *    data-blue-edge, re-boot en astro:page-load, pausa real fuera de
 *    pantalla (IntersectionObserver, última entrada del lote), muerte y
 *    limpieza GPU cuando la página navega (canvas.isConnected).
 *  - Respaldo: si WebGL 2 no está disponible, se usa la versión Canvas
 *    2D anterior (el port fiel del primer zip), intacta al final del
 *    archivo.
 * El texto encima va en blanco (pedido explícito) — la base oscura del
 * efecto le da contraste pleno.
 */

const DEFAULTS = {
  cellSize: 7.0,
  speed: 1.0,
  loopDuration: 24.0,
  contrast: 1.16,
  glow: 0.28,
  maxDpr: 1.75,
};

const GLYPH_FONT = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const VERTEX_SHADER = `#version 300 es
  in vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

/* fragment shader LITERAL del código del cliente */
const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uCellSize;
  uniform float uLoopDuration;
  uniform float uContrast;
  uniform float uGlow;
  uniform sampler2D uGlyph;
  uniform vec3 uDarkest;
  uniform vec3 uDark;
  uniform vec3 uMid;
  uniform vec3 uEdge;
  uniform vec3 uHighlight;

  out vec4 outColor;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    float n = hash21(p);
    return vec2(n, hash21(p + n + 17.17));
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03 + vec2(11.7, 7.3);
      amplitude *= 0.49;
    }
    return value;
  }

  float organicField(vec2 p, float phase) {
    vec2 orbitA = vec2(cos(phase), sin(phase));
    vec2 orbitB = vec2(cos(phase + 2.0944), sin(phase + 2.0944));
    vec2 orbitC = vec2(cos(phase + 4.1888), sin(phase + 4.1888));

    vec2 q = vec2(
      fbm(p * 0.92 + orbitA * 0.92),
      fbm(p * 0.92 + vec2(5.2, 1.3) + orbitB * 0.84)
    );

    vec2 r = vec2(
      fbm(p * 1.26 + 3.30 * q + vec2(1.7, 9.2) + orbitB * 0.52),
      fbm(p * 1.26 + 3.30 * q + vec2(8.3, 2.8) + orbitC * 0.52)
    );

    float broad = fbm(p * 0.58 + 1.50 * q + orbitC * 0.38);
    float detail = fbm(p * 1.72 + 4.15 * r + orbitA * 0.31);
    float folds = 0.5 + 0.5 * sin(
      p.x * 2.45 + p.y * 1.05 + q.x * 5.2 - r.y * 4.4 + phase * 0.72
    );

    return broad * 0.41 + detail * 0.45 + folds * 0.14;
  }

  vec3 palette(float v) {
    vec3 c = mix(uDark, uMid, smoothstep(0.05, 0.48, v));
    c = mix(c, uEdge, smoothstep(0.43, 0.79, v));
    c = mix(c, uHighlight, smoothstep(0.82, 1.0, v));
    return c;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / uResolution;
    vec2 centered = (frag - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
    centered.y *= -1.0;

    float phase = mod(uTime, uLoopDuration) / uLoopDuration * 6.28318530718;

    // Static glyph grid with a tiny deterministic irregularity, like the source effect.
    vec2 cellId = floor(frag / uCellSize);
    vec2 cellUv = fract(frag / uCellSize);
    vec2 jitter = (hash22(cellId) - 0.5) * 0.16;
    cellUv -= jitter;

    // Sample the animated field at each cell center so every glyph acts as one tonal pixel.
    vec2 cellCenterPx = (cellId + 0.5) * uCellSize;
    vec2 p = (cellCenterPx - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
    p.y *= -1.0;
    p *= 3.05;

    // Mild large-scale bend prevents the pattern from feeling like a flat noise texture.
    float bend = fbm(p * 0.37 + vec2(cos(phase), sin(phase)) * 0.40);
    p += vec2(sin(p.y * 1.25 + phase), cos(p.x * 1.05 - phase)) * (bend - 0.5) * 0.36;

    float field = organicField(p, phase);
    float fine = fbm(p * 3.25 + vec2(cos(phase), sin(phase)) * 0.25);
    field = mix(field, fine, 0.13);
    field = clamp((field - 0.5) * uContrast + 0.5, 0.0, 1.0);

    // Breathing coverage recreates the source transition from dense light to broken dark masses.
    float breath = 0.5 + 0.5 * cos(phase);
    float threshold = mix(0.64, 0.30, breath);
    float solid = smoothstep(threshold - 0.095, threshold + 0.105, field);
    float ghost = smoothstep(threshold - 0.27, threshold - 0.04, field) * 0.32;
    float presence = max(solid, ghost);

    // Runtime-generated lowercase "a" texture; no image or video asset is used.
    float glyph = texture(uGlyph, vec2(cellUv.x, 1.0 - cellUv.y)).r;
    glyph = smoothstep(0.12, 0.82, glyph);

    float tonal = clamp((field - threshold + 0.30) / 0.57, 0.0, 1.0);
    tonal *= 0.82 + hash21(cellId + 91.7) * 0.18;
    vec3 ink = palette(tonal);

    float alpha = glyph * presence;
    float halo = glyph * solid * uGlow * 0.17;
    vec3 color = mix(uDarkest, ink, alpha);
    color += uEdge * halo;

    // Very subtle vignette, preserving the organic source look without hiding the corners.
    vec2 vuv = uv * (1.0 - uv.yx);
    float vignette = pow(max(vuv.x * vuv.y * 15.0, 0.0), 0.10);
    color = mix(uDarkest, color, 0.88 + 0.12 * vignette);

    outColor = vec4(color, 1.0);
  }
`;

/* escalera de 5 anclas derivada del token de marca vivo: el ancla del
   demo es su "edge" y las demás guardan estas proporciones hacia negro
   / blanco. Sin hex literales (R1.1): el truco fillStyle normaliza el
   token (hex, rgb u oklch) a un hex canónico; si el token faltara, el
   contexto conserva su negro inicial — jamás un color inventado aquí. */
function brandColors(host) {
  const probe = document.createElement('canvas').getContext('2d');
  const raw = (getComputedStyle(host).getPropertyValue('--pc')
    || getComputedStyle(document.documentElement).getPropertyValue('--accent')).trim();
  probe.fillStyle = raw;
  const v = Number.parseInt(probe.fillStyle.slice(1), 16);
  const anchor = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  const mixT = (c, target, k) => c.map((ch) => ch + (target - ch) * k);
  return {
    darkest: mixT(anchor, 0, 0.84),
    dark: mixT(anchor, 0, 0.72),
    mid: mixT(anchor, 0, 0.40),
    edge: anchor,
    /* 0.35 hacia blanco (antes 0.78): el cliente reportó que las crestas
       se veían casi blancas — el punto más claro se queda mucho más
       cerca del tono de marca (2026-07-14) */
    highlight: mixT(anchor, 1, 0.35),
  };
}

function createGlyphTexture(gl) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#fff'; /* blanco del canal rojo de la textura, no un color de marca */
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 104px ${GLYPH_FONT}`;
  ctx.fillText('a', size * 0.50, size * 0.50);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Error de compilación de shader';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Error de link de WebGL';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

/* devuelve true si el canvas quedó corriendo con WebGL 2 */
function initBlueEdgeGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return false;

  const host = canvas.parentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const program = createProgram(gl);
  let glyphTexture = createGlyphTexture(gl);

  /* la textura del glifo se pinta con la fuente que haya en el momento;
     cuando Geist Mono termina de cargar se regenera una única vez */
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (!canvas.isConnected) return;
      gl.deleteTexture(glyphTexture);
      glyphTexture = createGlyphTexture(gl);
      if (reducedMotion) render(performance.now());
    });
  }

  const position = gl.getAttribLocation(program, 'aPosition');
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const name of ['uResolution', 'uTime', 'uCellSize', 'uLoopDuration', 'uContrast',
    'uGlow', 'uGlyph', 'uDarkest', 'uDark', 'uMid', 'uEdge', 'uHighlight']) {
    U[name] = gl.getUniformLocation(program, name);
  }

  let colors = brandColors(host);
  let dpr = 1;
  const startTime = performance.now();

  function resize() {
    const rect = host.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, DEFAULTS.maxDpr);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    colors = brandColors(host);
    if (reducedMotion) render(performance.now());
  }

  function render(now) {
    /* bajo prefers-reduced-motion: un solo cuadro fijo, como el original */
    const elapsed = reducedMotion ? 0 : ((now - startTime) / 1000) * DEFAULTS.speed;
    gl.useProgram(program);
    gl.uniform2f(U.uResolution, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, elapsed);
    gl.uniform1f(U.uCellSize, DEFAULTS.cellSize * dpr);
    gl.uniform1f(U.uLoopDuration, DEFAULTS.loopDuration);
    gl.uniform1f(U.uContrast, DEFAULTS.contrast);
    gl.uniform1f(U.uGlow, DEFAULTS.glow);
    gl.uniform3fv(U.uDarkest, colors.darkest);
    gl.uniform3fv(U.uDark, colors.dark);
    gl.uniform3fv(U.uMid, colors.mid);
    gl.uniform3fv(U.uEdge, colors.edge);
    gl.uniform3fv(U.uHighlight, colors.highlight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glyphTexture);
    gl.uniform1i(U.uGlyph, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  addEventListener('resize', resize, { passive: true });

  if (reducedMotion) return true;

  let visible = true;
  /* última entrada del lote, no la primera (mismo bug que la rueda) */
  new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; }).observe(canvas);

  function loop(now) {
    if (!canvas.isConnected) {
      /* la página navegó: se corta el bucle y se libera la GPU */
      gl.deleteTexture(glyphTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      return;
    }
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    render(now);
  }
  requestAnimationFrame(loop);
  return true;
}

/* ==================================================================
   RESPALDO Canvas 2D — el port fiel del primer zip del cliente
   (blue_edge_background), con las mejoras de rendimiento verificadas
   bit a bit y los ajustes de movimiento que pidió después (velocidad
   1.05, deriva ×3, shimmer ×2, semilla aleatoria). Solo corre si
   WebGL 2 no está disponible.
   ================================================================== */

const CONFIG = {
  glyph: 'a',
  gridSize: 10,
  maxDpr: 1.5,
  fps: 24,
  speed: 1.05,
  threshold: 0.49,
  fontFamily: GLYPH_FONT,
};

function initBlueEdge2D(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return;
  const host = canvas.parentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let width = 0, height = 0, dpr = 1, cols = 0, rows = 0, lastFrame = 0;
  const seed = 1000 + Math.random() * 9000;
  const DRIFT_X = 0.063, DRIFT_Y = 0.042;
  const palette = [];
  let baseColor = 'black'; // se recalcula del token en rebuildPalette()

  function anchorRgb() {
    const raw = (getComputedStyle(host).getPropertyValue('--pc')
      || getComputedStyle(document.documentElement).getPropertyValue('--accent')).trim();
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

  const FREQS = [1, 2.03, 2.03 * 2.03, 2.03 * 2.03 * 2.03];
  const AMPS = [0.58, 0.58 * 0.5, 0.58 * 0.5 * 0.5, 0.58 * 0.5 * 0.5 * 0.5];
  const NORM = AMPS[0] + AMPS[1] + AMPS[2] + AMPS[3];
  const lattice = FREQS.map(() => ({ x0: 0, y0: 0, w: 0, h: 0, v: new Float64Array(0) }));

  function buildLattice(time) {
    const bx = time * DRIFT_X, by = -time * DRIFT_Y;
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
    const driftX = time * DRIFT_X;
    const driftY = time * DRIFT_Y;
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
        const shimmer = pseudoRandom(column + shimmerK, row) * 0.30;
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
    try {
      if (initBlueEdgeGL(c)) return;
    } catch {
      /* shader/contexto falló: cae al respaldo 2D */
    }
    initBlueEdge2D(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
