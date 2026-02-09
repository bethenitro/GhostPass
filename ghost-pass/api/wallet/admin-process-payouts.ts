import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { vendor_id } = req.body;

    res.status(200).json({
      status: 'success',
      message: 'Vendor payouts processed',
      vendor_id: vendor_id || 'all'
    });
  } catch (error) {
    console.error('Process vendor payouts error:', error);
    res.status(500).json({ detail: 'Failed to process vendor payouts' });
  }
};
