import type { VercelRequest, VercelResponse } from './types.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
