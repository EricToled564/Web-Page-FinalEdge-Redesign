/**
 * Auto-ajuste universal de LockupMark: garantiza que NINGÚN lockup
 * (>_ + palabra + [tag]) se desborde de su contenedor, en NINGÚN
 * lugar del sitio — nav, menú del hub, tarjetas de fase, retícula,
 * footer, título de servicio. Antes solo la rueda tenía este
 * mecanismo; esto lo hace universal.
 *
 * Mide el ancho NATURAL del lockup (sin transform) contra el ancho de
 * su contenedor inmediato (el elemento padre, que define la "caja"
 * disponible) y aplica un único `scale()` de encogimiento si no cabe —
 * nunca estira, nunca cambia proporciones, nunca altera qué tan grande
 * se ve un lockup respecto a sí mismo, solo lo encoge lo justo.
 */
function fitAll() {
  document.querySelectorAll('.lm').forEach((el) => {
    /* los lockups dentro de la rueda ENGINE™ ya tienen su propio mecanismo
       de ajuste (fitScale, recalculado cada frame en engine-wheel.js según
       la proyección 3D real) — aplicar este script encima produciría un
       doble ajuste inconsistente. Se excluyen aquí. */
    if (el.closest('.wheel-overlay')) return;
    const parent = el.parentElement;
    if (!parent) return;
    el.style.transform = 'none';
    const naturalW = el.getBoundingClientRect().width;
    const boxW = parent.getBoundingClientRect().width;
    if (naturalW > 0 && boxW > 0 && naturalW > boxW) {
      const scale = Math.max(0.4, boxW / naturalW);
      el.style.transformOrigin = 'left top';
      el.style.transform = `scale(${scale})`;
    }
  });
}

let raf = 0;
function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(fitAll);
}

schedule();
document.addEventListener('astro:page-load', schedule);
addEventListener('resize', schedule, { passive: true });
if ('fonts' in document) document.fonts.ready.then(schedule);
