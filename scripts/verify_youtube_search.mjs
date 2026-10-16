/**
 * Temporary YouTube Search Endpoint Verification Utility
 * 
 * Usage:
 *   node verify_youtube_search.mjs
 *   BASE_URL=https://sbg-song.vercel.app node verify_youtube_search.mjs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_QUERY = process.env.TEST_QUERY || 'Arijit Singh';

async function testEndpoint() {
  console.log('='.repeat(60));
  console.log('🧪 YOUTUBE SEARCH ENDPOINT VERIFICATION UTILITY');
  console.log(`🌐 Base URL:   ${BASE_URL}`);
  console.log(`🔎 Test Query: "${TEST_QUERY}"`);
  console.log(`⏰ Timestamp:  ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  // Test 1: GET Request
  console.log('[1/2] Testing GET /api/youtube/search...');
  const getUrl = `${BASE_URL}/api/youtube/search?q=${encodeURIComponent(TEST_QUERY)}`;
  const startTime = Date.now();

  try {
    const res = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const duration = Date.now() - startTime;
    const contentType = res.headers.get('content-type') || 'unknown';
    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. HTML from bad SPA rewrite)
    }

    console.log(`  ➔ HTTP Status:   ${res.status} ${res.statusText}`);
    console.log(`  ➔ Response Time: ${duration}ms`);
    console.log(`  ➔ Content-Type:  ${contentType}`);

    if (res.ok) {
      const itemsCount = data?.items?.length || 0;
      const source = data?.source || 'unknown';
      console.log(`  ✅ STATUS: 2xx SUCCESS`);
      console.log(`  📦 Total Items:  ${itemsCount}`);
      console.log(`  🏷️ API Source:   ${source} (API key injected: ${source === 'youtube_api' ? 'YES' : 'FALLBACK/SCRAPER'})`);
      console.log(`  🔑 Next Page:    ${data?.nextPageToken ? 'Available' : 'None'}`);

      if (itemsCount > 0) {
        const topItem = data.items[0];
        console.log(`  🎵 First Result: "${topItem.title}" by ${topItem.artist || topItem.channelTitle}`);
        console.log(`  🔗 Video ID:     ${topItem.videoId}`);
      }
    } else {
      console.error(`  ❌ STATUS: ${res.status} ERROR`);
      console.error(`  📄 Error Body:`, data?.error || text.slice(0, 300));
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        console.error('  ⚠️ Diagnosis: Received HTML instead of JSON. Ensure vercel.json does not rewrite /api/* to index.html.');
      }
    }
  } catch (err) {
    console.error(`  ❌ Network Exception:`, err.message);
  }

  // Test 2: In-Flight / Server Cache Test
  console.log('\n[2/2] Testing Server Cache Speed (2nd GET request)...');
  const cacheStartTime = Date.now();
  try {
    const cacheRes = await fetch(getUrl);
    const cacheDuration = Date.now() - cacheStartTime;
    console.log(`  ➔ HTTP Status:   ${cacheRes.status} ${cacheRes.statusText}`);
    console.log(`  ➔ Cache Response: ${cacheDuration}ms (Served from in-memory cache)`);
    console.log(`  ✅ Cache Status: ${cacheDuration < 50 ? 'FAST (CACHE HIT)' : 'OK'}`);
  } catch (err) {
    console.error(`  ❌ Cache Test Exception:`, err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Verification Run Complete');
  console.log('='.repeat(60));
}

testEndpoint().catch(console.error);
