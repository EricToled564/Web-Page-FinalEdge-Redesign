/**
 * ENGINE™ — rueda WebGL (Three.js), navegación viva del Final Edge Engine.
 * APARIENCIA: cara frontal = réplica exacta de la rueda del brand book (§07)
 * (gradientes radiales oscuros, trazo de fase, banda sólida, hub #1A2A40) +
 * VOLUMEN 3D (decisión del cliente 2026-07-08): extrusión con paredes, tilt
 * de perspectiva, parallax con el puntero y rotación ligada al scroll.
 * COREOGRAFÍA (inspiración igloo.inc):
 *  · click en FASE → se ilumina y gira; el resto se desvanece; queda como menú del hub
 *  · click en SERVICIO → el segmento se desprende, gira y se acopla como título
 * Etiquetas SIEMPRE texto DOM ≥14px (R6.2).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { navigate } from 'astro:transitions/client';
import { PHASES, EDGES } from '../data/engine.js';

const D2R = Math.PI / 180;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEPTH = 58;      // extrusión de sectores — volumen 3D deliberadamente visible
const BAND_DEPTH = 34; // extrusión de la banda
/* referencia igloo.inc — el bloque activo se despega de forma OBVIA
   (no un matiz sutil): sale hacia afuera en su propio eje radial,
   avanza hacia la cámara y crece un poco, todo junto — un solo número
   de "Z apenas más cerca" es casi imperceptible a la distancia de
   cámara de esta escena (le tomó 3 intentos al cliente confirmarlo). */
/* recalibrados hacia abajo respecto al primer intento "99% igloo": ese
   desplazamiento necesitaba un BUFFER (ver resize()) tan grande que, en
   la columna real del home (ancho fijo, sin espacio de sobra), terminaba
   achicando la rueda entera para hacerle lugar — el cliente pidió
   explícitamente que la rueda NUNCA se achique de su tamaño original.
   Estos valores son los más altos que caben sin desbordar el recorte
   con el BUFFER original (26px), medido con Playwright en los 6 edges. */
const HOVER_LIFT_Z = 70;    // avance hacia la cámara
const HOVER_OUT = 26;       // salida radial (alejándose del centro)
const HOVER_SCALE = 0.13;   // +13% de tamaño
const HOVER_DWELL_MS = 60;  // ver histéresis en pick()
const HOVER_GLOW = 1.1;     // brillo extra sobre el brillo base (SOLO sectores)
/* las bandas son un arco de ~120°, mucho más área de pantalla que un
   sector individual — el mismo HOVER_GLOW que en un sector se ve
   "99% igloo" ahí, en una banda el bloom real (UnrealBloomPass) cubre
   tanto pixel brillante que se come el arco entero y se derrama sobre
   el resto de la escena (se vio en captura: un borrón amarillo que
   tapaba hasta las etiquetas). Las bandas piden un glow de color
   NOTORIO pero controlado (nunca el mismo movimiento que un sector,
   piden explícitamente que no se muevan), así que usan su propio techo,
   mucho más bajo, para que el arco se ilumine sin saturar el cuadro. */
const BAND_HOVER_GLOW = 0.32;
const GLOW_MAX_OPACITY = 0.85; // opacidad máxima del sprite de luz derramada
const BAND_GLOW_MAX_OPACITY = 0.4;
/* el bloom (UnrealBloomPass) no responde igual a los 3 colores de fase:
   el cian de Capacidades (#15D9D9) tiene luminancia BT.709
   (0.2126R+0.7152G+0.0722B) más alta que el ámbar o el magenta, así que
   el MISMO BAND_HOVER_GLOW numérico cruza el umbral de bloom mucho más
   fuerte ahí — medido en captura: con el valor idéntico en las 3,
   Capacidades se veía como un borrón que se comía media rueda mientras
   Evaluación/Ejecución quedaban contenidos y parejos entre sí. Este
   factor compensa por fase para que el brillo PERCIBIDO sea igual entre
   las 3, no el valor numérico que se le pasa al material. */
const PHASE_GLOW_FACTOR = { evaluacion: 1, capacidades: 0.4, ejecucion: 1 };

/* gradientes radiales del brand book: [stop 0.35, stop 1.0] con radio 288 */
const GRADS = {
  evaluacion: ['#1C1407', '#0A0805'],
  capacidades: ['#08191A', '#050B0B'],
  ejecucion: ['#180819', '#0A050B'],
};
const GRAD_R0 = 0.35 * 288;
const GRAD_R1 = 288;

/* curva maestra cubic-bezier(0.2, 0.8, 0.2, 1) — R3.4 */
function masterEase(t) {
  const p1x = 0.2, p1y = 0.8, p2x = 0.2, p2y = 1;
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const bezX = (u) => ((ax * u + bx) * u + cx) * u;
  const bezY = (u) => ((ay * u + by) * u + cy) * u;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = bezX(u) - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  return bezY(Math.min(1, Math.max(0, u)));
}

const posAt = (deg, r) => new THREE.Vector3(Math.sin(deg * D2R) * r, Math.cos(deg * D2R) * r, 0);

function donutShape(ri, ro, a0deg, a1deg) {
  const toRad = (d) => (90 - d) * D2R;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, ro, toRad(a0deg), toRad(a1deg), true);
  shape.absarc(0, 0, ri, toRad(a1deg), toRad(a0deg), false);
  return shape;
}

/**
 * Malla extruida con la cara frontal del brand book:
 *  grad = [c0, c1] → gradiente radial por vértice · solid = color plano.
 * Materiales: [caras (vertexColors o sólido), pared lateral oscura].
 */
function volumeMesh(shape, depth, { grad, solid }) {
  /* bisel sutil: hace que cada pieza lea como un objeto 3D real (capta
     una arista de luz), no solo una extrusión recta con paredes planas —
     geometría pura, no toca ningún color exacto del brand book. */
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 3,
    bevelSize: 2.4,
    bevelSegments: 3,
    curveSegments: 48,
  });
  geo.translate(0, 0, -depth / 2);

  let capMat;
  if (grad) {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c0 = new THREE.Color(grad[0]);
    const c1 = new THREE.Color(grad[1]);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      const t = Math.min(1, Math.max(0, (r - GRAD_R0) / (GRAD_R1 - GRAD_R0)));
      c.copy(c0).lerp(c1, t);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    capMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true });
  } else {
    capMat = new THREE.MeshBasicMaterial({ color: solid, transparent: true });
  }
  const sideBase = new THREE.Color(solid ?? grad[1]).multiplyScalar(solid ? 0.42 : 0.9);
  const sideMat = new THREE.MeshBasicMaterial({ color: sideBase, transparent: true });
  return new THREE.Mesh(geo, [capMat, sideMat]);
}

/* contorno frontal del sector (trazo del brand book) */
function outline(ri, ro, a0deg, a1deg, hex, opacity, z) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) pts.push(posAt(a0deg + ((a1deg - a0deg) * i) / steps, ro));
  for (let i = steps; i >= 0; i--) pts.push(posAt(a0deg + ((a1deg - a0deg) * i) / steps, ri));
  pts.push(pts[0].clone());
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity })
  );
  line.position.z = z;
  return line;
}

/* malla PLANA e INVISIBLE, solo para raycasting — nunca se mueve, nunca
   se dibuja. El hover movía la pieza VISIBLE (fill) y also raycasteaba
   contra esa misma pieza: en cuanto se desplazaba lo suficiente (que es
   justo el pedido de "que se note"), el rayo del mouse dejaba de
   tocarla, el hover se apagaba, la pieza volvía a su lugar, el rayo
   volvía a tocarla, el hover se prendía de nuevo — un ciclo de
   retroalimentación que se ve como temblor. Esta malla queda fija en la
   posición de reposo (z=0, la de ExtrudeGeometry antes de cualquier
   transform) mientras la visible es libre de moverse. */
function hitProxy(shape) {
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  return new THREE.Mesh(geo, mat);
}

/* textura de degradado radial (blanco centro → transparente borde) para
   los sprites de resplandor — un solo canvas, reutilizado por las 9
   piezas vía CanvasTexture, nunca regenerado por pieza. */
function glowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const routeState = () => {
  const path = location.pathname.replace(/\/+$/, '') + '/';
  const edge = EDGES.find((e) => e.slug === path);
  if (edge) return { mode: 'service', edge };
  const phase = PHASES.find((p) => p.slug === path);
  if (phase) return { mode: 'phase', phase };
  return { mode: 'full' };
};
const sameState = (a, b) =>
  a.mode === b.mode &&
  (a.edge?.id ?? null) === (b.edge?.id ?? null) &&
  (a.phase?.id ?? null) === (b.phase?.id ?? null);

class EngineWheel {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.overlay = root.querySelector('[data-overlay]');
    this.anchors = new Map();
    this.tweens = [];
    this.hover = null;
    this.visible = true;
    this.stateRot = 0;
    this.tilt = 0;
    this.yaw = 0;
    this.build();
    this.bind();
    this.state = routeState();
    this.apply(this.state, true);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    /* fitWheelLabels() mide el ancho REAL de cada lockup para decidir si
       encoge --wheel-scale. Un solo disparo (fonts.ready, un resize()
       puntual) no es confiable: el ResizeObserver de bind() dispara su
       propia primera notificación muy temprano (a veces antes de que
       Geist Mono termine de cargar), y ese resize() cambia el tamaño de
       this.root — a lo que el MISMO observer reacciona con otra ronda,
       en una secuencia de reflows que no tiene un único punto "ya está,
       mide ahora" confiable (medido: "intelligence" se quedaba ~6px más
       ancho que su caja hasta que un resize() posterior, real, lo
       recalculaba).
       setInterval, NO requestAnimationFrame: colgarlo del loop() de
       render (rAF) lo ata al framerate REAL del WebGL — en un equipo con
       GPU lenta (o este entorno de prueba, medido: ~2 cuadros completos
       en 4 segundos por el costo del post-proceso de bloom) la ventana
       de asentamiento nunca alcanza a correr las veces suficientes para
       agarrar el layout ya con la fuente asentada. Un intervalo aparte
       corre en su propio reloj, sin depender de cuántos frames renderice
       Three.js. Nunca afloja respecto al mínimo ya visto (ver
       fitWheelLabels) — converge sola sin importar cuándo asiente la
       fuente, y se detiene sola a los 4s. */
    const settleTimer = setInterval(() => this.fitWheelLabels(), 120);
    setTimeout(() => clearInterval(settleTimer), 4000);
    this._settleUntil = performance.now() + 4000;
  }

  build() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    /* FOV 34→39: el BUFFER del DOM (ver resize()) le da aire a las
       ETIQUETAS, pero nunca puede evitar que la MALLA 3D (el gajo real)
       se corte contra el borde del canvas — eso lo decide solo el
       encuadre de la cámara, nada en el DOM. Medido con Playwright
       proyectando los 8 vértices del bounding box de cada sector a NDC
       durante el hover máximo: con FOV 34 los 6 edges se salían del
       canvas (hasta 9.8% del cuadro). Este margen de cámara (no un
       canvas más chico) es el "encuentra la forma de expandir el
       espacio... sin que la rueda desborde" que pidió el cliente — el
       canvas sigue siendo del mismo tamaño en el DOM (BUFFER=26 intacto),
       la rueda en reposo se ve marginalmente más chica (~14%) para
       dejarle aire real al hover, en vez de reducir el movimiento hasta
       hacerlo casi imperceptible. */
    this.camera = new THREE.PerspectiveCamera(39, 1, 10, 4000);
    this.camera.position.set(0, 90, 980);
    this.camera.lookAt(0, 0, 0);

    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.wheel = new THREE.Group();
    this.rig.add(this.wheel);

    this.parts = { sectors: {}, bands: {}, hub: null };
    this.glowTex = glowTexture();

    /* sprite de resplandor por pieza — luz de color propio "derramándose"
       detrás/debajo del bloque activo (referencia igloo.inc: los bloques
       iluminados bañan de luz la nieve/los bloques vecinos, no solo
       brillan ellos mismos). Aditivo (se suma a lo que hay detrás, nunca
       tapa) y con blend "screen"-like vía AdditiveBlending — no es texto
       ni relleno de marca, así que no lo alcanza R1.1/R6.1; es luz, no
       color de superficie. Hijo del propio grupo: se mueve/escala solo
       con hoverLift(), sin lógica de posición aparte. depthWrite:false
       para que nunca "tape" al resto de la rueda por z-fighting. */
    function makeGlow(color, tex) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      }));
      spr.scale.set(1, 1, 1);
      spr.position.set(0, -18, -46); // detrás (−Z) y hacia abajo (−Y local)
      spr.renderOrder = -1;
      return spr;
    }

    for (const edge of EDGES) {
      const phase = PHASES.find((p) => p.id === edge.phase);
      const a0 = edge.angle - 26, a1 = edge.angle + 26; // 60° − 4° de gap
      const shape = donutShape(96, 232, a0, a1);
      const g = new THREE.Group();
      const fill = volumeMesh(shape, DEPTH, { grad: GRADS[phase.id] });
      const rim = outline(96, 232, a0, a1, phase.color, 0.85, DEPTH / 2 + 1);
      const glowSprite = makeGlow(phase.color, this.glowTex);
      glowSprite.scale.set(260, 260, 1);
      g.add(fill, rim, glowSprite);
      g.userData = { kind: 'sector', edge, fill, rim, glowSprite };
      fill.userData = g.userData;
      this.wheel.add(g);
      this.parts.sectors[edge.id] = g;
      const hit = hitProxy(shape);
      hit.userData = { group: g };
      this.wheel.add(hit);
      g.userData.hit = hit;
      this.addAnchor('edge-' + edge.id, posAt(edge.angle, 168).setZ(DEPTH / 2 + 2), g);
      /* mismo trato que los nombres de fase (ver el bloque de bandas):
         el lockup del servicio es un <a> que CUBRE el centro del gajo y
         se queda con el pointer — el canvas deja de recibir pointermove
         ahí y el raycast de pick() nunca ve el punto más natural para
         tocar. Sin esto, el gajo solo reaccionaba al tocar su "carne"
         alrededor del nombre — en el hub (rediseño 2026-07-11, la rueda
         como único menú de servicios) eso dejaba el hover 3D
         prácticamente inalcanzable. */
      const edgeLabelEl = this.anchors.get('edge-' + edge.id)?.el;
      if (edgeLabelEl) {
        edgeLabelEl.addEventListener('pointerenter', () => {
          this._labelHover = g;
          this.activateHover(g);
        });
        /* A DIFERENCIA de los nombres de fase (que no se mueven), este
           label VIAJA con el gajo cuando el hover lo levanta (+40-70px
           proyectados) — se sale solo de abajo del cursor quieto. Si el
           leave soltara el hover directo, el ciclo es un temblor:
           levanta → el label se va → leave → baja → el label regresa →
           enter → levanta… Al salir HACIA EL CANVAS no se suelta nada:
           se actualiza this.pointer con la posición real del evento (el
           canvas no recibió pointermove mientras el label tuvo el
           pointer — sin esto pick() raycastearía una posición vieja) y
           pick() decide en el siguiente cuadro con el raycast de
           siempre: si el cursor sigue sobre la carne del gajo, el hover
           ni parpadea. Salidas hacia cualquier otro lado sí sueltan. */
        edgeLabelEl.addEventListener('pointerleave', (ev) => {
          this._labelHover = null;
          const r = this.canvas.getBoundingClientRect();
          this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
          if (ev.relatedTarget !== this.canvas) this.activateHover(null);
        });
      }
    }

    for (const phase of PHASES) {
      const a0 = phase.startAngle + 5, a1 = phase.startAngle + 115; // 120° − 5° de gap
      const shape = donutShape(248, 278, a0, a1);
      const g = new THREE.Group();
      const fill = volumeMesh(shape, BAND_DEPTH, { solid: phase.color });
      const rim = outline(248, 278, a0, a1, phase.color, 0.7, BAND_DEPTH / 2 + 1);
      const glowSprite = makeGlow(phase.color, this.glowTex);
      glowSprite.scale.set(320, 320, 1);
      g.add(fill, rim, glowSprite);
      g.userData = { kind: 'band', phase, fill, rim, glowSprite };
      fill.userData = g.userData;
      this.wheel.add(g);
      this.parts.bands[phase.id] = g;
      const hit = hitProxy(shape);
      hit.userData = { group: g };
      this.wheel.add(hit);
      g.userData.hit = hit;
      const center = phase.startAngle + 60;
      /* mismo radio para las 3: el anillo de fase termina en radio 278
         (donutShape(248,278,...) más arriba), así que 296 deja ~18
         unidades de separación visible entre el color de la rueda y el
         nombre — nunca se encima. El margen BUFFER en resize() es lo
         que permite que ese mismo radio no se corte contra el borde en
         ningún ángulo (antes competían por el mismo espacio). */
      const labelR = 296;
      this.addAnchor('phase-' + phase.id, posAt(center, labelR).setZ(BAND_DEPTH / 2 + 2), g);
      /* pedido explícito: el arco se ilumina igual al tocar el arco EN SÍ
         o su NOMBRE — el nombre vive a radio 296, fuera del anillo de
         color (que termina en 278) y del hit-proxy que raycastea pick(),
         así que sin esto tocar solo el texto nunca activaba nada. */
      const labelEl = this.anchors.get('phase-' + phase.id)?.el;
      if (labelEl) {
        labelEl.addEventListener('pointerenter', () => {
          this._labelHover = g;
          this.activateHover(g);
        });
        labelEl.addEventListener('pointerleave', () => {
          this._labelHover = null;
          this.activateHover(null);
        });
      }
    }

    /* hub 3D: cilindro Void + anillo #1A2A40 en la cara frontal */
    const hubG = new THREE.Group();
    const hubFill = new THREE.Mesh(
      new THREE.CylinderGeometry(84, 84, 24, 72).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0e0e12, transparent: true })
    );
    const hubPts = [];
    for (let i = 0; i <= 72; i++) hubPts.push(posAt(i * 5, 84));
    const hubRim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(hubPts),
      new THREE.LineBasicMaterial({ color: 0x1a2a40, transparent: true })
    );
    hubRim.position.z = 13;
    hubG.add(hubFill, hubRim);
    hubG.userData = { kind: 'hub', fill: hubFill, rim: hubRim };
    hubG.position.z = 4;
    this.wheel.add(hubG);
    this.parts.hub = hubG;
    this.addAnchor('hub', new THREE.Vector3(0, 0, 14), hubG);

    /* anillo punteado exterior — animación opcional permitida (README §07) */
    const ringPts = [];
    for (let i = 0; i <= 180; i++) ringPts.push(posAt(i * 2, 306));
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineDashedMaterial({ color: 0x34343c, dashSize: 6, gapSize: 10, transparent: true })
    );
    ring.computeLineDistances();
    this.rig.add(ring);
    this.ring = ring;

    /* pulso de activación (referencia real: igloo.inc — el anillo
       fragmentado emite un destello y ondas concéntricas al activarse,
       ver frames del video del cliente). 3 anillos finos que se
       expanden y desvanecen al hacer clic; color = el de la fase/edge
       elegido, nunca blanco puro (disciplina de un solo acento). */
    this.pulses = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(1, 1, 64),
        new THREE.MeshBasicMaterial({ color: 0x1e80f0, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      m.position.z = 40;
      m.visible = false;
      this.rig.add(m);
      return m;
    });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    /* bloom real (referencia igloo.inc: EffectComposer + UnrealBloomPass)
       — un cambio de brillo plano en MeshBasicMaterial nunca se va a ver
       como el halo/resplandor de la referencia, sin importar cuánto se
       suba el número: el bloom es lo que hace que un pixel brillante
       "sangre" luz hacia afuera. threshold alto a propósito: el trazo y
       la banda EN REPOSO ya son colores de marca bastante saturados, y
       si todo blooméa todo el tiempo se pierde el look plano de la
       marca — solo lo que cruza el brillo extra de hover/aliento
       ambiental (setLook multiplica el color por 1+glow) debe cruzar el
       umbral. Envuelto en try/catch: si por lo que sea falla en algún
       navegador, la rueda sigue funcionando sin bloom en vez de caer al
       fallback de lista estática (ver boot()). */
    try {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.9, 0.5, 0.64);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }

    this.resize();
  }

  addAnchor(key, localPos, parent) {
    const holder = new THREE.Object3D();
    holder.position.copy(localPos);
    parent.add(holder);
    const el = this.overlay.querySelector(`[data-anchor="${key}"]`);
    if (el) this.anchors.set(key, { obj: holder, el });
  }

  /* materiales de un grupo: opacidad + brillo conservando color base */
  /* setLook SOLO guarda la intención (opacidad/brillo de interacción —
     hover, foco de fase/servicio, tweens de apply()); paintAll() es
     quien de verdad escribe en los materiales, UNA vez por cuadro,
     combinando esa intención con el pulso ambiental y el oscurecido de
     "otra fase en foco" — repartir esas tres cosas en varios métodos
     que cada uno escribe directo al material (como antes) lleva a que
     el último en correr pise a los demás. */
  /* rimGlow es DISTINTO de glow a propósito: glow (relleno) lo usan
     tanto el hover como el foco de fase/servicio al navegar (targetsFor,
     valores 0.35/0.55/0.65 ya calibrados desde antes de esta sesión).
     rimGlow (trazo) es SOLO del hover — si el trazo también subiera de
     color con el glow de navegación, esos mismos valores (pensados para
     un simple cambio de opacidad, sin bloom) ahora cruzarían el umbral
     de bloom igual que el hover y la página de un servicio individual
     (rueda ya enfocada/ampliada en esa pieza) se vería como una esfera
     brillante irreconocible en vez del gajo real — pasó, se detectó en
     capturas y se corrigió separando esto. */
  setLook(group, { op, glow, rimGlow = 0 }) {
    group.userData.opBase = op;
    group.userData.glowBase = glow;
    group.userData.rimGlowBase = rimGlow;
    group.visible = op > 0.01;
  }

  /* pinta los materiales reales de TODOS los sectores/bandas, una vez
     por cuadro, combinando tres capas sobre la intención (opBase/glowBase
     de setLook):
       · aliento ambiental (breath) — el trazo respira aun en reposo
         (referencia igloo.inc), nunca el color de relleno (R6.1).
       · brillo de interacción (glowBase en el relleno, rimGlowBase en el
         trazo — ver nota arriba de por qué van separados).
       · oscurecido de fase — al pasar el mouse sobre una BANDA (fase),
         todo lo que no sea de esa fase (las otras 2 bandas + sus
         sectores) se atenúa; nunca al pasar sobre un SECTOR (servicio),
         que no oscurece al resto. */
  paintAll(breath) {
    const hoveredPhase = this.hover?.userData.kind === 'band' ? this.hover.userData.phase.id : null;
    const groups = [...Object.values(this.parts.sectors), ...Object.values(this.parts.bands), this.parts.hub];
    for (const g of groups) {
      const { fill, rim, kind } = g.userData;
      const op = g.userData.opBase ?? 1;
      const glow = g.userData.glowBase ?? 0;

      const belongs = kind === 'hub' || !hoveredPhase || (kind === 'band' ? g.userData.phase.id === hoveredPhase : g.userData.edge.phase === hoveredPhase);
      const dimTarget = hoveredPhase && !belongs ? 1 : 0;
      const dimCur = g.userData.dimT ?? 0;
      const dimNext = dimCur + (dimTarget - dimCur) * 0.12;
      g.userData.dimT = dimNext;
      const dim = 1 - dimNext * 0.65;

      const mats = Array.isArray(fill.material) ? fill.material : [fill.material];
      if (!g.userData.base) g.userData.base = mats.map((m) => m.color.clone());
      mats.forEach((m, i) => {
        m.opacity = op * dim;
        m.color.copy(g.userData.base[i]).multiplyScalar(1 + glow);
      });

      const rimGlow = g.userData.rimGlowBase ?? 0;
      const rimBase = kind === 'band' ? 0.7 : kind === 'sector' ? 0.85 : 1;
      rim.material.opacity = op * rimBase * breath * dim;
      if (!rim.userData.baseColor) rim.userData.baseColor = rim.material.color.clone();
      rim.material.color.copy(rim.userData.baseColor).multiplyScalar(1 + rimGlow);

      g.visible = op > 0.01;
    }
  }

  bind() {
    addEventListener('resize', () => this.resize(), { passive: true });
    /* el ancho Y el alto disponibles también cambian por layout (p. ej.
       la columna de texto junto a la rueda), no solo por el viewport —
       ResizeObserver cubre ambos casos y garantiza que nunca haga falta
       scroll. Se observa this.root (no su padre): como es una isla
       persistida (transition:persist), el padre cambia en cada
       navegación entre páginas y un observer fijado sobre el padre
       original quedaría obsoleto; observar el propio nodo persistido
       sigue siendo válido sin importar dónde quede reinsertado. resize()
       vuelve a fijar el mismo tamaño cuando no hay cambio real, así que
       no genera un bucle: solo una llamada extra, no infinita. */
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => this.resize()).observe(this.root);
    }

    this.canvas.addEventListener('pointermove', (ev) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.parallax = { x: this.pointer.y * 0.16, y: this.pointer.x * 0.22 };
    });
    /* al quitar el mouse, el parallax vuelve a 0 — el loop() ya suaviza
       hacia (this.tilt + parallax) cada frame, así que esto solo basta
       para que la rueda regrese sola a la posición de frente. */
    this.canvas.addEventListener('pointerleave', () => {
      this.parallax = { x: 0, y: 0 };
      /* pick() decide a quién resaltar con el puntero 3D (raycaster)
         proyectado desde this.pointer — al salir el mouse del canvas ya
         no llegan más pointermove, así que this.pointer se queda con la
         ÚLTIMA posición conocida y, sin este aviso, pick() seguiría
         "viendo" hover ahí para siempre (el sector se quedaría
         levantado y brillando aunque el mouse ya no esté encima). */
      if (this.hover) {
        const st = this.targetsFor(this.state).items;
        this.setLook(this.hover, {
          op: (Array.isArray(this.hover.userData.fill.material) ? this.hover.userData.fill.material[0] : this.hover.userData.fill.material).opacity,
          glow: st.get(this.hover)?.glow ?? 0,
        });
        this.hover = null;
        this.canvas.style.cursor = 'default';
      }
    });

    this.canvas.addEventListener('click', () => {
      if (this.hover) this.go(this.hover.userData);
    });

    /* SIEMPRE la ÚLTIMA entrada del lote, nunca la primera: el observer
       entrega las notificaciones pendientes agrupadas en un solo
       callback, y al aterrizar en /#engine la inicial ("no visible",
       medida antes del scroll automático) y la real ("visible") pueden
       llegar juntas — destructurar [en] tomaba la VIEJA y descartaba la
       nueva, this.visible quedaba en falso con la rueda en pantalla y
       loop() no volvía a renderizar jamás: rueda congelada (sin 3D, sin
       glow, sin respiración) en ~la mitad de los regresos desde un
       servicio, al azar del timing (bug reportado 2026-07-13, matriz de
       reproducción: 6 servicios × 2 rondas). */
    const io = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
    });
    io.observe(this.root);

    this.overlay.querySelectorAll('a[data-anchor]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const key = a.dataset.anchor;
        if (key.startsWith('edge-')) this.go({ kind: 'sector', edge: EDGES.find((e) => 'edge-' + e.id === key) });
        else if (key.startsWith('phase-')) this.go({ kind: 'band', phase: PHASES.find((p) => 'phase-' + p.id === key) });
      });
    });
  }

  go(data) {
    if (!data || this.busy) return;
    let target, url, color;
    if (data.kind === 'sector') {
      target = { mode: 'service', edge: data.edge };
      url = data.edge.slug;
      color = PHASES.find((p) => p.id === data.edge.phase).color;
    } else if (data.kind === 'band') {
      target = { mode: 'phase', phase: data.phase };
      url = data.phase.slug;
      color = data.phase.color;
    } else return;
    if (sameState(target, this.state) || REDUCED) { navigate(url); return; }
    this.busy = true;
    if (!REDUCED) this.pulseBurst(color);
    this.apply(target, false, () => { this.busy = false; });
    setTimeout(() => navigate(url), 560);
  }

  /**
   * Pulso de activación al elegir una fase/servicio — el anillo emite un
   * destello y ondas concéntricas que se expanden y desvanecen (referencia
   * real: video de igloo.inc que compartió el cliente). Color = el de la
   * fase/edge elegido, nunca blanco puro.
   */
  pulseBurst(hex) {
    const c = new THREE.Color(hex);
    this.pulses.forEach((m, i) => {
      m.material.color.copy(c);
      m.userData.t0 = performance.now() + i * 90; // ondas escalonadas
      m.userData.active = true;
      m.visible = true;
    });
  }

  stepPulses(now) {
    for (const m of this.pulses) {
      if (!m.userData.active) continue;
      const k = (now - m.userData.t0) / 650;
      if (k < 0) continue;
      if (k >= 1) { m.userData.active = false; m.visible = false; continue; }
      const e = masterEase(k);
      const r = 24 + e * 320;
      m.geometry.dispose();
      m.geometry = new THREE.RingGeometry(r, r + 2.2, 64);
      m.material.opacity = (1 - e) * 0.8;
    }
  }

  targetsFor(state) {
    /* Reposo = de frente al observador (como la referencia plana del brand
       book); el volumen 3D se lee por la extrusión y la luz, no por el
       ángulo. El tilt pronunciado es una REACCIÓN — al pasar el mouse
       (parallax) o durante el giro de una elección — nunca la posición fija. */
    const t = { rot: 0, scale: 1, spin: 0, offY: 0, tilt: 0, yaw: 0, items: new Map() };
    const set = (g, v) => t.items.set(g, v);

    if (state.mode === 'full') {
      for (const e of EDGES) set(this.parts.sectors[e.id], { op: 1, fly: 0, lift: 0, glow: 0 });
      for (const p of PHASES) set(this.parts.bands[p.id], { op: 1, fly: 0, lift: 0, glow: 0 });
      set(this.parts.hub, { op: 1, fly: 0, lift: 0, glow: 0 });
      t.ringOp = 1;
    } else if (state.mode === 'phase') {
      const pid = state.phase.id;
      t.rot = (state.phase.startAngle + 60) * D2R;
      t.spin = Math.PI * 2;
      t.scale = 1.1;
      t.offY = -150;
      t.tilt = -0.09;
      t.yaw = 0.04;
      for (const e of EDGES) {
        const mine = e.phase === pid;
        set(this.parts.sectors[e.id], mine
          ? { op: 1, fly: 0, lift: 24, glow: 0.55 }
          : { op: 0, fly: 420, lift: -40, glow: 0 });
      }
      for (const p of PHASES) {
        set(this.parts.bands[p.id], p.id === pid
          ? { op: 1, fly: 0, lift: 24, glow: 0.35 }
          : { op: 0, fly: 460, lift: -40, glow: 0 });
      }
      set(this.parts.hub, { op: 0, fly: 0, lift: -160, glow: 0 });
      t.ringOp = 0.35;
    } else {
      const edge = state.edge;
      t.rot = edge.angle * D2R;
      t.spin = Math.PI * 2;
      t.scale = 1.16;
      t.offY = -130;
      t.tilt = -0.09;
      t.yaw = 0.04;
      for (const e of EDGES) {
        const sel = e.id === edge.id;
        set(this.parts.sectors[e.id], sel
          ? { op: 1, fly: 0, lift: 60, glow: 0.65 }
          : { op: 0, fly: 480, lift: -60, glow: 0 });
      }
      for (const p of PHASES) set(this.parts.bands[p.id], { op: 0, fly: 460, lift: -50, glow: 0 });
      set(this.parts.hub, { op: 0, fly: 0, lift: -160, glow: 0 });
      t.ringOp = 0.25;
    }
    return t;
  }

  apply(state, instant, done) {
    this.state = state;
    /* hover (mover/iluminar al pasar el mouse) es EXCLUSIVO del modo
       'full' (rueda completa, home) — 'phase'/'service' tienen su
       propio zoom/encuadre y nunca pidieron reacción de hover. Sin este
       reset, un hover que quedó activo justo antes de navegar (o el
       raycast por defecto en el centro del canvas, ver pick()) se
       congelaba en su valor — sprite de luz al 85% incluido — y quedaba
       pegado sobre la pieza ya enfocada/ampliada por el zoom de esas
       páginas, viéndose como una esfera brillante en vez del gajo real. */
    if (state.mode !== 'full') {
      this.hover = null;
      const groups = [...Object.values(this.parts.sectors), ...Object.values(this.parts.bands)];
      for (const g of groups) {
        g.userData.hoverT = 0;
        if (g.userData.glowSprite) g.userData.glowSprite.material.opacity = 0;
      }
    }
    /* En el hub de fase el nombre de la fase ya es el título H1 de la
       página — repetirlo en la banda de la rueda era redundante (pedido
       explícito 2026-07-11). En modo 'phase' la banda visible pasa a
       decir "Conoce más:" (invitación a tocar los edges: la rueda es el
       menú de servicios del hub); en cualquier otro modo recupera su
       nombre real desde el markup original. Solo cambia el TEXTO del
       label DOM — geometría, posición y movimiento quedan intactos. */
    for (const p of PHASES) {
      const label = this.anchors.get('phase-' + p.id)?.el;
      if (!label) continue;
      if (!label.dataset.phaseLabel) label.dataset.phaseLabel = label.textContent;
      label.textContent = state.mode === 'phase' ? 'Elige un servicio:' : label.dataset.phaseLabel;
    }
    this.root.dataset.mode = state.mode;
    this.root.dataset.focus = state.mode === 'phase' ? state.phase.id : state.mode === 'service' ? state.edge.id : '';
    const t = this.targetsFor(state);
    this.tilt = t.tilt;
    this.yaw = t.yaw;

    const jobs = [];
    for (const [g, v] of t.items) {
      const dir = g.userData.edge
        ? posAt(g.userData.edge.angle, 1)
        : g.userData.phase
          ? posAt(g.userData.phase.startAngle + 60, 1)
          : new THREE.Vector3(0, 0, 0);
      const baseZ = g.userData.kind === 'hub' ? 4 : 0;
      jobs.push({
        g,
        from: {
          op: (Array.isArray(g.userData.fill.material) ? g.userData.fill.material[0] : g.userData.fill.material).opacity,
          glow: g.userData.glow ?? 0,
          x: g.position.x, y: g.position.y, z: g.position.z,
        },
        to: { op: v.op, glow: v.glow, x: dir.x * v.fly, y: dir.y * v.fly, z: baseZ + v.lift },
      });
    }
    const fromRot = this.wheel.rotation.z;
    const toRot = t.rot + (instant ? 0 : t.spin);
    const fromScale = this.wheel.scale.x;
    const fromRing = this.ring.material.opacity;
    const fromOffY = this.rig.position.y;

    const put = (k) => {
      for (const j of jobs) {
        j.g.visible = true;
        this.setLook(j.g, {
          op: j.from.op + (j.to.op - j.from.op) * k,
          glow: j.from.glow + (j.to.glow - j.from.glow) * k,
        });
        j.g.position.set(
          j.from.x + (j.to.x - j.from.x) * k,
          j.from.y + (j.to.y - j.from.y) * k,
          j.from.z + (j.to.z - j.from.z) * k
        );
      }
      this.wheel.rotation.z = fromRot + (toRot - fromRot) * k;
      this.wheel.scale.setScalar(fromScale + (t.scale - fromScale) * k);
      this.ring.material.opacity = fromRing + (t.ringOp - fromRing) * k;
      this.rig.position.y = fromOffY + (t.offY - fromOffY) * k;
    };

    const finish = () => {
      this.wheel.rotation.z = t.rot;
      this.stateRot = t.rot;
      for (const j of jobs) {
        j.g.visible = j.to.op > 0.01;
        /* posición de reposo — la base sobre la que loop() suma el
           levante de hover (ver hoverLift()). Solo se actualiza acá,
           cuando una transición de estado termina; mientras el hover es
           puramente una animación continua sobre esa base, nunca la
           reemplaza. */
        j.g.userData.restZ = j.g.position.z;
        j.g.userData.restX = j.g.position.x;
        j.g.userData.restY = j.g.position.y;
      }
    };

    if (instant || REDUCED) {
      put(1);
      finish();
      done && done();
      return;
    }

    const t0 = performance.now();
    const DUR = 900;
    this.tweens = [{
      step: (now) => {
        const k = masterEase(Math.min(1, (now - t0) / DUR));
        put(k);
        if (k >= 1) {
          finish();
          this.tweens = [];
          done && done();
        }
      },
    }];
  }

  resize() {
    /* La rueda SIEMPRE cabe entera, nunca requiere scroll ni horizontal
       ni vertical: el ancho se ajusta al ancho REAL del contenedor
       (min(referencia, contenedor)); cuando fitHeight está activo (el
       split de dos columnas del home) TAMBIÉN se limita al alto real
       disponible, para garantizar que la rueda nunca empuje la sección
       más allá de una pantalla. `fitScale` (real/referencia) reescala
       las etiquetas overlay proporcionalmente en projectLabels(), así
       el conjunto se ve consistente a cualquier tamaño — nunca cada
       etiqueta por separado.

       BUFFER: .wheel-stage (el elemento con overflow:hidden) es MÁS
       GRANDE que el canvas por este margen a cada lado — así las
       etiquetas de fase tienen un carril propio entre el anillo de la
       rueda y el borde de recorte: nunca se encima el nombre sobre el
       color de la rueda (necesita separarse del anillo) y nunca se
       corta contra el borde (necesita quedar dentro del recorte). Sin
       este margen ambos requisitos compiten por los mismos pocos
       píxeles.

       VALOR ORIGINAL (26), no lo subas: esta cifra se resta del ancho
       real disponible ANTES de calcular el tamaño del canvas (ver
       availW abajo) — en la columna del home (ancho fijo, sin espacio
       de sobra) cualquier aumento aquí se traduce directo en una rueda
       más chica. Se probó subirlo a 70 para darle lugar al desprendimiento
       agresivo de hover, y aunque evitó el corte, redujo la rueda entera
       (~15% en 1400px) — el cliente pidió explícitamente que el tamaño
       original nunca se toque. La solución real fue la otra punta:
       HOVER_OUT/HOVER_LIFT_Z/HOVER_SCALE se recalibraron hacia abajo
       (ver arriba) para que el desplazamiento máximo quepa DENTRO de
       este margen original — medido con Playwright en los 6 edges, cero
       píxeles de excedente contra el borde de recorte. */
    /* MÓVIL (pedido 2026-07-15: rueda del home ≥30% mayor y abanico de
       los hubs mucho mayor): en ≤900px el margen se reduce — ahí no hay
       hover que desborde (sin puntero fino) y cada píxel de margen se
       descuenta de una rueda ya apretada por el viewport. En escritorio
       queda el 26 original medido contra el desprendimiento de hover. */
    const mobile = matchMedia('(max-width: 900px)').matches;
    const routeMode = routeState().mode;
    const compact = routeMode !== 'full';
    const BUFFER = mobile ? (compact ? 1 : 4) : 26;
    this.root.dataset.compact = compact ? '1' : '0';
    /* 820→900 en modo full: pedido explícito de +30% de tamaño de rueda
       ("intento 20", visibilidad). Este techo por sí solo no la hace más
       grande — solo deja de ser el freno; el layout real (wheel-card en
       index.astro, ahora 920×920) es lo que le da el espacio real para
       llegar a los ~868px de canvas (668px anterior +30%). Modo compacto
       (mini-rueda de /engine/[fase]/) no se tocó — no es a lo que se
       refería este pedido. */
    const refW = compact ? 620 : 900;
    const refH = compact ? 560 : 900;
    const parent = this.root.parentElement;
    const availW = (parent?.clientWidth || refW) - BUFFER * 2;
    /* refW sigue siendo la REFERENCIA de proporciones (fitScale = w/refW
       reescala las etiquetas), pero como TOPE solo aplica fuera de los
       hubs de fase: ahí el cliente pidió la rueda-menú un 59% más grande
       que la palabra del título, muy por encima de los 620 de referencia
       compacta, y el tamaño lo fija el carril .hub-wheel (CSS puro).
       Decidirlo por RUTA (routeState) y no por atributo es deliberado:
       los data-attrs viajan pegados a la isla persistente entre páginas
       y producirían tamaños distintos según el camino de llegada — el
       bug de aterrizaje ya corregido. En /servicios/ (mode 'service') y
       en el home el tope queda exactamente como estaba. */
    /* En el home (modo 'full') el tope sube a 1170 (900 × 1.3): pedido
       explícito de una rueda 30% más grande. refW se queda en 900 como
       referencia de proporciones a propósito — fitScale = w/refW > 1
       agranda las etiquetas en la MISMA proporción que el anillo, en vez
       de dejar los nombres al tamaño viejo sobre una rueda más grande. */
    const capW = routeMode === 'phase' ? 1400 : routeMode === 'full' ? 1170 : refW;
    let w = Math.max(1, Math.min(availW, capW));
    /* el límite por alto SOLO aplica en el layout de dos columnas (>900px,
       mismo corte que el media query de .engine-split): en la columna
       apilada de móvil, .engine-col-wheel pasa a height:auto — un % de
       alto contra un ancestro auto no resuelve a nada usable (colapsa al
       tamaño por defecto del <canvas>, ~300×150), así que ahí la rueda
       vuelve a dimensionarse solo por ancho, como siempre lo hizo.
       Decidido por RUTA (routeMode === 'full', que solo existe en el
       home), NUNCA por data-fit-height: ese atributo viaja pegado a la
       isla persistente (transition:persist no re-renderiza atributos),
       así que al REGRESAR al home desde un hub de fase llegaba apagado
       ('0', el valor del hub) y el límite por alto no corría — la rueda
       volvía más grande que el alto disponible y cortada por abajo
       (medido: 868px de canvas donde el alto solo permite 732 a 900 de
       viewport). El mismo bug de "tamaño según el camino de llegada" ya
       corregido en capW, ahora en el alto. */
    if (routeMode === 'full' && matchMedia('(min-width: 901px)').matches) {
      const availH = (parent?.clientHeight || refH) - BUFFER * 2;
      if (availH > 0) w = Math.max(1, Math.min(w, availH * (refW / refH)));
    }
    const h = Math.round(w * (refH / refW));
    this.root.style.width = w + BUFFER * 2 + 'px';
    this.root.style.height = h + BUFFER * 2 + 'px';
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.overlay.style.width = w + 'px';
    this.overlay.style.height = h + 'px';
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.bloomPass?.setSize(w, h);
    }
    this.fitScale = w / refW;
    this.fitWheelLabels();
  }

  /**
   * Fija --wheel-scale (LockupMark.astro la referencia pero nada la
   * calculaba — quedaba en su valor por defecto, 1, siempre). Sin esto,
   * una palabra larga como "intelligence" desborda la caja fija de
   * .wl-edge (118px/96px compacto, white-space:nowrap, sin encoger):
   * el elemento se sigue centrando por su caja ORIGINAL de 118px (el
   * translate(-50%,-50%) de projectLabels no sabe nada del desborde),
   * así que el texto visible queda descentrado respecto a su ancla real.
   * Una sola escala compartida para los 6 edges (+ el hub, mismo --var)
   * — nunca cada lockup encogido por separado, se verían inconsistentes
   * entre sí. */
  fitWheelLabels() {
    const compact = this.root.dataset.compact === '1';
    /* 118→160 (96→130 en compacto): pedido explícito de subir el tamaño
       de los lockups reveló un bug real — esta caja de referencia NUNCA
       creció junto con el font-size en los +20%/+25% pedidos, así que
       --wheel-scale (el seguro contra desbordes) terminaba encogiendo
       el texto EXACTAMENTE lo que el font-size había crecido, dejando
       el tamaño renderizado igual o peor que antes (medido y probado
       matemáticamente: 27px de fuente con esta caja sin tocar daba el
       mismo resultado visual que 21.6px). 160px es el máximo seguro
       medido con Playwright — el ángulo real entre dos edges vecinos a
       este radio da ~234px de arco de referencia disponible antes de
       que se toquen; 160px deja ~30% de aire real entre etiquetas
       vecinas, no un número arbitrario. Debe coincidir siempre con
       .wl-edge { width } en EngineWheel.astro — esta caja es la MISMA
       que ese ancho fijo, no una independiente. */
    /* ×1.2 en modo full (164→197): pedido explícito 2026-07-12 de
       lockups de servicio 20% mayores. La caja crece EXACTAMENTE en la
       misma proporción que el font-size (ver .wl-edge y el bloque de
       fuentes en EngineWheel.astro) — si solo creciera la fuente, este
       seguro contra desbordes la encogería de vuelta (el bug ya
       documentado arriba); si solo creciera la caja, no crecería nada.
       197 sigue bajo los ~234px de arco disponible entre vecinos
       medidos arriba. El compacto (133) NO crece: en la mini-rueda del
       hub "intelligence" a +20% se salía de su gajo (verificado en
       captura) y el pedido exige no exceder el espacio. */
    const edgeBox = compact ? 133 : 197;
    /* 148→180: mismo bug que edgeBox arriba, esta vez con el hub como
       el nuevo cuello de botella una vez destrabado el de los edges
       (medido: --wheel-scale se quedó clavado en 0.7474 al seguir
       subiendo edgeBox, porque el hub — que nunca se tocó — pasó a ser
       la caja más angosta). El círculo del hub mide ~223px de diámetro
       en unidades de referencia (medido con Playwright, proyectando el
       radio real de la malla 3D del hub); 180px deja margen real dentro
       de ese círculo, no lo llena de borde a borde. */
    const hubBox = 180;
    /* Medir CON el transform real puesto (nunca anularlo): un mismo
       texto, bajo un CSS transform:scale(), puede rasterizarse con un
       ancho ligeramente distinto al que mide sin transform — hinting de
       subpíxel a distinta escala efectiva, no error de cálculo (medido:
       "intelligence" a transform:none daba 172.4px estables, pero la
       página YA RENDERIZADA con su transform real siempre medía 183.4px
       — 6.4% de diferencia real, no ruido). Anular el transform para
       "medir limpio" mide algo que la página nunca muestra así. En vez
       de eso: solo se anula --wheel-scale (a 1, para no medir un
       encogimiento previo aplicado sobre sí mismo) y la caja de
       referencia se ajusta por fitScale — así SIEMPRE se mide bajo el
       mismo contexto de transform (translate+scale(fitScale) del ancla,
       intacto) que el usuario realmente ve. */
    const fit = this.fitScale || 1;
    /* CONTEXTO DE MEDICIÓN DETERMINISTA: la medición de abajo asume que
       el ancla ya tiene su transform de proyección (translate +
       scale(fitScale)) — ver el comentario anterior. Pero en una isla
       RECIÉN RECONSTRUIDA (regreso desde un landing de servicio) con la
       rueda fuera de pantalla, loop() no corre y projectLabels() jamás
       había puesto ese transform: se medía el lockup SIN escala de
       ancla, el candado de asentamiento congelaba esa medición
       inconsistente y las etiquetas quedaban de tamaño equivocado y
       corridas a la izquierda (transform-origin: left) — bug reportado
       con captura 2026-07-13. Proyectar SIEMPRE antes de medir hace el
       contexto idéntico en todos los caminos: visible u oculto, isla
       persistida o reconstruida. */
    this.projectLabels();
    /* FACTOR DE ANCESTRO: initCosmosScroll (index.astro) escala la
       tarjeta de la rueda entre 0.94 (bajo el pliegue) y 1.0 (a la
       vista) — y getBoundingClientRect hereda ese zoom. Una medición
       hecha con la rueda fuera de pantalla salía 6.4% más angosta
       (1/0.94) que la misma medición a la vista, el candado de
       asentamiento congelaba ese valor y las etiquetas quedaban de
       tamaño equivocado según el CAMINO de llegada (bug reportado con
       captura 2026-07-13 — este mismo 6.4% es el que un comentario
       anterior atribuía a rasterización de subpíxel). Dividir lo medido
       entre la escala real del ancestro deja todas las mediciones en el
       mismo espacio, llegue por donde llegue y esté donde esté. */
    const anc = this.root.offsetWidth
      ? this.root.getBoundingClientRect().width / this.root.offsetWidth
      : 1;
    const anchors = [...this.overlay.querySelectorAll('.wl-edge'), this.overlay.querySelector('.wl-hub')].filter(Boolean);
    this.root.style.setProperty('--wheel-scale', 1);
    /* mismo reset para la variable propia del hub: sin él, el hub se
       mediría con su encogimiento anterior ya aplicado (encogimiento
       sobre sí mismo — el mismo bug que el reset de arriba evita). */
    this.root.style.setProperty('--wheel-scale-hub', 1);

    let scale = 1;
    for (const a of anchors) {
      const lm = a.querySelector('.lm-wheel');
      if (!lm) continue;
      const box = (a.classList.contains('wl-hub') ? hubBox : edgeBox) * fit;
      const w = lm.getBoundingClientRect().width / (anc || 1);
      if (w > box) scale = Math.min(scale, box / w);
    }
    /* durante la ventana de asentamiento (ver constructor) esta función
       se llama muchas veces porque NO hay un solo punto confiable
       "ya cargó todo, mide ahora" (fonts.ready puede resolver antes de
       que el navegador termine de reflowar los lockups con la fuente ya
       cargada). Por eso, SOLO mientras la ventana sigue abierta, nunca
       se afloja respecto al mínimo ya visto — si una corrida más
       adelantada mide más angosto (fuente ya asentada), gana esa; si una
       corrida más floja llegara después por casualidad, no puede pisar
       la más angosta ya encontrada. Terminada la ventana, un resize()
       real (el usuario cambiando el viewport) SÍ debe recalcular libre,
       sin este candado — por eso no se aplica fuera de la ventana. */
    if (this._settleUntil && performance.now() < this._settleUntil) {
      scale = Math.min(scale, this._settleTightest ?? 1);
      this._settleTightest = scale;
    }
    this.root.style.setProperty('--wheel-scale', scale);
    /* El lockup del HUB central NO es un servicio y el pedido de +20%
       (2026-07-12) fue SOLO para los 6 lockups de servicio. Pero la
       escala es una variable compartida: al crecer edgeBox 164→197 la
       escala global se afloja ×(197/164) y el hub — cuyo tamaño nadie
       pidió tocar — crecería el mismo 20% de rebote. Su propia variable
       (--wheel-scale-hub, ver EngineWheel.astro) reproduce EXACTAMENTE
       la escala que le tocaba con la caja anterior: scale × 164/197
       deshace el aflojamiento para él solo (en compacto la caja no
       cambió — factor 1, todo queda como estaba), y el techo de hubBox
       sigue aplicando igual que siempre. */
    const hubRatio = compact ? 1 : 164 / 197;
    this.root.style.setProperty('--wheel-scale-hub', Math.min(scale * hubRatio, 1));
  }

  projectLabels() {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    const fit = this.fitScale || 1;
    for (const [, { obj, el }] of this.anchors) {
      obj.getWorldPosition(v);
      v.project(this.camera);
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px) scale(${fit})`;
    }
  }

  pick(now) {
    if (!this.pointer) return;
    /* mientras el mouse está sobre la ETIQUETA de una fase (nombre
       "EVALUACIÓN"/etc.), el canvas ya no recibe pointermove (la
       etiqueta, un <a>, se lo queda) — this.pointer se congela en la
       última posición real sobre el canvas. Sin este freno, el raycast
       de ESE punto viejo (que puede no coincidir con nada, o con otra
       pieza) pisaría cada cuadro el hover que puso activateHover() vía
       el listener de la etiqueta. */
    if (this._labelHover) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    /* raycastea contra las mallas planas ESTÁTICAS (hit), nunca contra
       las piezas visibles (fill) — esas las mueve hoverLift() cada
       cuadro; detectar hover contra un blanco que el propio hover
       desplaza es un ciclo de retroalimentación (se ve como temblor:
       toca → se mueve → deja de tocar → vuelve → vuelve a tocar…). */
    const targets = [];
    for (const id in this.parts.sectors) targets.push(this.parts.sectors[id].userData.hit);
    for (const id in this.parts.bands) targets.push(this.parts.bands[id].userData.hit);
    const hits = this.raycaster
      .intersectObjects(targets, false)
      .filter((h) => h.object.userData.group.visible);
    const top = hits[0]?.object.userData.group ?? null;
    /* histéresis: el candidato tiene que sostenerse HOVER_DWELL_MS antes
       de volverse this.hover de verdad. Sin esto, la frontera entre dos
       piezas vecinas (p. ej. "readiness"/"flow"/banda capacidades, que
       se tocan en una esquina) hace que un temblor normal del mouse
       humano dispare varios cambios de hover por segundo; como el brillo
       aditivo de cada pieza tarda varios cuadros en apagarse (la misma
       curva que tarda en encender), dos o tres piezas vecinas quedaban
       con brillo simultáneo y sus luces (aditivas) se sumaban — esta
       parte del bug era la misma en las 3 fases. Aparte de esto (ver
       PHASE_GLOW_FACTOR arriba) el cian de Capacidades SÍ necesita su
       propio valor, más bajo: incluso sin flicker, el mismo glow
       numérico cruza el umbral de bloom mucho más fuerte en cian que en
       ámbar/magenta por la luminancia del color en sí — dos causas
       distintas de la misma "explosión de luz", ambas confirmadas por
       separado con captura. */
    if (top !== this._pendingHover) {
      this._pendingHover = top;
      this._pendingSince = now;
    }
    const settled = top === this.hover || now - (this._pendingSince ?? 0) >= HOVER_DWELL_MS;
    if (top !== this.hover && settled) this.activateHover(top);
  }

  /* aplica de verdad el cambio de this.hover — la usan tanto pick()
     (raycast sobre el canvas) como los listeners de las ETIQUETAS de
     fase (pointerenter/pointerleave en el nombre "EVALUACIÓN"/etc.):
     pedido explícito del cliente, el arco debe iluminarse igual al
     tocar el propio arco O su nombre, no solo el arco. */
  activateHover(top) {
    if (top === this.hover) return;
    const st = this.targetsFor(this.state).items;
    const opOf = (g) => st.get(g)?.op ?? 1;
    const glowOf = (g) => st.get(g)?.glow ?? 0;
    if (this.hover) this.setLook(this.hover, { op: opOf(this.hover), glow: glowOf(this.hover) });
    this.hover = top;
    if (top) {
      const isBand = top.userData.kind === 'band';
      const base = isBand ? BAND_HOVER_GLOW : HOVER_GLOW;
      const factor = isBand ? (PHASE_GLOW_FACTOR[top.userData.phase.id] ?? 1) : 1;
      const g = base * factor;
      this.setLook(top, { op: opOf(top), glow: glowOf(top) + g, rimGlow: g });
    }
    this.canvas.style.cursor = top ? 'pointer' : 'default';
  }

  /* referencia real (igloo.inc, video del cliente): al pasar el mouse
     sobre un bloque, ese bloque se despega/levanta levemente ADEMÁS de
     iluminarse — nunca todos a la vez ni por un temporizador propio,
     solo el que está bajo el cursor en ese momento (confirmado viendo
     el cursor en los frames del video, siempre parado junto a los
     bloques activos). Continuo, no un tween de estado — por eso corre
     aparte del sistema de tweens de apply()/put() y se apoya en
     restZ (la posición de reposo que finish() graba) en vez de pisarla:
     mientras hay un tween activo, put() ya controla position.z, así que
     esta pasada se salta por completo (mismo guard que this.pick()). */
  hoverLift(now) {
    const dt = Math.min(0.05, (now - (this._lastHoverT ?? now)) / 1000);
    this._lastHoverT = now;
    const groups = [...Object.values(this.parts.sectors), ...Object.values(this.parts.bands)];
    for (const g of groups) {
      const target = g === this.hover ? 1 : 0;
      const cur = g.userData.hoverT ?? 0;
      /* suavizado independiente del framerate (a diferencia de otros
         "* 0.06" del loop, que asumen ~60fps) — el hover puede quedar
         mucho tiempo en su valor estable, así que una tasa constante
         por cuadro se nota más si el frame rate varía. */
      const next = cur + (target - cur) * (1 - Math.pow(0.00005, dt));
      g.userData.hoverT = next;
      /* pedido explícito del cliente: los arcos de FASE (bandas) y sus
         nombres NUNCA se mueven de lugar — solo brillan (paintAll ya lo
         cubre vía glowBase) y apagan al resto de la rueda (dim, también
         en paintAll). El desprendimiento físico (salida + avance +
         escala) es EXCLUSIVO de los segmentos de SERVICIO (sectores). */
      if (g.userData.kind === 'sector') {
        const restZ = g.userData.restZ ?? g.position.z;
        const restX = g.userData.restX ?? g.position.x;
        const restY = g.userData.restY ?? g.position.y;
        const dir = posAt(g.userData.edge.angle, 1);
        g.position.set(
          restX + dir.x * next * HOVER_OUT,
          restY + dir.y * next * HOVER_OUT,
          restZ + next * HOVER_LIFT_Z
        );
        g.scale.setScalar(1 + next * HOVER_SCALE);
      }
      /* luz que se derrama detrás/debajo del bloque activo (referencia
         igloo.inc) — para sectores Y bandas por igual (a la banda le
         toca "un efecto de glow en el color de la fase", pedido
         explícito, sin moverse). Mismo hoverT que ya se calculó arriba. */
      if (g.userData.glowSprite) {
        const isBand = g.userData.kind === 'band';
        const factor = isBand ? (PHASE_GLOW_FACTOR[g.userData.phase.id] ?? 1) : 1;
        const cap = (isBand ? BAND_GLOW_MAX_OPACITY : GLOW_MAX_OPACITY) * factor;
        g.userData.glowSprite.material.opacity = next * cap;
      }
    }
  }

  /* rotación ligada al scroll (lenguaje cosmos/igloo) — solo rueda completa */
  scrollRot() {
    if (this.state.mode !== 'full') return 0;
    const r = this.root.getBoundingClientRect();
    const vh = innerHeight || 800;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    return (p - 0.5) * 0.55;
  }

  loop(now) {
    /* dead: la isla fue destruida y recreada (ver boot()) y ESTA
       instancia quedó huérfana — cortar aquí, ANTES de re-agendar el
       rAF, es lo que de verdad la detiene para siempre; sin esto, el
       bucle viejo seguiría corriendo pick/paint sobre un canvas
       desconectado en paralelo con la instancia nueva (doble CPU). */
    if (this.dead) return;
    requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) {
      /* Las transiciones de estado (apply) TIENEN que completarse aunque
         la rueda no esté en pantalla: al regresar al home desde un hub de
         fase se aterriza en el HERO (la rueda queda bajo el pliegue, el
         IntersectionObserver la marca no-visible) y el tween correctivo
         de boot() quedaba congelado en k=0 — la rueda seguía con el
         encuadre de la fase (gajos volados, cámara en close-up) ya en el
         home, hasta que algo lo re-pisara (bug reportado con captura).
         Solo se avanza el tween (mutación de escena, barato, ≤900ms);
         NO se renderiza — el render sigue esperando a que la rueda sea
         visible, que es lo único caro. */
      for (const tw of this.tweens) tw.step(now);
      return;
    }
    if (this._settleUntil && now < this._settleUntil) this.fitWheelLabels();
    for (const tw of this.tweens) tw.step(now);
    this.stepPulses(now);
    if (!REDUCED) {
      this.ring.rotation.z += 0.0012;
      const px = this.parallax?.x ?? 0;
      const py = this.parallax?.y ?? 0;
      this.wheel.rotation.x += ((this.tilt + px) - this.wheel.rotation.x) * 0.06;
      this.wheel.rotation.y += ((this.yaw + py) - this.wheel.rotation.y) * 0.06;
      if (!this.tweens.length) {
        const target = this.stateRot + this.scrollRot();
        this.wheel.rotation.z += (target - this.wheel.rotation.z) * 0.08;
      }
    }
    /* hover en 'full' (home) Y en 'phase' (hub): en el hub la rueda es el
       ÚNICO menú de servicios (rediseño 2026-07-11) y el cliente pidió
       explícitamente que los segmentos conserven su movimiento 3D ahí.
       'service' queda fuera: esa página encuadra UNA pieza en close-up y
       nunca pidió reacción. Sin riesgo de piezas fantasma: pick() ya
       filtra los hits por group.visible, así que los 4 sectores ocultos
       del hub (volados fuera con op 0) no reciben hover aunque sus
       mallas de raycast sigan en su lugar. */
    if (!this.tweens.length && (this.state?.mode === 'full' || this.state?.mode === 'phase')) {
      this.pick(now);
      this.hoverLift(now);
    }
    /* pulso ambiental — techo bajado a 0.82 (antes llegaba a 1.0, el
       mismo brillo de reposo pleno): con el bloom, tocar el 100% en el
       pico de la respiración alcanzaba a cruzar el umbral por sí solo y
       producía destellos sin que nadie tocara nada — deja margen real
       para que SOLO el brillo explícito de hover cruce. Ciclo de ~3.9s,
       misma curva para toda la rueda (nunca cada bloque por separado).
       Bajo prefers-reduced-motion no respira (queda fijo en su techo). */
    const breath = REDUCED ? 0.82 : 0.63 + 0.19 * Math.sin(now * 0.0016);
    /* paintAll SIEMPRE al final, después de pick()/hoverLift() (que
       fijan this.hover/opBase/glowBase para este cuadro) — es la única
       pasada que de verdad escribe en los materiales, así nunca hay dos
       pasadas peleándose por el mismo valor. */
    this.paintAll(breath);
    this.projectLabels();
    /* el bloom SOLO corre en modo 'full' (rueda completa, home): es la
       reacción de hover "99% igloo" que pidió el cliente ahí. En modo
       'phase'/'service' la cámara encuadra en close-up UNA sola pieza
       (llena casi toda la pantalla) — el mismo bloom, pensado para una
       cuña chica dentro de la rueda entera, sobre ese encuadre cercano
       se veía como una esfera/borrón que se comía la forma real (se
       detectó en captura al verificar la página de un servicio). Esas
       páginas nunca pidieron el efecto igloo, así que ahí se renderiza
       sin post-proceso, como siempre antes de esta sesión. */
    if (this.composer && this.state?.mode === 'full') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

/* -------- ciclo de vida con ClientRouter (isla persistida) -------- */
let instance = null;

function boot() {
  const root = document.getElementById('engine-wheel');
  if (!root) return;
  try {
    /* transition:persist solo conserva la isla si AMBAS páginas la
       tienen. Los landings de servicio ya no llevan rueda (hero de
       video, 2026-07-13): al pasar por uno, la isla se destruye y al
       volver se recrea con DOM NUEVO — pero este singleton seguía
       apuntando al canvas viejo huérfano: renderizaba ahí (a la nada) y
       el canvas recién montado quedaba en blanco y sin dimensionar (bug
       reportado: "la zona de la rueda vacía" al regresar con Conoce el
       Engine desde un servicio). Si el canvas del DOM no es el nuestro,
       la instancia es irrecuperable por referencias: se mata (dead corta
       su rAF, dispose libera el contexto WebGL) y se reconstruye desde
       cero sobre el DOM nuevo — el tamaño es función de ruta/CSS, así
       que la reconstrucción aterriza idéntica. */
    if (instance && instance.canvas !== root.querySelector('canvas')) {
      instance.dead = true;
      instance.renderer?.dispose();
      instance = null;
    }
    if (!instance) instance = new EngineWheel(root);
    else {
      instance.root = document.getElementById('engine-wheel');
      /* La ventana de asentamiento (constructor) existe SOLO para la
         carga de fuentes del primer documento. Si una navegación SPA
         llega dentro de esos 4s, el candado "nunca aflojar" arrastraba
         el --wheel-scale más apretado de la PÁGINA ANTERIOR (medido:
         hub → home vía logo dentro de la ventana dejaba los lockups de
         servicio diminutos en el home, y nada los recalculaba hasta un
         resize real de ventana). La fuente ya está cargada aquí — se
         cierra la ventana y se suelta el mínimo acumulado antes de
         volver a medir. */
      instance._settleUntil = 0;
      instance._settleTightest = null;
      instance.resize();
      const rs = routeState();
      if (!sameState(rs, instance.state)) instance.apply(rs, false);
    }
    root.classList.add('is-webgl');
  } catch {
    root.classList.add('is-fallback');
  }
}

boot();
document.addEventListener('astro:page-load', boot);
