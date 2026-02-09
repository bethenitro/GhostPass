import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

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
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .eq('type', 'FUND')
      .order('created_at', { ascending: false });

    res.status(200).json(transactions || []);
  } catch (error) {
    console.error('Eligible transactions error:', error);
    res.status(500).json({ detail: 'Failed to fetch eligible transactions' });
  }
};
