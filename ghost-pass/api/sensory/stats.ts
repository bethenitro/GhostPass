import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req, res);

    res.status(200).json({
      stats: {
        total_signals: 0,
        total_processed: 0,
        total_pending: 0,
        success_rate: 0,
        average_processing_time_ms: 0,
        last_signal_timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ detail: 'Failed to fetch stats' });
  }
};
