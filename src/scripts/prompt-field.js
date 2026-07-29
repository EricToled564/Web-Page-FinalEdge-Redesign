/**
 * prompt-field.js — el glifo >_ como campo de partículas WebGL.
 *
 * Pedido 2026-07-29: el >_ debe estar "representado de forma relevante
 * en el diseño de la página". En el sitio actual es un carácter de 14px;
 * aquí es la estructura monumental que arma la pantalla.
 *
 * Cómo funciona:
 *  1. Se rasteriza el glifo ">_" en un <canvas> 2D con Geist Mono.
 *  2. Se muestrean los píxeles opacos → nube de posiciones objetivo.
 *  3. Cada partícula guarda DOS posiciones: dispersa (caos) y ensamblada
 *     (el glifo). Un único uniform uAssemble (0→1) interpola entre ambas,
 *     con retraso por partícula para que el ensamblado sea escalonado y
 *     no un salto uniforme.
 *  4. El scroll maneja uAssemble; el puntero inclina la cámara (parallax);
 *     en reposo hay respiración.
 *
 * Reglas de marca: los colores salen de tokens (--accent, --fg, colores
 * de fase) leídos del CSS en runtime — cero hex nuevos (R1.1). Sin
 * dependencias más allá de three, que ya usa la rueda ENGINE.
 */
import * as THREE from 'three';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* lee un token del CSS y lo convierte a THREE.Color (R1.1: los colores
   nunca se escriben aquí, se leen de tokens.css) */
