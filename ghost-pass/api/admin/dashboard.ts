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
      dashboard: {
        total_users: 0,
        total_revenue_cents: 0,
        active_passes: 0,
        pending_payouts: 0,
        system_health: 'operational'
      },
      fee_config: {
        entry: 25,
        bar: 50,
        merch: 75,
        general: 50
      },
      distribution: {
        validPlatformPercentage: 40,
        vendorPercentage: 35,
        poolPercentage: 15,
        promoterPercentage: 10
      },
      pricing: {
        1: 1000,
        3: 2000,
        5: 3500,
        7: 5000,
        10: 6500,
        14: 8500,
        30: 10000
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ detail: 'Failed to fetch dashboard' });
  }
};
