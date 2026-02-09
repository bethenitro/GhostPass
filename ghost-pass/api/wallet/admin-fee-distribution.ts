import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

const distributionConfig = {
  validPlatformPercentage: 40,
  vendorPercentage: 35,
  poolPercentage: 15,
  promoterPercentage: 10
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;

      res.status(200).json({
        distribution: distributionConfig
      });
    } catch (error) {
      console.error('Get fee distribution error:', error);
      res.status(500).json({ detail: 'Failed to fetch fee distribution' });
    }
  } else if (req.method === 'POST') {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;

      const validPct = parseInt(req.query.valid_percentage as string);
      const vendorPct = parseInt(req.query.vendor_percentage as string);
      const poolPct = parseInt(req.query.pool_percentage as string);
      const promoterPct = parseInt(req.query.promoter_percentage as string);

      if (validPct + vendorPct + poolPct + promoterPct !== 100) {
        return res.status(400).json({ detail: 'Distribution percentages must add up to 100' });
      }

      Object.assign(distributionConfig, {
        validPlatformPercentage: validPct,
        vendorPercentage: vendorPct,
        poolPercentage: poolPct,
        promoterPercentage: promoterPct
      });

      res.status(200).json({
        status: 'success',
        distribution: distributionConfig,
        message: 'Fee distribution updated successfully'
      });
    } catch (error) {
      console.error('Set fee distribution error:', error);
      res.status(500).json({ detail: 'Failed to set fee distribution' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
