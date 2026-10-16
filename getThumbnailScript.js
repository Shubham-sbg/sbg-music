import fetch from 'node-fetch';
fetch('http://localhost:3000/api/youtube/playlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jCETgqZ8DZ1Wv5LqN52Wd' })
})
.then(res => res.json())
.then(console.log)
