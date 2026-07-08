/**
 * ENGINE™ — rueda WebGL (Three.js), navegación viva del Final Edge Engine.
 * APARIENCIA: réplica exacta de la rueda del brand book (§07):
 *  · sectores planos con gradiente radial oscuro (stops 0.35→1, r 288 en espacio 720)
 *    y trazo 1.25 en color de fase (op .85)
 *  · banda exterior en color de fase SÓLIDO, trazo op .7
 *  · hub r84 relleno #0E0E12 con anillo #1A2A40
 *  · etiquetas como texto DOM ≥14px (nunca rasterizadas) — R6.2
 * COREOGRAFÍA (decisión del cliente 2026-07-08, inspiración igloo.inc):
 *  · click en FASE → se ilumina y gira; el resto se desvanece; queda como menú del hub
 *  · click en SERVICIO → el segmento se desprende, gira y se acopla como título
 */
import * as THREE from 'three';
import { navigate } from 'astro:transitions/client';
import { PHASES, EDGES } from '../data/engine.js';

const D2R = Math.PI / 180;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/* pos en pantalla: ángulo horario desde arriba → three.js (y arriba) */
const posAt = (deg, r) => new THREE.Vector3(Math.sin(deg * D2R) * r, Math.cos(deg * D2R) * r, 0);

function donutShape(ri, ro, a0deg, a1deg) {
  const toRad = (d) => (90 - d) * D2R; // horario-desde-arriba → ccw-desde-+x
  const shape = new THREE.Shape();
  shape.absarc(0, 0, ro, toRad(a0deg), toRad(a1deg), true);
  shape.absarc(0, 0, ri, toRad(a1deg), toRad(a0deg), false);
  return shape;
}

/* malla plana con gradiente radial por vértice (colores exactos, sin luces) */
function flatMesh(shape, grad) {
  const geo = new THREE.ShapeGeometry(shape, 64);
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
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide }));
}

function solidMesh(shape, hex) {
  return new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 64),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, side: THREE.DoubleSide })
  );
}

