/**
 * Device Fingerprint Authentication Helper
 * 
 * Replaces user-based authentication with device fingerprint authentication
 * for anonymous wallet access
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

export interface WalletAuth {
  wallet_id: string;
  wallet_binding_id: string;
  device_fingerprint: string;
  balance_cents: number;
}

/**
 * Get wallet from device fingerprint
 * Creates wallet if it doesn't exist
 */
export const getWalletFromDevice = async (
  req: VercelRequest,
  res: VercelResponse
): Promise<WalletAuth | null> => {
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

  if (!deviceFingerprint) {
    res.status(400).json({ error: 'Device fingerprint required' });
    return null;
  }

  try {
    // Find wallet by device fingerprint
    let { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    // Create wallet if doesn't exist
    if (walletError || !wallet) {
      const walletBindingId = `wallet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          device_fingerprint: deviceFingerprint,
          wallet_binding_id: walletBindingId,
          balance_cents: 0,
          device_bound: true,
          wallet_surfaced: false,
          entry_count: 0,
        })
        .select()
        .single();

      if (createError || !newWallet) {
        res.status(500).json({ error: 'Failed to create wallet' });
        return null;
      }

      wallet = newWallet;
    }

    return {
      wallet_id: wallet.id,
      wallet_binding_id: wallet.wallet_binding_id,
      device_fingerprint: wallet.device_fingerprint,
      balance_cents: wallet.balance_cents || 0,
    };
  } catch (error) {
    console.error('Device auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return null;
  }
};

/**
 * Require device authentication
 * Returns wallet or sends error response
 */
export const requireDeviceAuth = async (
  req: VercelRequest,
  res: VercelResponse
): Promise<WalletAuth | null> => {
  return await getWalletFromDevice(req, res);
};
