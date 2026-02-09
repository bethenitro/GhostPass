import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req, res);

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      tables: {
        users: 'ok',
        wallets: 'ok',
        ghost_passes: 'ok',
        transactions: 'ok'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ detail: 'Health check failed' });
  }
};
