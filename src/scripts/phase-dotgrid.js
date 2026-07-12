/**
 * Experimento 2026-07-12 v3 (Evaluación, hero del hub): malla deformable —
 * réplica del cuarto video de referencia del cliente (confirmado: "este
 * sí lo puedes implementar"), sustituye al flow field v2.
 * Colores intactos: tinta y fondo son los MISMOS tokens del hub.
 *
 * Lectura del video (73 cuadros): una RED diagonal (celosía de líneas
 * cruzadas en dos familias diagonales, con un punto en cada intersección)
 * que se comporta como tela/superficie líquida: una DEPRESIÓN localizada
 * (como un dedo hundiendo una red) viaja por la superficie doblando la
 * celosía a su paso — los puntos cercanos al pozo se compactan hacia su
 * centro y se hunden levemente, y las líneas que los unen se curvan con
 * ellos. En el frame 0 el pozo está abajo-derecha; en el 60,
 * abajo-izquierda: recorre la malla lentamente.
 *
 * Implementación: celosía = retícula cuadrada ROTADA 45° — coordenadas
 * (u,v) → pantalla con x=(u+v)·s, y=(u−v)·s. Revisión del cliente
 * 2026-07-12: SOLO los puntos de las intersecciones, sin dibujar la red
 * de líneas, y la tinta no en void (negro) sino en un TONO MÁS OSCURO
 * DEL PROPIO COLOR DE FONDO (tono-sobre-tono: el fondo queda como
 * textura y el título/statement quedan como la única tinta plena de la
 * lámina). La deformación es un pozo con caída derivada-de-gaussiana
 * que compacta los puntos hacia su centro (embudo suave). El pozo pasea
 * solo (ruido 1D por eje) y, si el usuario tiene el puntero sobre el
 * hero, lo persigue con retraso.
 */

const SPACING = 26;   // px CSS entre puntos vecinos de la celosía
const DOT_R = 1.6;    // radio del punto
const WELL_R = 200;   // radio de influencia del pozo (px CSS)
const WELL_PULL = 34; // compactación máxima (px CSS)
const FPS = 30;       // este efecto lee mejor fluido (el video es suave)

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

/* ruido 1D suave — el paseo autónomo del pozo */
function vnoise1(x, seed) {
  const xi = Math.floor(x);
  const u = fade(x - xi);
  const a = h3(xi, seed, 11), b = h3(xi + 1, seed, 11);
  return a + (b - a) * u;
}

function initMesh(canvas) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  /* tinta = el color de fondo REAL de la sección, oscurecido (pedido
     explícito: no negro — un tono más oscuro del color del fondo). El
     fondo computado llega como rgb(...) u oklch(...) según el navegador;
     ambos se oscurecen escalando su componente de luz. Fallback: void. */
  function darkerInk() {
    const bg = getComputedStyle(host).backgroundColor || '';
    let m = bg.match(/oklch\(([\d.]+)/);
    if (m) return bg.replace(m[1], (parseFloat(m[1]) * 0.52).toFixed(4));
    m = bg.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map((n) => Math.round(parseInt(n, 10) * 0.52));
      return `rgb(${r}, ${g}, ${b})`;
    }
    return getComputedStyle(document.documentElement).getPropertyValue('--void-deep').trim() || '#08080A';
  }
  const inkColor = darkerInk();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let nu = 0, nv = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    /* en coords rotadas, x=(u+v)·s recorre 0..W y y=(u−v)·s recorre
       −H/2..+H/2 alrededor del centro: dimensionar con margen para que
       las cuatro esquinas queden cubiertas */
    const s = SPACING * 0.7071;
    nu = Math.ceil((W + H) / (2 * s)) + 3;
    nv = nu;
  }

  /* el pozo sigue al puntero cuando está sobre el hero; si no, pasea solo */
  let pointer = null;
  host.addEventListener('pointermove', (ev) => {
    const r = host.getBoundingClientRect();
    pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top };
  });
  host.addEventListener('pointerleave', () => { pointer = null; });

  let wellX = 0, wellY = 0, wellInit = false;

  function paint(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tx = pointer ? pointer.x : (0.1 + 0.8 * vnoise1(t * 0.11, 3)) * W;
    const ty = pointer ? pointer.y : (0.1 + 0.8 * vnoise1(t * 0.13, 7)) * H;
    if (!wellInit) { wellX = tx; wellY = ty; wellInit = true; }
    /* persigue el objetivo con retraso — la tela "reacciona", no salta */
    wellX += (tx - wellX) * 0.07;
    wellY += (ty - wellY) * 0.07;

    const invR2 = 1 / (WELL_R * WELL_R);
    const s = SPACING * 0.7071;

    /* posiciones deformadas de todos los nodos de la celosía */
    const pos = new Float32Array(nu * nv * 2);
    for (let v = 0; v < nv; v++) {
      for (let u = 0; u < nu; u++) {
        let x = (u + v) * s - H * 0.5;      // corrido para cubrir esquinas
        let y = (u - v) * s + H * 0.5;
        const dx = x - wellX, dy = y - wellY;
        const r2 = (dx * dx + dy * dy) * invR2;
        if (r2 < 9) {
          /* caída tipo derivada-de-gaussiana: CERO en el centro (los
             puntos del fondo del pozo casi no se mueven), máxima a medio
             radio, cero lejos — embudo suave como el del video, no una
             singularidad que colapsa los puntos en un solo lugar (así se
             veía el primer intento: telaraña recogida en un punto). */
          const q = Math.sqrt(r2);
          const pull = WELL_PULL * (q * Math.exp(-q * q * 0.5)) / 0.6066;
          const r = Math.sqrt(dx * dx + dy * dy) || 1;
          x -= (dx / r) * pull;
          y -= (dy / r) * pull - pull * 0.3;
        }
        const idx = (v * nu + u) * 2;
        pos[idx] = x * dpr;
        pos[idx + 1] = y * dpr;
      }
    }

    /* SOLO puntos (revisión del cliente: sin la red de líneas) — la
       deformación se lee por el desplazamiento de los propios puntos */
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = inkColor;
    const rr = DOT_R * dpr;
    ctx.beginPath();
    const wLimit = canvas.width + 20, hLimit = canvas.height + 20;
    for (let i = 0; i < nu * nv; i++) {
      const x = pos[i * 2], y = pos[i * 2 + 1];
      if (x < -20 || y < -20 || x > wLimit || y > hLimit) continue;
      ctx.moveTo(x + rr, y);
      ctx.arc(x, y, rr, 0, Math.PI * 2);
    }
    ctx.fill();
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
    initMesh(c);
  });
}

boot();
document.addEventListener('astro:page-load', boot);
