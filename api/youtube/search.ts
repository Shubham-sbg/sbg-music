// Serverless Vercel API Route for YouTube Search
import { handleYouTubeSearchRequest } from '../lib/youtubeSearchHandler';

export default async function handler(req: any, res: any) {
  // Pass the request to the shared canonical handler
  return handleYouTubeSearchRequest(req, res);
}
