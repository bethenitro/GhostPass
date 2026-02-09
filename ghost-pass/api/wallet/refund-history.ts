import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(200).json([]);
    }

    const wallet = walletData[0];
    const { data: refunds } = await supabase
      .from('refunds')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false });

    res.status(200).json(refunds || []);
  } catch (error) {
    console.error('Refund history error:', error);
    res.status(500).json({ detail: 'Failed to fetch refund history' });
  }
};
