import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'X-Device-Fingerprint header required' });
    }

    // Get wallet by device fingerprint
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (walletError || !wallet) {
      // No wallet found - return empty state instead of 404
      return res.status(200).json({
        status: 'INACTIVE',
        message: 'No active pass found'
      });
    }

    // Get active ghost passes for this wallet
    const { data: passes } = await supabase
      .from('ghost_passes')
      .select('*')
      .eq('wallet_binding_id', wallet.wallet_binding_id)
      .eq('status', 'ACTIVE')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (!passes || passes.length === 0) {
      // No active pass - return empty state instead of 404
      return res.status(200).json({
        status: 'INACTIVE',
        message: 'No active pass found'
      });
    }

    return res.status(200).json(passes[0]);
  } catch (error) {
    console.error('Pass status error:', error);
    return res.status(500).json({ detail: 'Failed to fetch pass status' });
  }
};
