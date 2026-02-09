import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { device_fingerprint, biometric_hash } = req.query;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletData[0];
    const verified = wallet.device_fingerprint === device_fingerprint &&
                     wallet.biometric_hash === biometric_hash;

    res.status(200).json({
      verified,
      device_bound: wallet.device_bound,
      message: verified ? 'Device verified' : 'Device verification failed'
    });
  } catch (error) {
    console.error('Device verification error:', error);
    res.status(500).json({ detail: 'Device verification failed' });
  }
};
