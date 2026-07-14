// Stage 2: vectorize the masks (potrace) and assemble layered SVG masters.
//
// Reads : build/mask-*.png, build/colors.json       (from stage 1)
// Writes: masters/jomcontest-logo.svg                exact trace of the reference
//         masters/jomcontest-logo-compact.svg        "jom!" only (favicon variant)
//         masters/jomcontest-logo-short-excl.svg     production lockup: excl dot level with pill bottom
//         masters/jomcontest-logo-short-excl-dark.svg  dark-mode: pill flips to near-white
//
// Every master carries data-bbox="x1 y1 x2 y2" (tight content bounds in path
// coordinates) which stage 3 uses for placement. Layers are named groups so
// designers can edit in Illustrator/Figma.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import potrace from 'potrace';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, 'build');
const BRAND = path.join(HERE, 'masters');
const { green: GREEN, charcoal: CHARCOAL } = JSON.parse(fs.readFileSync(`${BUILD}/colors.json`, 'utf8'));

const traceOpts = { threshold: 128, turdSize: 90, alphaMax: 1, optTolerance: 0.2, blackOnWhite: true };
const trace = f => new Promise((res, rej) =>
  potrace.trace(`${BUILD}/${f}`, traceOpts, (e, svg) => e ? rej(e) : res(svg.match(/d="([^"]+)"/)[1])));

// potrace emits absolute M/L/C; control points bound the curves, good enough for bboxes
function subpaths(d) {
  return d.split(/(?=M)/).map(s => s.trim()).filter(Boolean).map(s => {
    const nums = (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    return { d: s, x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
  });
}
const area = p => (p.x2 - p.x1) * (p.y2 - p.y1);
const union = ps => ({
  x1: Math.min(...ps.map(p => p.x1)), y1: Math.min(...ps.map(p => p.y1)),
  x2: Math.max(...ps.map(p => p.x2)), y2: Math.max(...ps.map(p => p.y2)),
});

function writeMaster(file, bbox, layers, pad = 60) {
  const vb = `${(bbox.x1 - pad).toFixed(0)} ${(bbox.y1 - pad).toFixed(0)} ${(bbox.x2 - bbox.x1 + 2 * pad).toFixed(0)} ${(bbox.y2 - bbox.y1 + 2 * pad).toFixed(0)}`;
  const bb = [bbox.x1, bbox.y1, bbox.x2, bbox.y2].map(n => n.toFixed(1)).join(' ');
  fs.writeFileSync(path.join(BRAND, file),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" data-bbox="${bb}">\n${layers}\n</svg>\n`);
  console.log('wrote masters/' + file);
}

const [dGreen, dPill, dText] = await Promise.all(
  ['mask-green.png', 'mask-pill-solid.png', 'mask-contest-white.png'].map(trace));

// ---- classify green subpaths: letters vs exclamation (bar + dot are the rightmost ~20%) ----
const sps = subpaths(dGreen).filter(p => area(p) > 400);
const gb = union(sps);
const excl = sps.filter(p => p.x1 > gb.x1 + (gb.x2 - gb.x1) * 0.8).sort((a, b) => a.y1 - b.y1);
const letters = sps.filter(p => p.x1 <= gb.x1 + (gb.x2 - gb.x1) * 0.8);
if (excl.length !== 2) console.warn(`!! expected 2 exclamation subpaths (bar, dot), got ${excl.length} — check masks`);
const [bar, dot] = [excl[0], excl[excl.length - 1]];

const pill = subpaths(dPill).filter(p => area(p) > 400).sort((a, b) => area(b) - area(a))[0];
const textD = subpaths(dText).filter(p => area(p) > 300).map(p => p.d).join(' ');
const lettersD = letters.map(p => p.d).join(' ');
const lettersBB = union(letters);

const jomLayer = `  <g id="jom">
    <path id="jom-letters" fill="${GREEN}" fill-rule="evenodd" d="${lettersD}"/>
  </g>`;
const pillLayer = `  <g id="contest-pill">
    <path id="pill" fill="${CHARCOAL}" d="${pill.d}"/>
    <path id="contest-text" fill="#FFFFFF" fill-rule="evenodd" d="${textD}"/>
  </g>`;

// ---- master 1: exact trace of the reference ----
writeMaster('jomcontest-logo.svg', union([lettersBB, bar, dot, pill]), `${jomLayer}
  <g id="exclamation" fill="${GREEN}">
    <path id="excl-bar" d="${bar.d}"/>
    <path id="excl-dot" d="${dot.d}"/>
  </g>
${pillLayer}`);

// ---- master 2: compact "jom!" (favicon) — excl rescaled to word top / baseline ----
// The excl dot is sized off the j's own dot (slightly larger, for optical
// parity — it must never read smaller). The bar's width scales with the dot;
// its height absorbs whatever room is left, keeping the j-dot's gap rhythm.
let compactExcl; // transforms + metrics, reused by the one-line master below
{
  const mSub = letters.reduce((a, b) => (b.x2 > a.x2 ? b : a)); // rightmost letter = m
  const baseline = mSub.y2, wordTop = lettersBB.y1;
  const wordH = baseline - wordTop;
  const jdot = letters.reduce((a, b) => (b.y1 < a.y1 ? b : a)); // topmost subpath = j's dot
  const jbody = letters.reduce((a, b) => (b.x1 < a.x1 ? b : a)); // leftmost = j stem+hook
  const dotH0 = dot.y2 - dot.y1, barH0 = bar.y2 - bar.y1;
  const sd = ((jdot.y2 - jdot.y1) * 1.1) / dotH0;               // excl dot ≥ j-dot
  const sx = sd;                                                 // bar width tracks the dot
  const gap = Math.min(80, Math.max(24, jbody.y1 - jdot.y2));    // reuse the j's dot gap
  const fy = (wordH - gap - dotH0 * sd) / barH0;
  const barLeft = lettersBB.x2 + (bar.x1 - lettersBB.x2) * 0.75;
  const btx = barLeft - bar.x1 * sx, bty = wordTop - bar.y1 * fy;
  const barCx = (bar.x1 + bar.x2) / 2 * sx + btx;
  const dtx = barCx - (dot.x1 + dot.x2) / 2 * sd, dty = baseline - dot.y2 * sd;
  const right = Math.max(bar.x2 * sx + btx, dot.x2 * sd + dtx);
  compactExcl = { sx, fy, sd, btx, bty, dtx, dty, right, wordTop, baseline, xTop: mSub.y1 };
  writeMaster('jomcontest-logo-compact.svg',
    { x1: lettersBB.x1, y1: wordTop, x2: right, y2: Math.max(lettersBB.y2, baseline) }, `${jomLayer}
  <g id="exclamation" fill="${GREEN}">
    <path id="excl-bar" transform="translate(${btx.toFixed(2)} ${bty.toFixed(2)}) scale(${sx.toFixed(4)} ${fy.toFixed(4)})" d="${bar.d}"/>
    <path id="excl-dot" transform="translate(${dtx.toFixed(2)} ${dty.toFixed(2)}) scale(${sd.toFixed(4)})" d="${dot.d}"/>
  </g>`, 50);
  console.log(`compact: excl dot ${(sd * dotH0).toFixed(0)}px vs j-dot ${(jdot.y2 - jdot.y1).toFixed(0)}px, bar ${(fy * barH0).toFixed(0)}px`);
}

// ---- master 3 (production): shorter exclamation — dot bottom level with pill bottom ----
// The dot rises by delta; the bar keeps its top and loses delta at the bottom,
// preserving the bar-to-dot gap exactly. Also emitted as a dark-mode variant:
// on near-black backgrounds the charcoal pill vanishes, so the pill flips to
// near-white with charcoal text (green already has contrast on dark).
{
  const delta = dot.y2 - pill.y2;
  const barH = bar.y2 - bar.y1;
  const f = (barH - delta) / barH;
  const bty = bar.y1 * (1 - f); // scale about the bar's own top edge
  const bbox = union([lettersBB, { ...bar, y2: bar.y2 - delta }, { ...dot, y1: dot.y1 - delta, y2: pill.y2 }, pill]);
  const exclLayer = `  <g id="exclamation" fill="${GREEN}">
    <path id="excl-bar" transform="translate(0 ${bty.toFixed(2)}) scale(1 ${f.toFixed(4)})" d="${bar.d}"/>
    <path id="excl-dot" transform="translate(0 ${(-delta).toFixed(2)})" d="${dot.d}"/>
  </g>`;
  writeMaster('jomcontest-logo-short-excl.svg', bbox, `${jomLayer}\n${exclLayer}\n${pillLayer}`);
  const darkPillLayer = `  <g id="contest-pill">
    <path id="pill" fill="#F3F5F7" d="${pill.d}"/>
    <path id="contest-text" fill="${CHARCOAL}" fill-rule="evenodd" d="${textD}"/>
  </g>`;
  writeMaster('jomcontest-logo-short-excl-dark.svg', bbox, `${jomLayer}\n${exclLayer}\n${darkPillLayer}`);
  console.log(`short-excl: dot raised ${delta.toFixed(0)}px, bar shortened to ${(f * 100).toFixed(1)}%`);
}

// ---- master 4: one-line lockup "jom! contest" — compact "jom!" + pill on the same line ----
// The exclamation reuses the compact master's transforms (fitted word-top →
// baseline). The pill scales to the x-height band with a hair of overshoot
// (rounded ends need it to look level with flat letter bottoms) and sits a
// word-space to the right of the "!".
{
  const { sx, fy, sd, btx, bty, dtx, dty, right, wordTop, baseline, xTop } = compactExcl;
  const xH = baseline - xTop;
  const over = xH * 0.02;
  const sp = (xH + 2 * over) / (pill.y2 - pill.y1);
  const gap = xH * 0.2;
  const ptx = right + gap - pill.x1 * sp;
  const pty = (xTop - over) - pill.y1 * sp;
  const exclLayer = `  <g id="exclamation" fill="${GREEN}">
    <path id="excl-bar" transform="translate(${btx.toFixed(2)} ${bty.toFixed(2)}) scale(${sx.toFixed(4)} ${fy.toFixed(4)})" d="${bar.d}"/>
    <path id="excl-dot" transform="translate(${dtx.toFixed(2)} ${dty.toFixed(2)}) scale(${sd.toFixed(4)})" d="${dot.d}"/>
  </g>`;
  const pillT = `translate(${ptx.toFixed(2)} ${pty.toFixed(2)}) scale(${sp.toFixed(4)})`;
  const bbox = {
    x1: lettersBB.x1, y1: wordTop,
    x2: pill.x2 * sp + ptx, y2: Math.max(lettersBB.y2, baseline, pill.y2 * sp + pty),
  };
  writeMaster('jomcontest-logo-oneline.svg', bbox, `${jomLayer}\n${exclLayer}
  <g id="contest-pill" transform="${pillT}">
    <path id="pill" fill="${CHARCOAL}" d="${pill.d}"/>
    <path id="contest-text" fill="#FFFFFF" fill-rule="evenodd" d="${textD}"/>
  </g>`);
  writeMaster('jomcontest-logo-oneline-dark.svg', bbox, `${jomLayer}\n${exclLayer}
  <g id="contest-pill" transform="${pillT}">
    <path id="pill" fill="#F3F5F7" d="${pill.d}"/>
    <path id="contest-text" fill="${CHARCOAL}" fill-rule="evenodd" d="${textD}"/>
  </g>`);
  console.log(`oneline: pill scaled to ${(sp * 100).toFixed(1)}% (${(xH + 2 * over).toFixed(0)}px tall), gap ${gap.toFixed(0)}px`);
}
