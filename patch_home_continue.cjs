const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

// Add import
const importStr = `import RecentlyPlayedSection from '../components/RecentlyPlayedSection';`;
const newImportStr = `import RecentlyPlayedSection from '../components/RecentlyPlayedSection';\nimport ContinueListeningSection from '../components/ContinueListeningSection';`;
code = code.replace(importStr, newImportStr);

// Add section
const sectionStr = `<RecentlyPlayedSection />`;
const newSectionStr = `<ContinueListeningSection />\n      <RecentlyPlayedSection />`;
code = code.replace(sectionStr, newSectionStr);

fs.writeFileSync('src/pages/Home.tsx', code);
