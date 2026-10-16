import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRANDING_DIR = path.join(process.cwd(), 'public', 'assets', 'branding');
fs.mkdirSync(BRANDING_DIR, { recursive: true });

// SVG of the official SBG MUSIC logo matching the user's uploaded master logo
export const SBG_MUSIC_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Background -->
  <rect width="512" height="512" fill="#141416" rx="48"/>
  
  <!-- Headphones Arc (Band) -->
  <path d="M120 250 C120 120, 392 120, 392 250" fill="none" stroke="#8B5CF6" stroke-width="32" stroke-linecap="round"/>
  
  <!-- Left Ear Cushion (Magenta / Vibrant Pink) -->
  <rect x="74" y="215" width="68" height="155" rx="34" fill="#D946EF" filter="drop-shadow(0 4px 12px rgba(217, 70, 239, 0.4))"/>
  <!-- Left Ear Cushion Inner Highlight -->
  <rect x="92" y="245" width="14" height="75" rx="7" fill="#FDF4FF" opacity="0.9"/>

  <!-- Right Ear Cushion (Magenta / Vibrant Pink) -->
  <rect x="370" y="215" width="68" height="155" rx="34" fill="#D946EF" filter="drop-shadow(0 4px 12px rgba(217, 70, 239, 0.4))"/>
  <!-- Right Ear Cushion Inner Highlight -->
  <rect x="406" y="245" width="14" height="75" rx="7" fill="#FDF4FF" opacity="0.9"/>

  <!-- Text "SBG" in Center -->
  <text x="256" y="300" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="78" fill="#F3F4F6" letter-spacing="4">SBG</text>

  <!-- Text "M U S I C" below -->
  <text x="256" y="445" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="36" fill="#A855F7" letter-spacing="18">MUSIC</text>
</svg>`;

// App Icon SVG (Optimized with rounded corners or circular for adaptive icon)
export const SBG_APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Icon Background -->
  <rect width="512" height="512" fill="#121214" rx="112"/>
  
  <!-- Outer Glow Ring -->
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#8B5CF6" stroke-width="6" opacity="0.4"/>
  
  <!-- Headphones Arc (Band) -->
  <path d="M120 240 C120 110, 392 110, 392 240" fill="none" stroke="url(#headbandGrad)" stroke-width="34" stroke-linecap="round"/>
  
  <defs>
    <linearGradient id="headbandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="50%" stop-color="#A855F7"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
  </defs>

  <!-- Left Ear Cushion -->
  <rect x="72" y="210" width="70" height="155" rx="35" fill="#D946EF"/>
  <rect x="90" y="240" width="14" height="75" rx="7" fill="#FFFFFF" opacity="0.95"/>

  <!-- Right Ear Cushion -->
  <rect x="370" y="210" width="70" height="155" rx="35" fill="#D946EF"/>
  <rect x="408" y="240" width="14" height="75" rx="7" fill="#FFFFFF" opacity="0.95"/>

  <!-- Text "SBG" in Center -->
  <text x="256" y="295" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="82" fill="#FFFFFF" letter-spacing="4">SBG</text>

  <!-- Text "M U S I C" below -->
  <text x="256" y="440" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="38" fill="#C084FC" letter-spacing="16">MUSIC</text>
</svg>`;

// Default Music Artwork (for songs without cover)
export const SBG_DEFAULT_ARTWORK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="50%" stop-color="#2e1065"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bgGrad)"/>
  <circle cx="300" cy="270" r="220" fill="url(#glow)"/>

  <!-- Headphones -->
  <path d="M160 280 C160 140, 440 140, 440 280" fill="none" stroke="#A855F7" stroke-width="36" stroke-linecap="round"/>
  <rect x="110" y="250" width="75" height="160" rx="37" fill="#D946EF"/>
  <rect x="130" y="280" width="14" height="80" rx="7" fill="#FFFFFF" opacity="0.9"/>
  <rect x="415" y="250" width="75" height="160" rx="37" fill="#D946EF"/>
  <rect x="455" y="280" width="14" height="80" rx="7" fill="#FFFFFF" opacity="0.9"/>

  <text x="300" y="335" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="88" fill="#F9FAFB" letter-spacing="6">SBG</text>
  <text x="300" y="495" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="42" fill="#D8B4FE" letter-spacing="20">MUSIC</text>
</svg>`;

// Default User Avatar SVG
export const SBG_DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <linearGradient id="avGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#C026D3"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="128" fill="url(#avGrad)"/>
  <circle cx="128" cy="95" r="42" fill="#FFFFFF" opacity="0.95"/>
  <path d="M48 215 C48 165, 85 160, 128 160 C171 160, 208 165, 208 215" fill="#FFFFFF" opacity="0.95"/>
</svg>`;

async function main() {
  console.log('[Branding] Generating official SBG MUSIC assets...');

  // Save SVGs
  fs.writeFileSync(path.join(BRANDING_DIR, 'sbg-music-logo.svg'), SBG_MUSIC_LOGO_SVG);
  fs.writeFileSync(path.join(BRANDING_DIR, 'sbg-music-icon.svg'), SBG_APP_ICON_SVG);
  fs.writeFileSync(path.join(BRANDING_DIR, 'sbg-default-artwork.svg'), SBG_DEFAULT_ARTWORK_SVG);
  fs.writeFileSync(path.join(BRANDING_DIR, 'sbg-default-avatar.svg'), SBG_DEFAULT_AVATAR_SVG);

  const logoBuffer = Buffer.from(SBG_MUSIC_LOGO_SVG);
  const iconBuffer = Buffer.from(SBG_APP_ICON_SVG);
  const artworkBuffer = Buffer.from(SBG_DEFAULT_ARTWORK_SVG);
  const avatarBuffer = Buffer.from(SBG_DEFAULT_AVATAR_SVG);

  // Generate PNGs
  await sharp(logoBuffer).resize(512, 512).png().toFile(path.join(BRANDING_DIR, 'sbg-music-logo.png'));
  await sharp(iconBuffer).resize(512, 512).png().toFile(path.join(BRANDING_DIR, 'sbg-music-icon.png'));
  await sharp(artworkBuffer).resize(600, 600).png().toFile(path.join(BRANDING_DIR, 'sbg-default-artwork.png'));
  await sharp(avatarBuffer).resize(256, 256).png().toFile(path.join(BRANDING_DIR, 'sbg-default-avatar.png'));

  // Splash Screen (1080x1920 with centered logo on dark canvas)
  const logoForSplash = await sharp(logoBuffer).resize(600, 600).toBuffer();
  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 18, g: 18, b: 20, alpha: 1 },
    },
  })
    .composite([{ input: logoForSplash, gravity: 'centre' }])
    .png()
    .toFile(path.join(BRANDING_DIR, 'sbg-music-splash.png'));

  // Public PWA and browser icons
  const publicDir = path.join(process.cwd(), 'public');
  await sharp(iconBuffer).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'));
  await sharp(iconBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(iconBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(iconBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(iconBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  console.log('[Branding] Official assets generated successfully!');
}

main().catch((err) => {
  console.error('[Branding] Error generating assets:', err);
  process.exit(1);
});
