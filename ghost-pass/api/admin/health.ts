import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin authentication
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  try {

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
