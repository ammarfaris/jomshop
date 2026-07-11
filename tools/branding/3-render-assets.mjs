// Stage 3: render all app assets + branding PNGs from the SVG masters.
//
// Reads : masters/jomcontest-logo*.svg   (set MASTER=<name>.svg to pick the
//         full-lockup master used for app assets; the compact master is always
//         used for favicons; -dark masters follow the MASTER automatically)
// Writes: generated/<each master>.png                    1024px reviews (dark bg for -dark)
//         generated/preview-jomcontest-vector.png        3-panel mockup preview
//         apps/expo/assets/images/{icon,adaptive-icon,splash-icon,favicon}.png
//         apps/expo/assets/images/logo-{light,dark}.png  in-app header logos
//         apps/next/app/{icon.png,apple-icon.png}
//         apps/next/public/logo{,-dark}.svg              in-app navbar logos
//         build/fav-{16,32,48}.png                       frames for stage 4 (favicon.ico)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const BRAND = path.join(HERE, 'masters');
const GEN = path.join(HERE, 'generated');
const EXPO = path.join(ROOT, 'apps/expo/assets/images');
const NEXT = path.join(ROOT, 'apps/next/app');
const NEXT_PUB = path.join(ROOT, 'apps/next/public');
const BUILD = path.join(HERE, 'build');
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(GEN, { recursive: true });

// short-excl approved as the production lockup (2026-07-10); the exact-trace
// master stays in masters/ as ground truth.
const MASTER = process.env.MASTER || 'jomcontest-logo-short-excl.svg';

// Baloo 2 is ONLY for the fake UI labels in the preview mockups, never the logo.
const fb = fs.readFileSync(path.join(HERE, 'node_modules/@fontsource/baloo-2/files/baloo-2-latin-700-normal.woff'));
const LABEL_FONT = opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength));

