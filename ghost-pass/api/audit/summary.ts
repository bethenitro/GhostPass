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

    const days = parseInt((req.query.days as string) || '30');

    res.status(200).json({
      summary: {
        total_scans: 0,
        total_creates: 0,
        total_edits: 0,
        total_deactivations: 0,
        total_activations: 0,
        total_deletions: 0,
        period_days: days,
        start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Audit summary error:', error);
    res.status(500).json({ detail: 'Failed to fetch audit summary' });
  }
};
