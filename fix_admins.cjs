const fs = require('fs');
const files = [
  'src/pages/Admin.tsx',
  'src/pages/AdminPlaylists.tsx',
  'src/pages/AdminSongs.tsx',
  'src/components/Navigation.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /user\?\.email === 'sbg\.esports07@gmail\.com'/g,
    "['sbg.esports07@gmail.com', 'official7sbgarmy7@gmail.com', 'official7sbgarmy7@gamil.com'].includes(user?.email || '')"
  );
  content = content.replace(
    /user\.email !== 'sbg\.esports07@gmail\.com'/g,
    "!['sbg.esports07@gmail.com', 'official7sbgarmy7@gmail.com', 'official7sbgarmy7@gamil.com'].includes(user.email || '')"
  );
  fs.writeFileSync(file, content);
});

let firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
firestoreRules = firestoreRules.replace(
  /request\.auth\.token\.email == 'sbg\.esports07@gmail\.com'/g,
  "request.auth.token.email in ['sbg.esports07@gmail.com', 'official7sbgarmy7@gmail.com', 'official7sbgarmy7@gamil.com']"
);
fs.writeFileSync('firestore.rules', firestoreRules);

let storageRules = fs.readFileSync('storage.rules', 'utf8');
storageRules = storageRules.replace(
  /request\.auth\.token\.email == 'sbg\.esports07@gmail\.com'/g,
  "request.auth.token.email in ['sbg.esports07@gmail.com', 'official7sbgarmy7@gmail.com', 'official7sbgarmy7@gamil.com']"
);
fs.writeFileSync('storage.rules', storageRules);

console.log("Updated all admin checks.");