function token(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

/**
 * Rasteriza ">_" y devuelve posiciones (x,y) normalizadas a [-1,1] de
 * los píxeles con tinta, submuestreadas cada `step` píxeles.
 */
function sampleGlyph(text, count) {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  /* Geist Mono 700: mismo glifo que el lockup de marca */
  ctx.font = `700 ${Math.round(H * 0.62)}px "Geist Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);

  const data = ctx.getImageData(0, 0, W, H).data;
  const hits = [];
  /* step adaptativo: barrer todo a 1px daría cientos de miles de puntos */
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        hits.push([x, y]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!hits.length) return null;

  /* Normalizar contra la CAJA DE TINTA, no contra el lienzo: el ">_" solo
     ocupa una fracción del canvas (el "_" es una línea fina abajo), así
     que normalizar por W/H daba un glifo diminuto perdido en la pantalla.
     Aquí la tinta se mapea a [-1,1] conservando su proporción real. */
  const inkW = Math.max(1, maxX - minX);
  const inkH = Math.max(1, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(inkW, inkH) / 2; // misma escala en ambos ejes

  const pts = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const [x, y] = hits[(Math.random() * hits.length) | 0];
    /* jitter sub-píxel: evita que se vea una retícula perfecta */
    const jx = x + (Math.random() - 0.5) * 2;
    const jy = y + (Math.random() - 0.5) * 2;
    pts[i * 2] = (jx - cx) / half;       // [-1,1] sobre el eje mayor
    pts[i * 2 + 1] = -(jy - cy) / half;  // Y invertida (canvas→GL)
  }
  /* proporción real de la tinta, para escalar sin deformar */
  pts.inkAspect = inkW / inkH;
  return pts;
}

export function createPromptField(canvas, opts = {}) {
  /* densidad: a escala monumental el glifo cubre casi toda la pantalla;
     con 9k partículas se leía como polvo disperso en vez de estructura. */
  const COUNT = opts.count ?? (innerWidth < 860 ? 14000 : 32000);
  const glyph = sampleGlyph('>_', COUNT);
  if (!glyph) return null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 4.2;

  /* ---- atributos ---- */
  const aTarget = new Float32Array(COUNT * 3);   // posición ensamblada
  const aScatter = new Float32Array(COUNT * 3);  // posición dispersa
  const aSeed = new Float32Array(COUNT);         // aleatoriedad por partícula
  const aTone = new Float32Array(COUNT);         // 0=acento 1=fg (mezcla)

  /* MONUMENTAL: el glifo ocupa casi todo el alto visible de la cámara.
     A z=4.2 con fov 50° se ven ~3.9 unidades de alto; con SCALE 1.55 el
     >_ mide ~3.1 unidades = ~80% de la pantalla. Ese es el punto del
     rediseño: el >_ es la estructura, no un carácter de 14px. */
  const SCALE = 1.55;
  for (let i = 0; i < COUNT; i++) {
    /* ensamblado: el glifo, escalado a unidades de mundo */
    aTarget[i * 3] = glyph[i * 2] * SCALE;
    aTarget[i * 3 + 1] = glyph[i * 2 + 1] * SCALE;
    /* profundidad: el glifo no es plano, tiene cuerpo */
    aTarget[i * 3 + 2] = (Math.random() - 0.5) * 0.35;

    /* disperso: cáscara esférica hueca alrededor de la escena */
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 3.4 + Math.random() * 3.2;
    aScatter[i * 3] = Math.sin(ph) * Math.cos(th) * r * 1.5;
    aScatter[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r;
    aScatter[i * 3 + 2] = Math.cos(ph) * r * 0.6 - 1.0;

    aSeed[i] = Math.random();
    /* la mayoría en el tono base, una minoría encendida en acento:
       da vibración cromática sin salirse de los tokens */
    aTone[i] = Math.random() < 0.28 ? 0.0 : 1.0;
  }

  const geo = new THREE.BufferGeometry();
  /* `position` obligatorio para three, pero la posición real se calcula
     en el vertex shader mezclando target/scatter */
  geo.setAttribute('position', new THREE.BufferAttribute(aTarget.slice(), 3));
  geo.setAttribute('aTarget', new THREE.BufferAttribute(aTarget, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(aScatter, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute('aTone', new THREE.BufferAttribute(aTone, 1));

  const uniforms = {
    uAssemble: { value: 0 },
    uTime: { value: 0 },
    /* px a 1 unidad de cámara; a z≈4.2 da puntos de ~2–5px */
    uSize: { value: renderer.getPixelRatio() * (innerWidth < 860 ? 8.0 : 10.0) },
    uAccent: { value: token('--accent', '#1E80F0') },
    uFg: { value: token('--fg', '#F4F4F2') },
    uOpacity: { value: 1 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    /* aditivo: donde se acumulan partículas el glifo se enciende solo —
       da el brillo del núcleo sin post-proceso ni bloom */
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aTarget;
      attribute vec3 aScatter;
      attribute float aSeed;
      attribute float aTone;
      uniform float uAssemble;
      uniform float uTime;
      uniform float uSize;
      varying float vTone;
      varying float vGlow;

      /* misma sensación que la curva maestra de marca */
      float easeMaster(float t){
        return 1.0 - pow(1.0 - t, 3.0);
      }

      void main() {
        /* ensamblado escalonado: cada partícula arranca en un momento
           distinto según su semilla — el glifo se "escribe", no aparece */
        float delay = aSeed * 0.45;
        float t = clamp((uAssemble - delay) / (1.0 - delay), 0.0, 1.0);
        t = easeMaster(t);

        vec3 pos = mix(aScatter, aTarget, t);

        /* deriva continua: en disperso vaga, ya ensamblado solo respira */
        float drift = mix(0.30, 0.012, t);
        pos.x += sin(uTime * 0.5 + aSeed * 30.0) * drift;
        pos.y += cos(uTime * 0.42 + aSeed * 24.0) * drift;
        pos.z += sin(uTime * 0.33 + aSeed * 18.0) * drift * 0.7;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        /* tamaño atenuado por distancia: profundidad real.
           uSize está en "px a 1 unidad de distancia" — dividir por -mv.z
           da la atenuación correcta. (Antes se usaba 300/-mv.z, que a
           z≈4 producía puntos de ~180px: con blending aditivo 9000
           partículas saturaban la pantalla a blanco.) */
        gl_PointSize = (uSize / -mv.z) * (0.55 + aSeed * 0.75);

        vTone = aTone;
        /* las recién llegadas brillan más: el ensamblado "quema" */
        vGlow = 0.35 + t * 0.65;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uAccent;
      uniform vec3 uFg;
      uniform float uOpacity;
      varying float vTone;
      varying float vGlow;

      void main() {
        /* punto redondo con caída suave (sin textura) */
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d);

        vec3 col = mix(uAccent, uFg, vTone);
        /* alfa bajo: con blending aditivo el brillo se ACUMULA donde las
           partículas se agolpan (el núcleo del glifo se enciende solo).
           Si el alfa es alto, el fondo se lava y el negro deja de ser
           negro — que es justo lo que abarata una pantalla oscura. */
        gl_FragColor = vec4(col * vGlow, a * uOpacity * 0.62);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  /* ---- estado de interacción ---- */
  let assemble = 0;      // objetivo (lo fija el scroll)
  let assembleSmooth = 0;
  let px = 0, py = 0;    // puntero objetivo
  let sx = 0, sy = 0;    // puntero suavizado
  let running = true;
  let visible = true;

  /* medio-ancho y medio-alto reales del glifo en unidades de mundo:
     sampleGlyph normaliza por el eje mayor, así que el eje menor mide
     su proporción. Sirven para encuadrar la cámara sin recortar. */
  const halfW = SCALE * (glyph.inkAspect >= 1 ? 1 : glyph.inkAspect);
  const halfH = SCALE * (glyph.inkAspect >= 1 ? 1 / glyph.inkAspect : 1);

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;

    /* Encuadre calculado, no valores a ojo: se despeja la distancia
       mínima para que el glifo quepa por ANCHO y por ALTO, y se toma la
       mayor. Sin esto, en vertical (móvil) el >_ se salía de cuadro. */
    const tan = Math.tan((camera.fov * Math.PI) / 180 / 2);
    /* aire alrededor del glifo: con 1.25 llenaba ~80% y se sentía
       apretado contra los bordes; 1.85 lo deja monumental pero
       compuesto, con respiración a los lados */
    const margin = 1.85;
    const zForH = (halfH * margin) / tan;
    const zForW = (halfW * margin) / (tan * aspect);
    camera.position.z = Math.max(zForH, zForW);
    camera.updateProjectionMatrix();

    /* El glifo ocupa la misma fracción de pantalla a cualquier distancia
       (por el encuadre de arriba), así que el punto también debe verse
       igual: uSize se escala con z para que gl_PointSize (uSize/-mv.z)
       dé los mismos px en móvil que en escritorio. */
    const basePx = renderer.getPixelRatio() * (w < 860 ? 1.7 : 2.3);
    uniforms.uSize.value = basePx * camera.position.z;
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    py = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }
  if (!REDUCED) addEventListener('pointermove', onPointer, { passive: true });

  /* no gastar GPU cuando el hero no está en pantalla */
  const io = new IntersectionObserver((ents) => {
    visible = ents.some((e) => e.isIntersecting);
  }, { threshold: 0 });
  io.observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    /* suavizado exponencial: el ensamblado nunca salta con el scroll */
    assembleSmooth += (assemble - assembleSmooth) * 0.075;
    uniforms.uAssemble.value = assembleSmooth;

    sx += (px - sx) * 0.045;
    sy += (py - sy) * 0.045;
    /* parallax: la cámara orbita levemente; el glifo se siente sólido */
    points.rotation.y = sx * 0.28 + Math.sin(t * 0.18) * 0.03;
    points.rotation.x = -sy * 0.18 + Math.cos(t * 0.15) * 0.02;

    renderer.render(scene, camera);
  }

  if (REDUCED) {
    /* sin movimiento: se dibuja el glifo ya ensamblado, un solo frame */
    uniforms.uAssemble.value = 1;
    assembleSmooth = 1;
    renderer.render(scene, camera);
  } else {
    frame();
  }

  return {
    /** 0 = disperso · 1 = glifo ensamblado */
    setAssemble(v) { assemble = Math.max(0, Math.min(1, v)); },
    setOpacity(v) { uniforms.uOpacity.value = Math.max(0, Math.min(1, v)); },
    destroy() {
      running = false;
      io.disconnect();
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
