const fs = require('fs');
const path = require('path');
const OUT = __dirname;

// 顺便记 logo — timer-ring + check, monochrome with a single accent.
// Grey progress ring = the timing; accent check = the logged record.
const ACCENT = '#0a84ff';
const RING_ON_DARK = '#a1a1a8';
const RING_ON_LIGHT = '#c9c9ce';

const makeSvg = (size, { maskable = false, light = false } = {}) => {
  const c = size / 2;
  const r = size * 0.293;          // ring radius
  const sw = Math.round(size * 0.0625);
  const circ = 2 * Math.PI * r;
  const dash = `${(circ * 0.75).toFixed(3)} ${(circ * 0.25).toFixed(3)}`;
  const rx = maskable ? 0 : Math.round(size * 0.2227);
  const scale = maskable ? 0.82 : 1;     // keep mark inside the maskable safe zone
  const ringColor = light ? RING_ON_LIGHT : RING_ON_DARK;

  // check geometry (relative to ring radius), centered on the canvas
  const p = (m) => (c + r * m).toFixed(2);
  const check =
    `M ${p(-0.72)} ${p(0.03)} L ${p(-0.30)} ${p(0.44)} L ${p(0.44)} ${p(-0.35)}`;

  const bg = light
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="#ffffff"/>` +
      `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${rx - 1}" fill="none" stroke="#ececee" stroke-width="2"/>`
    : `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#2c2c31"/><stop offset="1" stop-color="#161619"/></linearGradient></defs>` +
      `<rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg}
  <g transform="translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})">
    <circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none" stroke="${ringColor}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${c} ${c})"/>
    <path d="${check}" fill="none" stroke="${ACCENT}" stroke-width="${Math.round(sw * 1.06)}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
};

const write = (name, svg) => fs.writeFileSync(path.join(OUT, name), svg);

write('icon-512.svg', makeSvg(512));
write('icon-192.svg', makeSvg(192));
write('icon-maskable-512.svg', makeSvg(512, { maskable: true }));
write('icon-maskable-192.svg', makeSvg(192, { maskable: true }));

console.log('SVGs generated. Rasterize to matching PNGs (icon-192/512, maskable, apple-touch-icon 180) before shipping.');
