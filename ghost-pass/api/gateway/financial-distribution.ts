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
      distribution: {
        validPlatformPercentage: 40,
        vendorPercentage: 35,
        poolPercentage: 15,
        promoterPercentage: 10
      },
      total_revenue_cents: 0,
      period: 'current_month'
    });
  } catch (error) {
    console.error('Financial distribution error:', error);
    res.status(500).json({ detail: 'Failed to fetch financial distribution' });
  }
};
