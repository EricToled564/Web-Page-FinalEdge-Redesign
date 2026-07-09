/**
 * Revelado "pixel por pixel" estilo videojuego vintage para la placa
 * "Tu ventaja definitiva" — un canvas cubre el <img> real con una
 * cuadrícula de bloques sólidos del mismo azul que el fondo, y los va
 * borrando en orden aleatorio (sin easing suave: son saltos discretos,
 * cuadro a cuadro, como un dissolve de 8-bit) hasta dejar la imagen
 * horneada al descubierto. Sin box-shadow/text-shadow (R3.2); el único
 * color usado es --accent, ya un token existente (R1.1).
 */
const CELL = 14; // px de cuadrícula, a resolución de pantalla (no de imagen)
const DURATION = 1100;

function setup(img) {
  if (img.dataset.pixelRevealDone) return;
  const wrap = img.parentElement;
  if (!wrap) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    img.dataset.pixelRevealDone = '1';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'plate-cover';
  wrap.style.position = wrap.style.position || 'relative';
  wrap.appendChild(canvas);

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1E80F0';

  let cells = [];
  let ctx;
  let started = false;

  function layout() {
    const r = img.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h) return false;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    cells = [];
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        cells.push({ x: cx * CELL, y: cy * CELL, t: Math.random() });
      }
    }
    cells.sort((a, b) => a.t - b.t);
    return true;
  }

  function run() {
    if (started) return;
    if (!layout()) return;
    started = true;
    const start = performance.now();
    let idx = 0;
    function frame(now) {
      const p = Math.min(1, (now - start) / DURATION);
      const targetIdx = Math.floor(p * cells.length);
      while (idx < targetIdx) {
        const c = cells[idx];
        ctx.clearRect(c.x, c.y, CELL, CELL);
        idx++;
      }
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        img.dataset.pixelRevealDone = '1';
      }
    }
    requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          run();
          io.disconnect();
        }
      }
    },
    { threshold: 0.35 }
  );
  io.observe(img);
}

function init() {
  document.querySelectorAll('.plate-img').forEach(setup);
}

init();
document.addEventListener('astro:page-load', init);
