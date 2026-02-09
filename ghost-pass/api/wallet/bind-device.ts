import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { supabase } from '../_lib/supabase';
import crypto from 'crypto';

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { device_fingerprint, biometric_hash } = req.body;

    if (!device_fingerprint) {
      return res.status(400).json({ error: 'device_fingerprint required' });
    }

    // Check if wallet already exists for this device
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', device_fingerprint)
      .single();

    let wallet;

    if (existingWallet) {
      // Update existing wallet
      const { data: updated, error: updateError } = await supabase
        .from('wallets')
        .update({
          device_bound: true,
          biometric_hash: biometric_hash || existingWallet.biometric_hash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWallet.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update wallet' });
      }

      wallet = updated;
    } else {
      // Create new wallet
      const walletBindingId = `wallet_${crypto.randomBytes(16).toString('hex')}`;

      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          balance_cents: 0,
          device_bound: true,
          device_fingerprint,
          biometric_hash: biometric_hash || null,
          wallet_binding_id: walletBindingId,
          updated_at: new Date().toISOString(),
          wallet_surfaced: false,
          entry_count: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('Create error:', createError);
        return res.status(500).json({ error: 'Failed to create wallet' });
      }

      wallet = newWallet;
    }

    return res.status(200).json({
      status: 'SUCCESS',
      wallet_id: wallet.id,
      wallet_binding_id: wallet.wallet_binding_id,
      device_bound: true,
      message: 'Device bound successfully'
    });
  } catch (error) {
    console.error('Device binding error:', error);
    return res.status(500).json({ detail: 'Device binding failed' });
  }
};
