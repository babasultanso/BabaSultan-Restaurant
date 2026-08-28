import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAIChatRequest } from '../server/aiService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  return handleAIChatRequest(req as any, res as any);
}
