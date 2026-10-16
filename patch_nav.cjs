const fs = require('fs');
let code = fs.readFileSync('src/components/Navigation.tsx', 'utf-8');

const importStr = `import { Home, Music, ListMusic, Search } from 'lucide-react';`;
const newImportStr = `import { Home, Music, ListMusic, Search, Heart } from 'lucide-react';`;
code = code.replace(importStr, newImportStr);

const itemsStr = `    { name: 'Playlists', path: '/playlists', icon: <ListMusic size={24} /> },
    { name: 'Search', path: '/search', icon: <Search size={24} /> },
  ];`;
const newItemsStr = `    { name: 'Playlists', path: '/playlists', icon: <ListMusic size={24} /> },
    { name: 'Search', path: '/search', icon: <Search size={24} /> },
    { name: 'Favorites', path: '/favorites', icon: <Heart size={24} /> },
  ];`;
code = code.replace(itemsStr, newItemsStr);

fs.writeFileSync('src/components/Navigation.tsx', code);
