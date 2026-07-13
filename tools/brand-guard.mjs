#!/usr/bin/env node
/**
 * brand-guard — verificación automática del sistema de reglas de marca (brand/RULES.md).
 * Escanea src/ y falla (exit 1) ante violaciones ⚙. Se ejecuta en `npm run build`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/* R1.1 — hex permitidos (tokens.css + blanco sobre acento) */
const ALLOWED_HEX = new Set([
  '#0e0e12', '#0b0b0e', '#0a0a0c', '#08080a', '#1a1a1e', '#16161a', '#34343c',
  // rueda ENGINE (canon brand book §07): anillo del hub + stops de gradiente radial
  '#1a2a40', '#1c1407', '#0a0805', '#08191a', '#050b0b', '#180819', '#0a050b',
  '#f4f4f2', '#c6c6cc', '#a0a0a8', '#7e7e88',
  '#1e80f0', '#1668c2', '#ffffff', '#fff',
  '#f4920c', '#15d9d9', '#e15cdb',
  '#ff5a5a', '#3dd68c', '#f5c24b',
]);

/* R4.3 — vocabulario prohibido (bloquea) */
const FORBIDDEN_WORDS = [
  // «el mejor talento» es frase aprobada del Documento Estratégico (pool de talento, no claim comparativo de marca)
  /revolucionari[oa]s?/i, /disruptiv[oa]s?/i, /\blíder(es)?\b/i, /\bel mejor\b(?!\s+talento)/i,
  /garantizad[oa]s?/i, /garantizamos/i, /garantía de resultados/i, /patentad[oa]s?/i,
  /\b100%\b/, /más precis[oa] que (los )?humanos/i,
];
/* R4.4 — vocabulario condicionado (avisa) */
const WARN_WORDS = [/propietari[oa]s?/i, /resultados medibles/i];

/* R2.2 — familias permitidas */
const FONT_OK = /geist mono|geist|ui-monospace|monospace|system-ui|sans-serif|var\(--font-(ui|read)\)/i;

const EXT = new Set(['.astro', '.css', '.js', '.mjs', '.ts', '.html', '.md']);
const errors = [];
const warnings = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (EXT.has(extname(name))) checkFile(p);
  }
}

