import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve(process.cwd(), 'public');

// SVG with modern SBG Music logo
const regularSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="50%" stop-color="#12111d"/>
      <stop offset="100%" stop-color="#1b102b"/>
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="110" fill="url(#bgGrad)"/>
  
  <!-- Subtle Outer Rim -->
  <rect width="504" height="504" x="4" y="4" rx="106" fill="none" stroke="url(#neonGrad)" stroke-width="4" stroke-opacity="0.3"/>

  <!-- Glowing Soundwave / SBG Icon Geometry -->
  <g transform="translate(106, 116)">
    <!-- Equalizer Bar 1 -->
    <rect x="20" y="140" width="36" height="80" rx="18" fill="url(#primaryGrad)" opacity="0.85"/>
    <!-- Equalizer Bar 2 -->
    <rect x="76" y="80" width="36" height="140" rx="18" fill="url(#primaryGrad)"/>
    <!-- Equalizer Bar 3 (Center High) -->
    <rect x="132" y="20" width="36" height="200" rx="18" fill="url(#primaryGrad)" filter="url(#glow)"/>
    <!-- Equalizer Bar 4 -->
    <rect x="188" y="60" width="36" height="160" rx="18" fill="url(#primaryGrad)"/>
    <!-- Equalizer Bar 5 -->
    <rect x="244" y="110" width="36" height="110" rx="18" fill="url(#primaryGrad)" opacity="0.9"/>
  </g>

  <!-- Modern Dynamic Note Accent -->
  <circle cx="370" cy="140" r="18" fill="#38bdf8" filter="url(#glow)"/>
  <circle cx="140" cy="380" r="14" fill="#a855f7" filter="url(#glow)"/>
</svg>`;

// Maskable SVG with safe-zone margin (15% padding)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#1b102b"/>
    </linearGradient>
    <linearGradient id="primaryGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <!-- Full Bleed Background for Safe Cropping -->
  <rect width="512" height="512" fill="url(#bgGradMask)"/>

  <!-- Centered Inner Safe-Zone Content -->
  <g transform="translate(146, 156) scale(0.72)">
    <rect x="20" y="140" width="36" height="80" rx="18" fill="url(#primaryGradMask)" opacity="0.85"/>
    <rect x="76" y="80" width="36" height="140" rx="18" fill="url(#primaryGradMask)"/>
    <rect x="132" y="20" width="36" height="200" rx="18" fill="url(#primaryGradMask)"/>
    <rect x="188" y="60" width="36" height="160" rx="18" fill="url(#primaryGradMask)"/>
    <rect x="244" y="110" width="36" height="110" rx="18" fill="url(#primaryGradMask)" opacity="0.9"/>
  </g>
</svg>`;

async function generate() {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write SVG files
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), regularSvg);
  console.log('Written public/icon.svg');

  // 2. Generate 512x512 PWA Icon
  await sharp(Buffer.from(regularSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 3. Generate 192x192 PWA Icon
  await sharp(Buffer.from(regularSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 4. Generate Maskable 512x512
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 5. Generate Apple Touch Icon 180x180
  await sharp(Buffer.from(regularSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 6. Generate Favicon PNG 64x64
  await sharp(Buffer.from(regularSvg))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated favicon.png');

  console.log('All PWA icons generated successfully!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
