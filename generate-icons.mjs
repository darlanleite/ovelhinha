// Gera ícones PNG para PWA a partir do SVG da Ovelhinha
// Rode: node generate-icons.mjs
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const svgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Fundo azul -->
  <rect width="56" height="56" rx="12" fill="#5B8CFF"/>
  <!-- Corpo da lã -->
  <circle cx="22" cy="26" r="13" fill="#C8C3BB"/>
  <circle cx="34" cy="26" r="11" fill="#C8C3BB"/>
  <circle cx="28" cy="20" r="11" fill="#C8C3BB"/>
  <circle cx="18" cy="22" r="9" fill="#C8C3BB"/>
  <circle cx="36" cy="22" r="9" fill="#C8C3BB"/>
  <!-- Rosto -->
  <ellipse cx="28" cy="31" rx="9" ry="8" fill="#5B8CFF"/>
  <!-- Olhos -->
  <circle cx="25" cy="30" r="1.5" fill="white"/>
  <circle cx="31" cy="30" r="1.5" fill="white"/>
  <!-- Nariz -->
  <ellipse cx="28" cy="33.5" rx="2" ry="1.2" fill="#3D6FE8"/>
  <!-- Pulseira -->
  <rect x="38" y="34" width="12" height="5" rx="2.5" fill="#FFB347"/>
  <circle cx="44" cy="36.5" r="1.5" fill="#FF8C00" opacity="0.7"/>
  <!-- Pernas -->
  <rect x="22" y="38" width="4" height="8" rx="2" fill="#D9D4CC"/>
  <rect x="30" y="38" width="4" height="8" rx="2" fill="#D9D4CC"/>
</svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(svgIcon(size)))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`✓ icon-${size}.png`);
}

await sharp(Buffer.from(svgIcon(180)))
  .resize(180, 180)
  .png()
  .toFile('public/apple-touch-icon.png');
console.log('✓ apple-touch-icon.png');