function checkFile(path) {
  const rel = relative(ROOT, path);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const isTokens = rel.endsWith('styles/tokens.css');
  const isCode = /\.(js|mjs|ts)$/.test(rel) || rel.includes('scripts/');

  lines.forEach((line, i) => {
    const loc = `${rel}:${i + 1}`;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    /* Excepciones formales: una línea puede eximirse de UNA regla con la
       anotación `brand-ok:RX.Y` — solo vale si la excepción está
       registrada y fechada en brand/RULES.md (R7.3). Auditable con
       `grep -rn brand-ok src/`. */
    const allow = new Set([...line.matchAll(/brand-ok:(R\d+\.\d+)/g)].map((m) => m[1]));

    /* R1.1 colores fuera de tokens */
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = m[0].toLowerCase();
      if (hex.length === 5 || hex.length === 9) continue; // con alfa: revisar base
      if (!ALLOWED_HEX.has(hex) && !isTokens) errors.push(`${loc} · R1.1 color fuera de tokens: ${m[0]}`);
    }

    /* R2.1 font-size < 14px (incluye mínimos de clamp) */
    for (const m of line.matchAll(/font-size\s*:\s*([^;]+);?/gi)) {
      for (const px of m[1].matchAll(/(\d+(?:\.\d+)?)px/g)) {
        if (parseFloat(px[1]) < 14) errors.push(`${loc} · R2.1 font-size ${px[1]}px < 14px`);
      }
    }

    /* R2.2 familias tipográficas */
    for (const m of line.matchAll(/font-family\s*:\s*([^;]+);?/gi)) {
      if (!FONT_OK.test(m[1])) errors.push(`${loc} · R2.2 familia no permitida: ${m[1].trim()}`);
    }

    /* R3.1 border-radius ≠ 0 */
    for (const m of line.matchAll(/border-radius\s*:\s*([^;]+);?/gi)) {
      if (!/^\s*0(px)?\s*$/.test(m[1])) errors.push(`${loc} · R3.1 border-radius prohibido: ${m[1].trim()}`);
    }

    /* R3.2 sombras */
    /* (?!\s*none) y no (?!none): con (?!none) el \s* retrocede un espacio
       y el lookahead ve " none" — "text-shadow: none" (que APAGA una
       sombra) quedaba marcado como si fuera una sombra. */
    if (!allow.has('R3.2') && (/box-shadow\s*:\s*(?!\s*none)/i.test(line) || /text-shadow\s*:\s*(?!\s*none)/i.test(line) || /drop-shadow\(/i.test(line))) {
      errors.push(`${loc} · R3.2 sombra prohibida`);
    }

    /* R3.4 easing ajeno a la curva maestra */
    for (const m of line.matchAll(/cubic-bezier\(([^)]+)\)/gi)) {
      const vals = m[1].split(',').map((v) => parseFloat(v));
      const master = [0.2, 0.8, 0.2, 1];
      if (!vals.every((v, k) => Math.abs(v - master[k]) < 0.001)) {
        errors.push(`${loc} · R3.4 easing fuera de la curva maestra: cubic-bezier(${m[1]})`);
      }
    }
    if (/ease-in-out|ease-out|ease-in(?![a-z-])|\bspring\b|elastic|bounce/i.test(line) && /transition|animation|easing/i.test(line)) {
      errors.push(`${loc} · R3.4 easing con nombre prohibido (usar var(--ease))`);
    }

    /* R5.1 filter sobre PNGs de logo */
    if (/logo-[a-z-]+\.png/i.test(text) && /filter\s*:/i.test(line) && /logo/i.test(line)) {
      errors.push(`${loc} · R5.1 filter CSS sobre un logo`);
    }

    /* R5.5 — el logo maestro "final edge [AI]" NUNCA se reconstruye con
       LockupMark (texto/CSS): siempre es el PNG real (logo-finaledge.png
       o su variante mono). Bloquea el build si vuelve a pasar. */
    if (/<LockupMark\b/.test(line) && /word\s*=\s*"final edge"/i.test(line) && /tag\s*=\s*"\[AI\]"/i.test(line)) {
      errors.push(`${loc} · R5.5 el logo maestro "final edge [AI]" se reconstruyó con LockupMark — debe ser <img> con logo-finaledge.png (o logo-mono-*.png), nunca texto/CSS`);
    }

    /* R5.6 — el <img> del logo maestro nunca por debajo del mínimo digital
       del brand book (160px de ancho). */
    for (const m of line.matchAll(/<img\b[^>]*\bsrc\s*=\s*["'][^"']*\/(logo-finaledge|logo-mono-[a-z]+)\.png["'][^>]*>/gi)) {
      const wMatch = m[0].match(/\bwidth\s*=\s*["']?(\d+)["']?/i);
      if (wMatch && parseFloat(wMatch[1]) < 160) {
        errors.push(`${loc} · R5.6 logo maestro con width=${wMatch[1]} < 160px (mínimo digital del brand book)`);
      }
    }

    /* R5.8 — "Final Edge Engine" NUNCA aparece como texto plano visible:
       siempre es el lockup (LockupMark word="final edge" tag="[ENGINE]").
       Excepción inevitable: <title>/description de metadatos (no pueden
       contener una imagen — un <title> de HTML es texto por definición). */
    if (
      /final edge engine/i.test(line) &&
      !/\b(title|description)\s*=\s*[{"'`]/.test(line) &&
      !rel.startsWith('brand/')
    ) {
      errors.push(`${loc} · R5.8 "Final Edge Engine" como copy de texto plano — debe ser el lockup <LockupMark word="final edge" tag="[ENGINE]" />, nunca escribirse como palabra`);
    }

    /* R4 verbal — solo en archivos de contenido/markup, no en código puro */
    if (!isCode && !rel.startsWith('brand/')) {
      for (const re of FORBIDDEN_WORDS) {
        const m = line.match(re);
        if (m) errors.push(`${loc} · R4.3 palabra prohibida: «${m[0]}»`);
      }
      for (const re of WARN_WORDS) {
        const m = line.match(re);
        if (m) warnings.push(`${loc} · R4.4 palabra condicionada (verificar caveat Doc E): «${m[0]}»`);
      }
      /* R4.1 emoji */
      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(line)) errors.push(`${loc} · R4.1 emoji prohibido`);
      /* R4.2 exclamaciones en texto visible (heurística: fuera de expresiones de código) */
      if (/¡/.test(line)) errors.push(`${loc} · R4.2 signo de exclamación en copy`);
      if (/\w[!](?![=(])/.test(line) && rel.endsWith('.astro') && !/^---/.test(trimmed)
          && !line.includes('=') && !line.includes('(')) {
        errors.push(`${loc} · R4.2 signo de exclamación en copy`);
      }
    }
  });
}

walk(SRC);

if (warnings.length) {
  console.log('\nbrand-guard · AVISOS (R4.4 — requieren caveat, no bloquean):');
  for (const w of warnings) console.log('  ~ ' + w);
}
if (errors.length) {
  console.error('\nbrand-guard · VIOLACIONES DE MARCA (bloquean el build):');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error(`\n${errors.length} violación(es). Reglas: brand/RULES.md`);
  process.exit(1);
}
console.log(`\nbrand-guard · OK — sin violaciones de marca (${warnings.length} aviso(s)).`);
