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

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletData[0];
    if (!wallet.device_bound) {
      return res.status(400).json({ detail: 'Device not bound' });
    }

    const challenge = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.status(200).json({
      status: 'SUCCESS',
      challenge,
      expires_in: 300
    });
  } catch (error) {
    console.error('Challenge generation error:', error);
    res.status(500).json({ detail: 'Challenge generation failed' });
  }
};
