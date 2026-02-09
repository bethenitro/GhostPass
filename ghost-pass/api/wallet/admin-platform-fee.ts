import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';

const contextFees = {
  entry: 25,
  bar: 50,
  merch: 75,
  general: 50
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const feeCents = parseInt(req.query.fee_cents as string);
    const context = (req.query.context as string) || 'general';

    contextFees[context as keyof typeof contextFees] = feeCents;

    res.status(200).json({
      status: 'success',
      context,
      fee_cents: feeCents,
      message: `Platform fee for ${context} updated to $${(feeCents / 100).toFixed(2)}`
    });
  } catch (error) {
    console.error('Set platform fee error:', error);
    res.status(500).json({ detail: 'Failed to set platform fee' });
  }
};
