const fs = require('fs');
const path = require('path');

const lucideDir = path.join(__dirname, '../node_modules/lucide-react');
if (!fs.existsSync(lucideDir)) {
  console.log('lucide-react not found in node_modules, skipping patch.');
  process.exit(0);
}

const iconsDir = path.join(lucideDir, 'dist/esm/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Create individual ESM icon modules in dist/esm/icons/
const icons = {
  youtube: {
    name: 'youtube',
    node: [
      ['path', { d: 'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17', key: 'yt1' }],
      ['polygon', { points: '10 15 15 12 10 9', key: 'yt2' }]
    ]
  },
  instagram: {
    name: 'instagram',
    node: [
      ['rect', { width: '20', height: '20', x: '2', y: '2', rx: '5', ry: '5', key: 'ig1' }],
      ['path', { d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z', key: 'ig2' }],
      ['line', { x1: '17.5', x2: '17.51', y1: '6.5', y2: '6.5', key: 'ig3' }]
    ]
  },
  twitter: {
    name: 'twitter',
    node: [
      ['path', { d: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z', key: 'tw1' }]
    ]
  },
  facebook: {
    name: 'facebook',
    node: [
      ['path', { d: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z', key: 'fb1' }]
    ]
  }
};

for (const [key, iconDef] of Object.entries(icons)) {
  const iconFilePath = path.join(iconsDir, `${key}.mjs`);
  const content = `import createLucideIcon from '../createLucideIcon.mjs';
const __iconData = ${JSON.stringify({ name: iconDef.name, size: 24, node: iconDef.node })};
const IconComponent = createLucideIcon(__iconData);
export { __iconData, IconComponent as default };
`;
  fs.writeFileSync(iconFilePath, content, 'utf8');
}

// 2. Export in dist/esm/lucide-react.mjs
const esmFile = path.join(lucideDir, 'dist/esm/lucide-react.mjs');
if (fs.existsSync(esmFile)) {
  let content = fs.readFileSync(esmFile, 'utf8');
  const exportStatements = `
export { default as Youtube, default as YoutubeIcon } from './icons/youtube.mjs';
export { default as Instagram, default as InstagramIcon } from './icons/instagram.mjs';
export { default as Twitter, default as TwitterIcon } from './icons/twitter.mjs';
export { default as Facebook, default as FacebookIcon } from './icons/facebook.mjs';
`;
  if (!content.includes('./icons/youtube.mjs')) {
    content += exportStatements;
    fs.writeFileSync(esmFile, content, 'utf8');
    console.log('Exported brand icons in dist/esm/lucide-react.mjs');
  }
}

// 3. Export in dist/cjs/lucide-react.js
const cjsFile = path.join(lucideDir, 'dist/cjs/lucide-react.js');
if (fs.existsSync(cjsFile)) {
  let content = fs.readFileSync(cjsFile, 'utf8');
  if (!content.includes('exports.Youtube =')) {
    const cjsPatch = `
const __ytData = ${JSON.stringify({ name: 'youtube', size: 24, node: icons.youtube.node })};
const __igData = ${JSON.stringify({ name: 'instagram', size: 24, node: icons.instagram.node })};
const __twData = ${JSON.stringify({ name: 'twitter', size: 24, node: icons.twitter.node })};
const __fbData = ${JSON.stringify({ name: 'facebook', size: 24, node: icons.facebook.node })};

exports.Youtube = createLucideIcon(__ytData);
exports.YoutubeIcon = exports.Youtube;
exports.Instagram = createLucideIcon(__igData);
exports.InstagramIcon = exports.Instagram;
exports.Twitter = createLucideIcon(__twData);
exports.TwitterIcon = exports.Twitter;
exports.Facebook = createLucideIcon(__fbData);
exports.FacebookIcon = exports.Facebook;
`;
    content += cjsPatch;
    fs.writeFileSync(cjsFile, content, 'utf8');
    console.log('Exported brand icons in dist/cjs/lucide-react.js');
  }
}

// 4. Patch d.ts
const dtsFiles = [
  path.join(lucideDir, 'dist/lucide-react.d.ts'),
  path.join(lucideDir, 'dist/lucide-react.prefixed.d.ts'),
  path.join(lucideDir, 'dist/lucide-react.suffixed.d.ts')
];

const dtsPatch = `
declare const Youtube: LucideIcon;
declare const YoutubeIcon: LucideIcon;
declare const Instagram: LucideIcon;
declare const InstagramIcon: LucideIcon;
declare const Twitter: LucideIcon;
declare const TwitterIcon: LucideIcon;
declare const Facebook: LucideIcon;
declare const FacebookIcon: LucideIcon;
export { Youtube, Youtube as YoutubeIcon, Instagram, Instagram as InstagramIcon, Twitter, Twitter as TwitterIcon, Facebook, Facebook as FacebookIcon };
`;

dtsFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('declare const Youtube: LucideIcon')) {
      content += dtsPatch;
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Patched ${path.basename(file)}`);
    }
  }
});

console.log('lucide-react brand icons patched cleanly.');
