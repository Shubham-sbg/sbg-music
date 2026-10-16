/**
 * Temporary Production Debugging Utility for YouTube Search API
 * File: scripts/test-yt-search.ts
 *
 * Usage:
 *   npx tsx scripts/test-yt-search.ts
 *   BASE_URL=https://your-production-url.com npx tsx scripts/test-yt-search.ts
 *   npx tsx scripts/test-yt-search.ts "Taylor Swift"
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const QUERY = process.argv[2] || process.env.QUERY || 'Arijit Singh';
const FILTER = process.argv[3] || process.env.FILTER || 'all';

async function testYouTubeSearch() {
  console.log('='.repeat(65));
  console.log('🔍 YouTube Search API Production Debugging Tool');
  console.log(`🌐 Base URL:       ${BASE_URL}`);
  console.log(`🎵 Test Query:     "${QUERY}"`);
  console.log(`📂 Filter:         ${FILTER}`);
  console.log(`⏰ Timestamp:      ${new Date().toISOString()}`);
  console.log('='.repeat(65) + '\n');

  // 1. Test GET Request
  const getUrl = `${BASE_URL}/api/youtube/search?q=${encodeURIComponent(QUERY)}&filter=${encodeURIComponent(FILTER)}`;
  console.log(`[1] Performing GET request to: ${getUrl}`);

  const startGet = Date.now();
  try {
    const getRes = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SBGSongs-Debug-Client/1.0',
      },
    });
    const getDuration = Date.now() - startGet;

    console.log(`  ➔ HTTP Status:   ${getRes.status} ${getRes.statusText}`);
    console.log(`  ➔ Response Time: ${getDuration}ms`);
    console.log(`  ➔ Content-Type:  ${getRes.headers.get('content-type') || 'unknown'}`);

    const rawText = await getRes.text();
    let jsonData: any = null;
    try {
      jsonData = JSON.parse(rawText);
    } catch {
      console.warn('  ⚠️ Response is not valid JSON (could be an HTML error/rewrite)');
    }

    console.log('\n--- GET Response Body ---');
    if (jsonData) {
      console.log(JSON.stringify(jsonData, null, 2));

      if (jsonData.ok) {
        console.log(`\n  ✅ Result Summary: Found ${jsonData.items?.length || 0} items (source: ${jsonData.source || 'unknown'})`);
        if (jsonData.items?.[0]) {
          console.log(`  🎵 Top item: "${jsonData.items[0].title}" by ${jsonData.items[0].artist || jsonData.items[0].channelTitle}`);
        }
      } else {
        console.error(`\n  ❌ Error Returned: code=${jsonData.code}, message="${jsonData.error}"`);
      }
    } else {
      console.log(rawText.slice(0, 1000));
    }
  } catch (error: any) {
    console.error(`  ❌ Network/Fetch Error (GET):`, error.message || error);
  }

  // 2. Test POST Request
  const postUrl = `${BASE_URL}/api/youtube/search`;
  console.log(`\n[2] Performing POST request to: ${postUrl}`);

  const startPost = Date.now();
  try {
    const postRes = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SBGSongs-Debug-Client/1.0',
      },
      body: JSON.stringify({
        q: QUERY,
        filter: FILTER,
      }),
    });
    const postDuration = Date.now() - startPost;

    console.log(`  ➔ HTTP Status:   ${postRes.status} ${postRes.statusText}`);
    console.log(`  ➔ Response Time: ${postDuration}ms`);
    console.log(`  ➔ Content-Type:  ${postRes.headers.get('content-type') || 'unknown'}`);

    const postRawText = await postRes.text();
    let postJsonData: any = null;
    try {
      postJsonData = JSON.parse(postRawText);
    } catch {
      // Non-JSON response
    }

    console.log('\n--- POST Response Body ---');
    if (postJsonData) {
      console.log(JSON.stringify(postJsonData, null, 2));
    } else {
      console.log(postRawText.slice(0, 1000));
    }
  } catch (error: any) {
    console.error(`  ❌ Network/Fetch Error (POST):`, error.message || error);
  }

  console.log('\n' + '='.repeat(65));
  console.log('🏁 Debug Test Complete');
  console.log('='.repeat(65));
}

testYouTubeSearch().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
