import fs from 'fs';
import path from 'path';
import { db } from './src/lib/firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getSiteUrl, toCanonicalUrl } from './src/config/site.js';

const BASE_URL = getSiteUrl();

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

async function generateSitemap() {
  console.log('🚀 Starting Sitemap Generation...');
  console.log(`📡 Target Base URL: ${BASE_URL}`);

  try {
    // 1. Fetch official songs
    const songsSnap = await getDocs(collection(db, 'songs'));
    const songs = songsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch official playlists
    const playlistsSnap = await getDocs(collection(db, 'playlists'));
    const playlists = playlistsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Fetch public user playlists using strict equality query to conform to Firestore security rules
    const userPlaylistsQuery = query(collection(db, 'userPlaylists'), where('visibility', '==', 'public'));
    const userPlaylistsSnap = await getDocs(userPlaylistsQuery);
    const publicUserPlaylists = userPlaylistsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`🎵 Songs fetched: ${songs.length}`);
    console.log(`🎶 Official Playlists fetched: ${playlists.length}`);
    console.log(`👥 Public User Playlists fetched: ${publicUserPlaylists.length}`);

    // Public static routes (Explicitly excluding /admin, /staff, /login, /signup, /my-playlists, /favorites, /search)
    const staticPublicRoutes = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/songs', priority: '0.9', changefreq: 'daily' },
      { path: '/playlists', priority: '0.9', changefreq: 'daily' },
      { path: '/generate', priority: '0.9', changefreq: 'daily' },
      { path: '/download', priority: '0.9', changefreq: 'weekly' },
      { path: '/youtube', priority: '0.8', changefreq: 'weekly' },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static public routes
    for (const route of staticPublicRoutes) {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(toCanonicalUrl(route.path))}</loc>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Public Songs
    for (const song of songs) {
      if (!song.id) continue;
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(toCanonicalUrl(`/song/${song.id}`))}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // Official Playlists
    for (const playlist of playlists) {
      if (!playlist.id) continue;
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(toCanonicalUrl(`/playlist/${playlist.id}`))}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // Public Community Playlists
    for (const userPl of publicUserPlaylists) {
      if (!userPl.id) continue;
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(toCanonicalUrl(`/user-playlist/${userPl.id}`))}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    // Write sitemap.xml to root directory and public directory
    const rootPath = path.join(process.cwd(), 'sitemap.xml');
    const publicPath = path.join(process.cwd(), 'public', 'sitemap.xml');

    fs.writeFileSync(rootPath, xml, 'utf-8');
    fs.writeFileSync(publicPath, xml, 'utf-8');

    const totalUrls = staticPublicRoutes.length + songs.length + playlists.length + publicUserPlaylists.length;
    console.log(`✅ Sitemap successfully generated with ${totalUrls} URLs!`);
    console.log(`📄 Saved to root: ${rootPath}`);
    console.log(`📄 Saved to public: ${publicPath}`);

    process.exit(0);
  } catch (err: any) {
    console.warn('⚠️ Warning: Could not fetch dynamic items from Firestore for sitemap (e.g. daily quota reached or offline):', err?.message || err);
    
    const rootPath = path.join(process.cwd(), 'sitemap.xml');
    const publicPath = path.join(process.cwd(), 'public', 'sitemap.xml');

    if (fs.existsSync(publicPath)) {
      console.log('ℹ️ Retaining existing public/sitemap.xml file.');
      if (!fs.existsSync(rootPath)) {
        try { fs.copyFileSync(publicPath, rootPath); } catch {}
      }
      process.exit(0);
    }

    // Generate static routes fallback sitemap
    console.log('Generating fallback static sitemap...');
    let fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    const staticRoutes = ['/', '/songs', '/playlists', '/generate', '/download', '/youtube'];
    for (const r of staticRoutes) {
      fallbackXml += `  <url>\n    <loc>${escapeXml(toCanonicalUrl(r))}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    }
    fallbackXml += `</urlset>`;

    try {
      fs.writeFileSync(rootPath, fallbackXml, 'utf-8');
      fs.writeFileSync(publicPath, fallbackXml, 'utf-8');
      console.log('✅ Fallback sitemap written successfully.');
    } catch (writeErr) {
      console.error('Failed to write fallback sitemap:', writeErr);
    }

    process.exit(0);
  }
}

generateSitemap();
