import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { challenge, biometric_hash } = req.body;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletData[0];
    const verified = wallet.biometric_hash === biometric_hash;

    res.status(200).json({
      status: verified ? 'SUCCESS' : 'FAILED',
      verified,
      message: verified ? 'Biometric verified' : 'Biometric verification failed'
    });
  } catch (error) {
    console.error('Biometric verification error:', error);
    res.status(500).json({ detail: 'Biometric verification failed' });
  }
};
