import type { VercelRequest, VercelResponse } from '@vercel/node';
import { healthHandler } from '../server/handlers';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const result = healthHandler();
  res.status(result.status).json(result.body);
}
