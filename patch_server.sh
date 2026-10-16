#!/bin/bash
cat << 'INNER_EOF' > /tmp/serverYoutube.patch
--- src/lib/serverYoutube.ts
+++ src/lib/serverYoutube.ts
@@ -235,7 +235,7 @@
   };
 }
 
-export async function fetchYouTubePlaylist(playlistId: string) {
+export async function fetchYouTubePlaylist(playlistId: string, pageToken?: string) {
   const apiKey = process.env.YOUTUBE_API_KEY;
 
   if (apiKey) {
@@ -257,11 +257,9 @@
             `https://img.youtube.com/vi/${playlistId}/hqdefault.jpg`;
 
           let items: any[] = [];
-          let pageToken = '';
-          let pagesCount = 0;
-          do {
-            pagesCount++;
-            const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
+          let nextPageToken = '';
+          
+            const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
             const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}${pageParam}&key=${apiKey}`;
             const itemsRes = await fetch(url);
             if (!itemsRes.ok) {
-              const errTxt = await itemsRes.text();
-              console.warn(`YouTube API page failed: ${itemsRes.status}`, errTxt);
-              break;
+              const errTxt = await itemsRes.text();
+              throw new Error(`YouTube API page failed: ${itemsRes.status} ${errTxt}`);
             }
             const itemsData = await itemsRes.json();
             if (itemsData.items) {
@@ -288,14 +286,13 @@
                 });
               }
             }
-            pageToken = itemsData.nextPageToken || '';
-          } while (pageToken);
+            nextPageToken = itemsData.nextPageToken || '';
 
           if (items.length > 0) {
             return {
               id: playlistId,
               title,
               description,
               author,
               thumbnailUrl: thumbnail || items[0]?.thumbnailUrl,
               totalVideos: items.length, // this is just items on this page, but we probably want plData.items[0].contentDetails.itemCount if available?
               videos: items,
               source: 'youtube_api',
+              nextPageToken,
               debug: {
-                pagesFetched: pagesCount,
+                pagesFetched: 1,
                 itemsFetched: items.length,
-                lastNextPageToken: pageToken ? 'present' : 'none',
+                lastNextPageToken: nextPageToken ? 'present' : 'none',
               },
             };
           }
INNER_EOF
patch -p0 < /tmp/serverYoutube.patch
