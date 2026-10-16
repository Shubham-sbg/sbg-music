const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

// Add import
const importStr = `import AdPlacementBanner from '../components/AdPlacementBanner';`;
const newImportStr = `import AdPlacementBanner from '../components/AdPlacementBanner';\nimport RecentlyPlayedSection from '../components/RecentlyPlayedSection';`;
code = code.replace(importStr, newImportStr);

// Add section
const sectionStr = `{/* RECENTLY ADDED SECTION */}
      <section>`;
const newSectionStr = `<RecentlyPlayedSection />\n\n      {/* RECENTLY ADDED SECTION */}
      <section>`;
code = code.replace(sectionStr, newSectionStr);

fs.writeFileSync('src/pages/Home.tsx', code);
