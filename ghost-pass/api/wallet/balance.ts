import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { supabase } from '../_lib/supabase';
import crypto from 'crypto';

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get device fingerprint from header (no auth required)
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
    
    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    // Find or create wallet based on device fingerprint
    let { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint);

    let wallet;
    if (!walletData || walletData.length === 0) {
      // Create new anonymous wallet
      const walletBindingId = `wallet_${crypto.randomBytes(16).toString('hex')}`;
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({ 
          device_fingerprint: deviceFingerprint,
          wallet_binding_id: walletBindingId,
          balance_cents: 0,
          device_bound: true,
          wallet_surfaced: false,
          entry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Wallet creation error:', createError);
        return res.status(500).json({ error: 'Failed to create wallet' });
      }

      wallet = newWallet;
    } else {
      wallet = walletData[0];
    }

    return res.status(200).json({
      balance_cents: wallet.balance_cents || 0,
      balance_dollars: (wallet.balance_cents || 0) / 100.0,
      wallet_binding_id: wallet.wallet_binding_id,
      updated_at: wallet.updated_at
    });
  } catch (error) {
    console.error('Balance fetch error:', error);
    return res.status(500).json({ detail: 'Failed to fetch balance' });
  }
};
