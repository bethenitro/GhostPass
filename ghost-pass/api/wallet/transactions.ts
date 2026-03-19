import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { adminSupabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
    
    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const { data: walletData, error: walletError } = await adminSupabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint);

    if (walletError) {
      console.error('Wallet lookup error:', walletError);
    }

    if (!walletData || walletData.length === 0) {
      return res.status(200).json([]);
    }

    const wallet = walletData[0];

    const { data: transactions, error: txError } = await adminSupabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('timestamp', { ascending: false });

    if (txError) console.error('Transactions query error:', txError);

    return res.status(200).json(transactions || []);
  } catch (error) {
    console.error('Transactions fetch error:', error);
    return res.status(500).json({ detail: 'Failed to fetch transactions' });
  }
};
