export default function handler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  }
  return res.status(200).json({
    ok: true,
    status: 'ok',
    runtime: 'vercel',
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    time: new Date().toISOString(),
  });
}
