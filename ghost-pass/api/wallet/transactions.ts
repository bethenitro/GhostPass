import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get device fingerprint from header (no auth required)
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
    
    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint);

    if (!walletData || walletData.length === 0) {
      return res.status(200).json([]);
    }

    const wallet = walletData[0];
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('timestamp', { ascending: false });

    res.status(200).json(transactions || []);
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch transactions' });
  }
};
