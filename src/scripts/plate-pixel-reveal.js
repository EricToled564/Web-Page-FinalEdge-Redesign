/**
 * Revelado "pixel por pixel" estilo videojuego vintage para la placa
 * "Tu ventaja definitiva" — un canvas cubre el <img> real con una
 * cuadrícula de bloques sólidos del mismo azul que el fondo, y los va
 * borrando en orden aleatorio (sin easing suave: son saltos discretos,
 * cuadro a cuadro, como un dissolve de 8-bit) hasta dejar la imagen
 * horneada al descubierto. Sin box-shadow/text-shadow (R3.2); el único
 * color usado es --accent, ya un token existente (R1.1).
 *
 * La cobertura se pinta de inmediato al montar (no al hacer scroll): si
 * se espera a la intersección para recién ahí dibujar el canvas, la
 * imagen real queda visible sin nada encima desde que carga la página
 * — no hay nada que "revelar" cuando el usuario llega a la sección. El
 * IntersectionObserver solo dispara el BORRADO progresivo, nunca la
 * cobertura inicial.
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
  /* estilos críticos inline: un elemento creado en runtime por un script
     importado NUNCA recibe el atributo data-astro-cid-* que Astro usa
     para aplicar el <style> con scope del componente — la regla
     ".plate-cover" de index.astro simplemente no matchea nada aquí, y
     el canvas quedaba en position:static (fuera de lugar, sin cubrir
     nada). Fijar la posición por JS lo hace independiente del scoping. */
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.pointerEvents = 'none';
  wrap.appendChild(canvas);

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1E80F0';

  let cells = [];
  let ctx;
  let started = false;

  function cover() {
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

  // cobertura inmediata — antes de cualquier scroll o intersección.
  let covered = cover();
  if (!covered) {
    // la imagen todavía no tiene tamaño de layout (ej. fuentes/CSS sin
    // resolver todavía) — reintenta en el próximo frame.
    requestAnimationFrame(() => { covered = cover(); });
  }

  function onResize() {
    if (!started) cover();
  }
  addEventListener('resize', onResize, { passive: true });

  function run() {
    if (started) return;
    if (!ctx) cover();
    started = true;
    removeEventListener('resize', onResize);
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
