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
      stats: {
        total_evaluations: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        average_trust_score: 0,
        last_evaluation_timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get senate stats error:', error);
    res.status(500).json({ detail: 'Failed to fetch senate stats' });
  }
};
