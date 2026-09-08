import type { VercelRequest, VercelResponse } from '@vercel/node';
import { identifyHandler } from '../server/handlers.js';
import { getVercelBody } from '../server/request.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let parsedBody;
  try {
    parsedBody = getVercelBody(req.body);
  } catch {
    res.status(400).json({
      status: 'error',
      message: 'リクエスト形式が不正です',
      candidates: [],
      provider: 'plantnet',
    });
    return;
  }

  const result = await identifyHandler(parsedBody);
  res.status(result.status).json(result.body);
}
