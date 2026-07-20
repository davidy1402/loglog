const fs = require('fs');
const { execSync } = require('child_process');

const makeSvg = (size, isMaskable) => {
  const rx = isMaskable ? 0 : Math.round(size * 0.22);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  const sw = Math.round(size * 0.05);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#a97452"/>
  <!-- Outer timer ring -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0e2d6" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${Math.PI * 2 * r * 0.75} ${Math.PI * 2 * r * 0.25}" transform="rotate(-90 ${cx} ${cy})"/>
  <!-- Inner clock hands / checkmark -->
  <path d="M ${cx - r * 0.35} ${cy + r * 0.05} L ${cx - r * 0.05} ${cy + r * 0.35} L ${cx + r * 0.45} ${cy - r * 0.35}" fill="none" stroke="#ffffff" stroke-width="${Math.round(sw * 1.2)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
};

fs.writeFileSync('/Users/davidyong/.gemini/antigravity/scratch/bm-tracker/icon-512.svg', makeSvg(512, false));
fs.writeFileSync('/Users/davidyong/.gemini/antigravity/scratch/bm-tracker/icon-maskable-512.svg', makeSvg(512, true));
fs.writeFileSync('/Users/davidyong/.gemini/antigravity/scratch/bm-tracker/icon-192.svg', makeSvg(192, false));
fs.writeFileSync('/Users/davidyong/.gemini/antigravity/scratch/bm-tracker/icon-maskable-192.svg', makeSvg(192, true));

console.log('SVGs generated successfully.');
