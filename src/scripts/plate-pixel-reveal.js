/**
 * Revelado "pixel por pixel" estilo videojuego vintage para la placa
 * "Tu ventaja definitiva" — un canvas cubre el <img> real con una
 * cuadrícula de bloques sólidos del mismo azul que el fondo, y los va
 * borrando en orden aleatorio (sin easing suave: son saltos discretos,
 * cuadro a cuadro, como un dissolve de 8-bit) hasta dejar la imagen
 * horneada al descubierto — y luego los vuelve a pintar para repetir el
 * ciclo EN LOOP mientras la sección esté en pantalla. Sin box-shadow/
 * text-shadow (R3.2); el único color usado es --accent, ya un token
 * existente (R1.1).
 *
 * La cobertura se pinta de inmediato al montar (no al hacer scroll): si
 * se espera a la intersección para recién ahí dibujar el canvas, la
 * imagen real queda visible sin nada encima desde que carga la página
 * — no hay nada que "revelar" cuando el usuario llega a la sección. El
 * IntersectionObserver solo arranca/pausa el loop (se congela fuera de
 * pantalla para no gastar batería de más).
 */
const CELL = 14; // px de cuadrícula, a resolución de pantalla (no de imagen)
const REVEAL_MS = 1100;
const HOLD_MS = 1700; // texto completo, legible, antes de re-cubrirse
const COVER_MS = 700; // re-cubrir es más rápido que revelar
const GAP_MS = 250; // pausa cubierta antes de volver a revelar

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
  let w = 0, h = 0;

  function layout() {
    const r = img.getBoundingClientRect();
    const nw = Math.round(r.width);
    const nh = Math.round(r.height);
    if (!nw || !nh) return false;
    w = nw; h = nh;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    cells = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        cells.push({ x: cx * CELL, y: cy * CELL });
      }
    }
    return true;
  }

  function shuffle() {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
  }

  function fillAll() {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
  }

  // cobertura inmediata — antes de cualquier scroll o intersección.
  let ready = layout();
  if (ready) fillAll();
  else requestAnimationFrame(() => { ready = layout(); if (ready) fillAll(); });

  let visible = false;
  let started = false;
  // fases: 'cover' (estado inicial, quieto) -> 'revealing' -> 'hold' ->
  // 'covering' -> 'gap' -> 'revealing' -> ... (loop)
  let phase = 'cover';
  let phaseStart = 0;
  let idx = 0;

  function enter(next, now) {
    phase = next;
    phaseStart = now;
    idx = 0;
    if (next === 'revealing' || next === 'covering') shuffle();
  }

  function onResize() {
    // solo re-layout mientras está totalmente cubierto (entre ciclos) —
    // evita saltos visuales a mitad de un borrado/pintado.
    if (phase === 'cover' || phase === 'gap') {
      layout();
      fillAll();
    }
  }
  addEventListener('resize', onResize, { passive: true });

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !ready) return;

    if (phase === 'cover') {
      enter('revealing', now);
      return;
    }

    const elapsed = now - phaseStart;

    if (phase === 'revealing') {
      const p = Math.min(1, elapsed / REVEAL_MS);
      const targetIdx = Math.floor(p * cells.length);
      while (idx < targetIdx) {
        const c = cells[idx];
        ctx.clearRect(c.x, c.y, CELL, CELL);
        idx++;
      }
      if (p >= 1) enter('hold', now);
    } else if (phase === 'hold') {
      if (elapsed >= HOLD_MS) enter('covering', now);
    } else if (phase === 'covering') {
      const p = Math.min(1, elapsed / COVER_MS);
      const targetIdx = Math.floor(p * cells.length);
      while (idx < targetIdx) {
        const c = cells[idx];
        ctx.fillStyle = accent;
        ctx.fillRect(c.x, c.y, CELL, CELL);
        idx++;
      }
      if (p >= 1) enter('gap', now);
    } else if (phase === 'gap') {
      if (elapsed >= GAP_MS) enter('revealing', now);
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        visible = en.isIntersecting;
        if (visible && !started) {
          started = true;
          requestAnimationFrame(frame);
        }
      }
    },
    { threshold: 0.2 }
  );
  io.observe(img);
}

function init() {
  document.querySelectorAll('.plate-img').forEach(setup);
}

init();
document.addEventListener('astro:page-load', init);