/* contorno del sector (trazo del brand book) */
function outline(ri, ro, a0deg, a1deg, hex, opacity) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) pts.push(posAt(a0deg + ((a1deg - a0deg) * i) / steps, ro));
  for (let i = steps; i >= 0; i--) pts.push(posAt(a0deg + ((a1deg - a0deg) * i) / steps, ri));
  pts.push(pts[0].clone());
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity })
  );
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
    this.camera = new THREE.PerspectiveCamera(38, 1, 10, 4000);
    this.camera.position.set(0, 0, 1120);
    this.camera.lookAt(0, 0, 0);

    /* grupo raíz: permite desplazar rueda + anillo por estado */
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.wheel = new THREE.Group();
    this.rig.add(this.wheel);

    this.parts = { sectors: {}, bands: {}, hub: null };
    this.groups = {}; // id → grupo (mesh + contorno) para opacidad conjunta

    for (const edge of EDGES) {
      const phase = PHASES.find((p) => p.id === edge.phase);
      const a0 = edge.angle - 26, a1 = edge.angle + 26; // 60° − 4° de gap
      const g = new THREE.Group();
      const fill = flatMesh(donutShape(96, 232, a0, a1), GRADS[phase.id]);
      const rim = outline(96, 232, a0, a1, phase.color, 0.85);
      rim.position.z = 1;
      g.add(fill, rim);
      g.userData = { kind: 'sector', edge, fill, rim };
      fill.userData = g.userData;
      this.wheel.add(g);
      this.parts.sectors[edge.id] = g;
      this.addAnchor('edge-' + edge.id, posAt(edge.angle, 168), g);
    }

    for (const phase of PHASES) {
      const a0 = phase.startAngle + 5, a1 = phase.startAngle + 115; // 120° − 5° de gap
      const g = new THREE.Group();
      const fill = solidMesh(donutShape(248, 278, a0, a1), phase.color);
      const rim = outline(248, 278, a0, a1, phase.color, 0.7);
      rim.position.z = 1;
      g.add(fill, rim);
      g.userData = { kind: 'band', phase, fill, rim };
      fill.userData = g.userData;
      this.wheel.add(g);
      this.parts.bands[phase.id] = g;
      const center = phase.startAngle + 60;
      const labelR = { evaluacion: 290, capacidades: 348, ejecucion: 338 }[phase.id];
      this.addAnchor('phase-' + phase.id, posAt(center, labelR), g);
    }

    /* hub: círculo Void + anillo #1A2A40 (brand book) */
    const hubG = new THREE.Group();
    const hubFill = new THREE.Mesh(
      new THREE.CircleGeometry(84, 72),
      new THREE.MeshBasicMaterial({ color: 0x0e0e12, transparent: true })
    );
    const hubPts = [];
    for (let i = 0; i <= 72; i++) hubPts.push(posAt(i * 5, 84));
    const hubRim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(hubPts),
      new THREE.LineBasicMaterial({ color: 0x1a2a40, transparent: true })
    );
    hubRim.position.z = 1;
    hubG.add(hubFill, hubRim);
    hubG.userData = { kind: 'hub', fill: hubFill, rim: hubRim };
    hubG.position.z = 2;
    this.wheel.add(hubG);
    this.parts.hub = hubG;
    this.addAnchor('hub', new THREE.Vector3(0, 0, 4), hubG);

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

  /* opacidad + brillo conjunto de un grupo sector/banda (conserva el color base) */
  setLook(group, { op, glow }) {
    const { fill, rim } = group.userData;
    if (!group.userData.baseColor) group.userData.baseColor = fill.material.color.clone();
    fill.material.opacity = op;
    rim.material.opacity = op * (group.userData.kind === 'band' ? 0.7 : 0.85);
    fill.material.color.copy(group.userData.baseColor).multiplyScalar(1 + glow);
    group.userData.glow = glow;
    group.visible = op > 0.01;
  }

  bind() {
    addEventListener('resize', () => this.resize(), { passive: true });

    this.canvas.addEventListener('pointermove', (ev) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.parallax = { x: this.pointer.y * 0.05, y: this.pointer.x * 0.07 };
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
    let target, url;
    if (data.kind === 'sector') { target = { mode: 'service', edge: data.edge }; url = data.edge.slug; }
    else if (data.kind === 'band') { target = { mode: 'phase', phase: data.phase }; url = data.phase.slug; }
    else return;
    if (sameState(target, this.state)) { navigate(url); return; }
    if (REDUCED) { navigate(url); return; }
    this.busy = true;
    this.apply(target, false, () => { this.busy = false; });
    setTimeout(() => navigate(url), 560); // la coreografía sigue viva durante el view-transition
  }

  /** targets por estado — desprendimiento, giro, desvanecimiento y encuadre */
  targetsFor(state) {
    const t = { rot: 0, scale: 1, spin: 0, offY: 0, items: new Map() };
    const set = (g, v) => t.items.set(g, v);

    if (state.mode === 'full') {
      for (const e of EDGES) set(this.parts.sectors[e.id], { op: 1, fly: 0, lift: 0, glow: 0 });
      for (const p of PHASES) set(this.parts.bands[p.id], { op: 1, fly: 0, lift: 0, glow: 0 });
      set(this.parts.hub, { op: 1, fly: 0, lift: 0, glow: 0 });
      t.ringOp = 1;
    } else if (state.mode === 'phase') {
      const pid = state.phase.id;
      const center = state.phase.startAngle + 60;
      t.rot = center * D2R;   // la fase gira hasta quedar arriba
      t.spin = Math.PI * 2;   // vuelta completa durante la transición («gire»)
      t.scale = 1.1;
      t.offY = -150;          // encuadra el arco superior en el lienzo compacto
      for (const e of EDGES) {
        const mine = e.phase === pid;
        set(this.parts.sectors[e.id], mine
          ? { op: 1, fly: 0, lift: 24, glow: 0.55 }   // «se ilumina»
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
      t.rot = edge.angle * D2R; // el segmento gira hasta apuntar arriba
      t.spin = Math.PI * 2;
      t.scale = 1.16;
      t.offY = -130;
      for (const e of EDGES) {
        const sel = e.id === edge.id;
        set(this.parts.sectors[e.id], sel
          ? { op: 1, fly: 0, lift: 60, glow: 0.65 }   // se desprende hacia la cámara
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

    const jobs = [];
    for (const [g, v] of t.items) {
      const dir = g.userData.edge
        ? posAt(g.userData.edge.angle, 1)
        : g.userData.phase
          ? posAt(g.userData.phase.startAngle + 60, 1)
          : new THREE.Vector3(0, 0, 0);
      const baseZ = g.userData.kind === 'hub' ? 2 : 0;
      jobs.push({
        g,
        from: {
          op: g.userData.fill.material.opacity,
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

    if (instant || REDUCED) {
      put(1);
      this.wheel.rotation.z = t.rot;
      for (const j of jobs) j.g.visible = j.to.op > 0.01;
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
          this.wheel.rotation.z = t.rot; // descuenta la vuelta completa
          for (const j of jobs) j.g.visible = j.to.op > 0.01;
          this.tweens = [];
          done && done();
        }
      },
    }];
  }

  resize() {
    /* rueda completa = 880 fijo (el card hace scroll horizontal, como el brand book);
       compacta (hub/servicio) = responsiva. El modo se deriva de la RUTA: la isla
       persistida conserva el dataset de la página anterior y no es confiable. */
    const compact = routeState().mode !== 'full';
    this.root.dataset.compact = compact ? '1' : '0';
    const w = compact ? Math.min(this.root.clientWidth || 620, 620) : 880;
    const h = compact ? Math.min(w, 560) : 880;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  projectLabels() {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const [, { obj, el }] of this.anchors) {
      obj.getWorldPosition(v);
      v.project(this.camera);
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px)`;
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
      .filter((h) => h.object.parent.visible && h.object.material.opacity > 0.5);
    const top = hits[0]?.object.parent ?? null;
    if (top !== this.hover) {
      const base = () => {
        const st = this.targetsFor(this.state).items;
        return (g) => st.get(g)?.glow ?? 0;
      };
      const glowOf = base();
      if (this.hover) this.setLook(this.hover, { op: this.hover.userData.fill.material.opacity, glow: glowOf(this.hover) });
      this.hover = top;
      if (top) this.setLook(top, { op: top.userData.fill.material.opacity, glow: glowOf(top) + 0.45 });
      this.canvas.style.cursor = top ? 'pointer' : 'default';
    }
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    for (const tw of this.tweens) tw.step(now);
    if (!REDUCED) {
      this.ring.rotation.z += 0.0012;
      if (this.parallax) {
        this.wheel.rotation.x += (this.parallax.x - this.wheel.rotation.x) * 0.06;
        this.wheel.rotation.y += (this.parallax.y - this.wheel.rotation.y) * 0.06;
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
    root.classList.add('is-fallback'); // sin WebGL: las etiquetas quedan como enlaces estáticos
  }
}

boot();
document.addEventListener('astro:page-load', boot);
