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
import { navigate } from 'astro:transitions/client';
import { PHASES, EDGES } from '../data/engine.js';

const D2R = Math.PI / 180;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEPTH = 58;      // extrusión de sectores — volumen 3D deliberadamente visible
const BAND_DEPTH = 34; // extrusión de la banda

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
  }

  build() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 10, 4000);
    this.camera.position.set(0, 90, 980);
    this.camera.lookAt(0, 0, 0);

    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.wheel = new THREE.Group();
    this.rig.add(this.wheel);

    this.parts = { sectors: {}, bands: {}, hub: null };

    for (const edge of EDGES) {
      const phase = PHASES.find((p) => p.id === edge.phase);
      const a0 = edge.angle - 26, a1 = edge.angle + 26; // 60° − 4° de gap
      const g = new THREE.Group();
      const fill = volumeMesh(donutShape(96, 232, a0, a1), DEPTH, { grad: GRADS[phase.id] });
      const rim = outline(96, 232, a0, a1, phase.color, 0.85, DEPTH / 2 + 1);
      g.add(fill, rim);
      g.userData = { kind: 'sector', edge, fill, rim };
      fill.userData = g.userData;
      this.wheel.add(g);
      this.parts.sectors[edge.id] = g;
      this.addAnchor('edge-' + edge.id, posAt(edge.angle, 168).setZ(DEPTH / 2 + 2), g);
    }

    for (const phase of PHASES) {
      const a0 = phase.startAngle + 5, a1 = phase.startAngle + 115; // 120° − 5° de gap
      const g = new THREE.Group();
      const fill = volumeMesh(donutShape(248, 278, a0, a1), BAND_DEPTH, { solid: phase.color });
      const rim = outline(248, 278, a0, a1, phase.color, 0.7, BAND_DEPTH / 2 + 1);
      g.add(fill, rim);
      g.userData = { kind: 'band', phase, fill, rim };
      fill.userData = g.userData;
      this.wheel.add(g);
      this.parts.bands[phase.id] = g;
      const center = phase.startAngle + 60;
      /* mismo radio para las 3: el anillo de fase termina en radio 278
         (donutShape(248,278,...) más arriba), así que 296 deja ~18
         unidades de separación visible entre el color de la rueda y el
         nombre — nunca se encima. El margen BUFFER en resize() es lo
         que permite que ese mismo radio no se corte contra el borde en
         ningún ángulo (antes competían por el mismo espacio). */
      const labelR = 296;
      this.addAnchor('phase-' + phase.id, posAt(center, labelR).setZ(BAND_DEPTH / 2 + 2), g);
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
  setLook(group, { op, glow }) {
    const { fill, rim, kind } = group.userData;
    const mats = Array.isArray(fill.material) ? fill.material : [fill.material];
    if (!group.userData.base) group.userData.base = mats.map((m) => m.color.clone());
    mats.forEach((m, i) => {
      m.opacity = op;
      m.color.copy(group.userData.base[i]).multiplyScalar(1 + glow);
    });
    rim.material.opacity = op * (kind === 'band' ? 0.7 : kind === 'sector' ? 0.85 : 1);
    group.userData.glow = glow;
    group.visible = op > 0.01;
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
    });

    this.canvas.addEventListener('click', () => {
      if (this.hover) this.go(this.hover.userData);
    });

    const io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; });
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
      for (const j of jobs) j.g.visible = j.to.op > 0.01;
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
       píxeles. */
    const BUFFER = 26;
    const compact = routeState().mode !== 'full';
    this.root.dataset.compact = compact ? '1' : '0';
    const refW = compact ? 620 : 820;
    const refH = compact ? 560 : 820;
    const parent = this.root.parentElement;
    const availW = (parent?.clientWidth || refW) - BUFFER * 2;
    let w = Math.max(1, Math.min(availW, refW));
    /* el límite por alto SOLO aplica en el layout de dos columnas (>900px,
       mismo corte que el media query de .engine-split): en la columna
       apilada de móvil, .engine-col-wheel pasa a height:auto — un % de
       alto contra un ancestro auto no resuelve a nada usable (colapsa al
       tamaño por defecto del <canvas>, ~300×150), así que ahí la rueda
       vuelve a dimensionarse solo por ancho, como siempre lo hizo. */
    if (this.root.dataset.fitHeight === '1' && matchMedia('(min-width: 901px)').matches) {
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
    this.fitScale = w / refW;
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

  pick() {
    if (!this.pointer) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const fills = [];
    for (const id in this.parts.sectors) fills.push(this.parts.sectors[id].userData.fill);
    for (const id in this.parts.bands) fills.push(this.parts.bands[id].userData.fill);
    const hits = this.raycaster
      .intersectObjects(fills, false)
      .filter((h) => {
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
        return h.object.parent.visible && m.opacity > 0.5;
      });
    const top = hits[0]?.object.parent ?? null;
    if (top !== this.hover) {
      const st = this.targetsFor(this.state).items;
      const glowOf = (g) => st.get(g)?.glow ?? 0;
      const opOf = (g) => (Array.isArray(g.userData.fill.material) ? g.userData.fill.material[0] : g.userData.fill.material).opacity;
      if (this.hover) this.setLook(this.hover, { op: opOf(this.hover), glow: glowOf(this.hover) });
      this.hover = top;
      if (top) this.setLook(top, { op: opOf(top), glow: glowOf(top) + 0.45 });
      this.canvas.style.cursor = top ? 'pointer' : 'default';
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
    requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
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
    if (!this.tweens.length) this.pick();
    this.projectLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

/* -------- ciclo de vida con ClientRouter (isla persistida) -------- */
let instance = null;

function boot() {
  const root = document.getElementById('engine-wheel');
  if (!root) return;
  try {
    if (!instance) instance = new EngineWheel(root);
    else {
      instance.root = document.getElementById('engine-wheel');
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