function loadMaster(file) {
  const svg = fs.readFileSync(path.join(BRAND, file), 'utf8');
  const bb = svg.match(/data-bbox="([^"]+)"/)[1].split(' ').map(Number);
  const body = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { body, bbox: { x1: bb[0], y1: bb[1], x2: bb[2], y2: bb[3] } };
}
function place(l, cx, cy, tw, th) {
  const w = l.bbox.x2 - l.bbox.x1, h = l.bbox.y2 - l.bbox.y1;
  const s = Math.min(tw / w, th / h);
  return `<g transform="translate(${cx - (l.bbox.x1 + w / 2) * s} ${cy - (l.bbox.y1 + h / 2) * s}) scale(${s})">${l.body}</g>`;
}
const canvas = (w, h, bg, c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${c}</svg>`;
function render(svg, out, width) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } });
  fs.writeFileSync(out, r.render().asPng());
  console.log('wrote', path.relative(ROOT, out), width + 'px');
}

// 1024px review PNG for every master SVG (dark variants reviewed on a dark bg)
for (const f of fs.readdirSync(BRAND).filter(f => f.startsWith('jomcontest-logo') && f.endsWith('.svg'))) {
  const l = loadMaster(f);
  const bg = f.includes('-dark') ? '#0B0C0E' : '#FFFFFF';
  render(canvas(1024, 1024, bg, place(l, 512, 512, 780, 640)), path.join(GEN, f.replace('.svg', '.png')), 1024);
}

const full = loadMaster(MASTER);
const fullDark = loadMaster(MASTER.replace('.svg', '-dark.svg'));
const compact = loadMaster('jomcontest-logo-compact.svg');

// --- in-app logos (light + dark mode) ---
fs.copyFileSync(path.join(BRAND, MASTER), path.join(NEXT_PUB, 'logo.svg'));
fs.copyFileSync(path.join(BRAND, MASTER.replace('.svg', '-dark.svg')), path.join(NEXT_PUB, 'logo-dark.svg'));
console.log('wrote apps/next/public/logo.svg + logo-dark.svg');
render(canvas(720, 440, null, place(full, 360, 220, 700, 420)), path.join(EXPO, 'logo-light.png'), 720);
render(canvas(720, 440, null, place(fullDark, 360, 220, 700, 420)), path.join(EXPO, 'logo-dark.png'), 720);

// --- Expo (iOS icon must be opaque; adaptive foreground must fit the 66% safe circle) ---
render(canvas(1024, 1024, '#FFFFFF', place(full, 512, 512, 760, 620)), path.join(EXPO, 'icon.png'), 1024);
{
  const w = full.bbox.x2 - full.bbox.x1, h = full.bbox.y2 - full.bbox.y1;
  const s = 650 / Math.hypot(w, h);
  render(canvas(1024, 1024, null, place(full, 512, 512, w * s, h * s)), path.join(EXPO, 'adaptive-icon.png'), 1024);
}
render(canvas(1024, 1024, null, place(full, 512, 512, 720, 560)), path.join(EXPO, 'splash-icon.png'), 1024);
render(canvas(64, 64, null, place(compact, 32, 32, 60, 44)), path.join(EXPO, 'favicon.png'), 48);

// --- Next.js (favicon = compact "jom!" ONLY; apple-icon = full lockup, opaque) ---
render(canvas(64, 64, null, place(compact, 32, 32, 58, 42)), path.join(NEXT, 'icon.png'), 512);
render(canvas(1024, 1024, '#FFFFFF', place(full, 512, 512, 760, 620)), path.join(NEXT, 'apple-icon.png'), 180);
for (const s of [16, 32, 48]) render(canvas(64, 64, null, place(compact, 32, 32, 60, 44)), path.join(BUILD, `fav-${s}.png`), s);

// --- 3-panel preview: home screen, splash, web header — full lockup everywhere ---
function lbl(t, size, x, y, fill, center = false) {
  const w = LABEL_FONT.getAdvanceWidth(t, size);
  return `<path d="${LABEL_FONT.getPath(t, center ? x - w / 2 : x, y, size).toPathData(2)}" fill="${fill}"/>`;
}
const P = '#E9EAEC', PH = '#20242B', SCR = '#495160', GHOST = '#8A93A0';
const names = ['Calendar', 'Photos', 'Camera', 'Clock', 'Maps', 'Notes', 'Reminders', 'App Store', 'Health', 'Wallet', 'Settings'];
let p1 = `<rect width="504" height="1024" fill="${P}"/><rect x="42" y="64" width="420" height="1010" rx="58" fill="${PH}"/><rect x="56" y="78" width="392" height="982" rx="46" fill="${SCR}"/>`;
p1 += lbl('9:41', 24, 96, 128, '#FFFFFF') + `<rect x="196" y="106" width="112" height="32" rx="16" fill="#12151A"/>`;
const gx = [92, 218, 344], iw = 92; let ni = 0;
for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
  const ix = gx[c], iy = 190 + r * 158;
  if (r === 0 && c === 0) {
    p1 += `<rect x="${ix}" y="${iy}" width="${iw}" height="${iw}" rx="${iw * 0.225}" fill="#FFFFFF" stroke="#D4D6DA" stroke-width="1.5"/>`;
    p1 += place(full, ix + iw / 2, iy + iw / 2, iw * 0.74, iw * 0.74);
    p1 += lbl('JomContest', 21, ix + iw / 2, iy + iw + 28, '#FFFFFF', true);
  } else {
    p1 += `<rect x="${ix}" y="${iy}" width="${iw}" height="${iw}" rx="${iw * 0.225}" fill="${GHOST}" opacity="0.55"/>`;
    if (ni < names.length) p1 += lbl(names[ni++], 21, ix + iw / 2, iy + iw + 28, '#E3E6EA', true);
  }
}
p1 += `<circle cx="232" cy="988" r="5" fill="#FFF"/><circle cx="252" cy="988" r="5" fill="#FFF" opacity="0.4"/><circle cx="272" cy="988" r="5" fill="#FFF" opacity="0.4"/>`;
let p2 = `<g transform="translate(516 0)"><rect width="504" height="1024" fill="${P}"/><rect x="72" y="92" width="360" height="840" rx="54" fill="${PH}"/><rect x="84" y="104" width="336" height="816" rx="42" fill="#FFF"/>`;
p2 += lbl('9:41', 22, 120, 152, '#20242B') + `<rect x="196" y="128" width="112" height="30" rx="15" fill="#12151A"/>`;
p2 += place(full, 252, 512, 268, 240) + `<rect x="196" y="884" width="112" height="6" rx="3" fill="#20242B"/></g>`;
let p3 = `<g transform="translate(1032 0)"><rect width="504" height="1024" fill="${P}"/><rect x="40" y="150" width="520" height="740" rx="18" fill="#FFF" stroke="#D4D6DA" stroke-width="1.5"/>`;
p3 += `<rect x="40" y="150" width="520" height="64" rx="18" fill="#F1F2F4"/><rect x="40" y="196" width="520" height="18" fill="#F1F2F4"/>`;
p3 += `<circle cx="72" cy="182" r="7" fill="#FF5F57"/><circle cx="96" cy="182" r="7" fill="#FEBC2E"/><circle cx="120" cy="182" r="7" fill="#28C840"/>`;
p3 += `<rect x="152" y="168" width="330" height="28" rx="14" fill="#FFF" stroke="#DDDFE3"/>` + lbl('jomcontest.app', 18, 168, 187, '#9AA1AB');
p3 += place(full, 128, 268, 130, 84);
p3 += lbl('Contests', 24, 226, 277, '#3C4450') + lbl('Hosts', 24, 340, 277, '#3C4450') + lbl('Profile', 24, 420, 277, '#3C4450');
p3 += `<rect x="40" y="312" width="520" height="2" fill="#ECEDEF"/><rect x="80" y="352" width="440" height="300" rx="14" fill="#EFF0F2"/>`;
p3 += `<rect x="80" y="684" width="440" height="56" rx="10" fill="#EFF0F2"/><rect x="80" y="760" width="360" height="20" rx="8" fill="#EFF0F2"/><rect x="80" y="796" width="300" height="20" rx="8" fill="#EFF0F2"/></g>`;
render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024"><rect width="1536" height="1024" fill="#FFF"/>${p1}${p2}${p3}</svg>`,
  path.join(GEN, 'preview-jomcontest-vector.png'), 1536);
console.log('done (master: ' + MASTER + ')');
