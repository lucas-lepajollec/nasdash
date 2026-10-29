#!/usr/bin/env node
// Draws the wallpapers shipped in public/wallpapers: layered ridges, auroras and soft light in NasDash's colours.
// They are generated, not photographed, so they carry the project's own licence. Same seed, same images:
//   node scripts/generate-wallpapers.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 2560;
const H = 1600;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wallpapers');

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A ridge line: a few sines plus small noise, closed down to the bottom of the image. */
function ridge(rand, base, height, roughness = 1) {
  const waves = Array.from({ length: 5 }, (_, i) => ({ f: (0.6 + rand() * 1.4) * (i + 1), p: rand() * Math.PI * 2, a: height / (i + 1.4) }));
  const points = [];
  for (let x = -20; x <= W + 20; x += 16) {
    let y = base;
    for (const wave of waves) y -= wave.a * Math.sin((x / W) * Math.PI * wave.f + wave.p);
    y += (rand() - 0.5) * 6 * roughness;
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M-20,${H + 20} L${points.join(' L')} L${W + 20},${H + 20} Z`;
}

function stars(rand, count, maxY, opacity) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const r = rand() < 0.92 ? 0.9 + rand() * 0.8 : 1.8 + rand();
    out += `<circle cx="${(rand() * W).toFixed(0)}" cy="${(rand() * maxY).toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(opacity * (0.3 + rand() * 0.7)).toFixed(2)}"/>`;
  }
  return out;
}

/** Fine grain so dark gradients do not band once compressed. */
const GRAIN = `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0"/></filter>`;
const grainLayer = (opacity) => `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${opacity}"/>`;

function svg(defs, body, grain = 0.06) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GRAIN}${HAZE}${RAYS}${defs}</defs>${body}${grainLayer(grain)}</svg>`;
}

let ridgeId = 0;
/** Ridge layers, back to front: each lit at its crest and darker at its foot, with haze before the next one. */
function ridges(rand, layers, haze) {
  return layers.map(layer => {
    const id = `ridge${ridgeId++}`;
    const top = layer.base - layer.height * 1.6;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${H}"><stop offset="0" stop-color="${layer.light ?? layer.fill}"/><stop offset="0.45" stop-color="${layer.fill}"/></linearGradient>`
      + `<path d="${ridge(rand, layer.base, layer.height, layer.rough)}" fill="url(#${id})"/>`
      + (haze ? `<rect x="-300" y="${layer.base - 40}" width="${W + 600}" height="160" fill="${haze}" opacity="0.09" filter="url(#haze)"/>` : '');
  }).join('');
}
const HAZE = `<filter id="haze" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="40"/></filter>`;

/** An aurora curtain: thin vertical rays along a curve, bright at their foot and fading upwards. */
function aurora(rand, { from, to, base, amplitude, height, color, id }) {
  let rays = '';
  for (let x = from; x <= to; x += 5) {
    const t = (x - from) / (to - from);
    const fade = Math.sin(Math.PI * t);
    const y = base + amplitude * Math.sin(t * Math.PI * 1.6 + 0.4) + 30 * Math.sin(t * 19);
    const h = height * (0.55 + 0.45 * Math.sin(t * 7 + rand())) * (0.6 + 0.4 * fade);
    rays += `<rect x="${x}" y="${(y - h).toFixed(0)}" width="${(3 + rand() * 6).toFixed(1)}" height="${h.toFixed(0)}" fill="url(#${id})" opacity="${(fade * (0.35 + rand() * 0.65)).toFixed(2)}"/>`;
  }
  return `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${color}" stop-opacity="0.95"/><stop offset="0.35" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`
    + `<g filter="url(#rays)">${rays}</g>`;
}
const RAYS = `<filter id="rays" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="9 14"/></filter>`;

