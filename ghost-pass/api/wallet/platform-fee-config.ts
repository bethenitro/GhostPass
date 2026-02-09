import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

const platformFeeEngine = {
  feeEnabled: true,
  defaultFeeCents: 50,
  contextFees: {
    entry: 25,
    bar: 50,
    merch: 75,
    general: 50
  }
};

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Skip auth for now - this is a public config endpoint
    // await requireAuth(req, res);

    return res.status(200).json({
      fee_enabled: platformFeeEngine.feeEnabled,
      default_fee_cents: platformFeeEngine.defaultFeeCents,
      context_fees: platformFeeEngine.contextFees,
      fee_policy: 'Platform fee is charged on every successful interaction'
    });
  } catch (error) {
    console.error('Platform fee config error:', error);
    return res.status(500).json({ detail: 'Failed to fetch platform fee config' });
  }
};
