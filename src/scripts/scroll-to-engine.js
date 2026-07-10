/**
 * Pedido explícito: el botón "Conoce el >_ final edge [ENGINE]" del nav
 * debe dejar la rueda PERFECTAMENTE centrada verticalmente en la
 * pantalla, no solo saltar al top de la sección (el comportamiento
 * nativo del navegador para un ancla #engine, que la deja más abajo del
 * centro porque la sección completa —texto + rueda + padding— es más
 * alta que el viewport). Cálculo dinámico contra el canvas real de la
 * rueda, no un número de píxeles fijo: un offset fijo solo quedaría
 * centrado en la altura de pantalla donde se midió, y descentrado en
 * cualquier otra. No toca nada de la rueda en sí (tamaño, geometría,
 * hover) — solo A DÓNDE TE LLEVA el click.
 */
function scrollToEngineCentered() {
  const target = document.querySelector('.wheel-canvas') || document.getElementById('engine');
  if (!target) return;
  /* #wheel-entry (el wheel-card) tiene su propio transform ligado al
     scroll (ver initCosmosScroll en index.astro): translateY de hasta
     48px + una leve escala mientras la sección todavía no "termina de
     entrar" a pantalla (p<1). Medir la posición CON ese transform puesto
     mide un estado transitorio, no el de reposo — el resultado queda
     descentrado por esos mismos ~48px una vez que el transform llega a
     su valor final (translateY(0) scale(1), p=1). Se anula el
     transform un instante SOLO para medir la posición de reposo real, y
     se restaura antes de que el navegador pinte el cuadro (mismo frame,
     sin parpadeo visible) — el próximo evento de scroll (el que dispara
     este mismo scrollTo) ya recalcula ese transform de forma consistente
     con la posición a la que se está scrolleando. */
  const card = document.getElementById('wheel-entry');
  const prevTransform = card ? card.style.transform : null;
  if (card) card.style.transform = 'none';
  const rect = target.getBoundingClientRect();
  const targetY = scrollY + (rect.top + rect.bottom) / 2 - innerHeight / 2;
  if (card) card.style.transform = prevTransform;
  scrollTo({ top: Math.max(0, targetY), left: 0, behavior: 'instant' });
}

function handleEngineLinkClick(ev) {
  const link = ev.currentTarget;
  const url = new URL(link.href, location.href);
  if (url.pathname !== location.pathname) return; // otra página: navegación normal, ver maybeScrollOnLoad
  ev.preventDefault();
  if (location.hash !== '#engine') history.pushState(null, '', '#engine');
  scrollToEngineCentered();
}

function bindEngineLinks() {
  document.querySelectorAll('a[href="/#engine"], a[href="#engine"]').forEach((a) => {
    if (a.dataset.engineScrollBound) return; // nav persiste entre transiciones (transition:persist) — no doble-atar
    a.dataset.engineScrollBound = '1';
    a.addEventListener('click', handleEngineLinkClick);
  });
}

function maybeScrollOnLoad() {
  if (location.hash !== '#engine') return;
  // deja que engine-wheel.js termine su resize() inicial (build() lo llama
  // sincrónico, pero un cuadro de margen evita medir el canvas a mitad de layout).
  requestAnimationFrame(() => requestAnimationFrame(scrollToEngineCentered));
}

bindEngineLinks();
maybeScrollOnLoad();
document.addEventListener('astro:page-load', () => {
  bindEngineLinks();
  maybeScrollOnLoad();
});