const wallpapers = {
  // Night hills under a cyan aurora (the default).
  'nasdash-aurora': () => {
    const rand = random(11);
    return svg(`
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06080d"/><stop offset="0.5" stop-color="#0b131d"/><stop offset="0.72" stop-color="#11273a"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="120"/></filter>`,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
      ${stars(rand, 520, H * 0.7, 0.8)}
      <g filter="url(#glow)"><ellipse cx="1350" cy="900" rx="1300" ry="260" fill="#1d6c7c" opacity="0.55"/></g>
      ${aurora(rand, { id: 'a1', from: 120, to: 2300, base: 760, amplitude: -120, height: 520, color: '#5fd3e6' })}
      ${aurora(rand, { id: 'a2', from: 900, to: 2560, base: 640, amplitude: -80, height: 360, color: '#4fe0b5' })}
      ${ridges(rand, [
        { base: 1110, height: 130, fill: '#152637', light: '#2a4a5e', rough: 0.5 },
        { base: 1220, height: 110, fill: '#0f1b27', light: '#1c3243' },
        { base: 1330, height: 90, fill: '#0b131c', light: '#142331' },
        { base: 1460, height: 60, fill: '#070b11', light: '#0d1620' },
      ], '#5fd3e6')}`);
  },
  // Dusk: the same hills, a violet and cyan glow on the horizon.
  'nasdash-dusk': () => {
    const rand = random(23);
    return svg(`
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08090f"/><stop offset="0.45" stop-color="#15162b"/><stop offset="0.7" stop-color="#2f2a55"/><stop offset="0.82" stop-color="#2a5b72"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="110"/></filter>`,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
      ${stars(rand, 260, H * 0.5, 0.65)}
      <g filter="url(#glow)"><ellipse cx="1700" cy="1080" rx="1000" ry="220" fill="#5fd3e6" opacity="0.4"/><ellipse cx="700" cy="1020" rx="900" ry="220" fill="#8b7cf6" opacity="0.32"/></g>
      ${ridges(rand, [
        { base: 1110, height: 150, fill: '#24264a', light: '#3d3f6b', rough: 0.5 },
        { base: 1220, height: 120, fill: '#1a1b35', light: '#2a2c4d' },
        { base: 1330, height: 100, fill: '#121327', light: '#1d1f38' },
        { base: 1460, height: 70, fill: '#0a0b16', light: '#121427' },
      ], '#8b7cf6')}`);
  },
  // Abstract: soft light drifting over a dark surface.
  'nasdash-mist': () => svg(`
      <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="190"/></filter>`,
      `<rect width="${W}" height="${H}" fill="#0a0d13"/>
      <g filter="url(#soft)">
        <ellipse cx="700" cy="380" rx="820" ry="440" fill="#1d6e80" opacity="0.8"/>
        <ellipse cx="1950" cy="1180" rx="980" ry="480" fill="#38377f" opacity="0.65"/>
        <ellipse cx="1500" cy="600" rx="560" ry="320" fill="#5fd3e6" opacity="0.32"/>
        <ellipse cx="350" cy="1400" rx="700" ry="360" fill="#103a46" opacity="0.8"/>
      </g>`, 0.08),
  // Abstract: three wide ribbons of light, like slow water seen from above.
  'nasdash-waves': () => {
    const ribbon = (id, y, lift, from, to, opacity) =>
      `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`
      + `<path d="M-200,${H + 200} L-200,${y} C500,${y - lift} 1000,${y + lift * 1.3} 1600,${y - lift * 0.2} S2400,${y - lift * 1.1} ${W + 200},${y - lift * 0.4} L${W + 200},${H + 200} Z" fill="url(#${id})" opacity="${opacity}"/>`;
    return svg(`
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080b11"/><stop offset="1" stop-color="#0c1720"/></linearGradient>
      <filter id="edge" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="140"/></filter>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#080b11" stop-opacity="0"/><stop offset="1" stop-color="#080b11" stop-opacity="0.9"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
      <g filter="url(#glow)"><ellipse cx="1500" cy="760" rx="900" ry="300" fill="#5fd3e6" opacity="0.22"/></g>
      <g filter="url(#edge)">
        ${ribbon('r1', 620, 260, '#10303d', '#1a4d63', 0.95)}
        ${ribbon('r2', 860, 220, '#14485a', '#2b8399', 0.9)}
        ${ribbon('r3', 1100, 180, '#0d2a36', '#164a5c', 0.95)}
      </g>
      <rect width="${W}" height="${H}" fill="url(#fade)"/>`);
  },
  // Light: pale morning hills, for the light mode.
  'nasdash-dawn': () => {
    const rand = random(5);
    return svg(`
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e4ec"/><stop offset="0.6" stop-color="#eceff1"/><stop offset="0.78" stop-color="#f5ece2"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="120"/></filter>`,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
      <g filter="url(#glow)"><ellipse cx="1650" cy="920" rx="760" ry="260" fill="#ffffff" opacity="0.95"/><ellipse cx="700" cy="480" rx="820" ry="320" fill="#b9e3ec" opacity="0.6"/></g>
      ${ridges(rand, [
        { base: 1080, height: 130, fill: '#c3d1db', light: '#dbe5ec', rough: 0.4 },
        { base: 1190, height: 110, fill: '#a6b9c7', light: '#bfcfda' },
        { base: 1310, height: 95, fill: '#869daf', light: '#9db1c0' },
        { base: 1450, height: 70, fill: '#667e91', light: '#7a90a2' },
      ], '#ffffff')}`, 0.035);
  },
};

for (const [name, draw] of Object.entries(wallpapers)) {
  const file = path.join(OUT, `${name}.jpg`);
  await sharp(Buffer.from(draw())).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(file);
  console.log(file);
}
