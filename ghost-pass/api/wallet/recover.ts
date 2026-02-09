/**
 * Wallet Recovery Endpoint
 * 
 * Allows users to recover their wallet on a new device using:
 * - Wallet ID (wallet_binding_id)
 * - Recovery Code
 * 
 * This binds the wallet to the new device fingerprint
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet_binding_id, recovery_code } = req.body;
    const newDeviceFingerprint = req.headers['x-device-fingerprint'] as string;

    if (!wallet_binding_id || !recovery_code) {
      return res.status(400).json({ error: 'Wallet ID and recovery code are required' });
    }

    if (!newDeviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find wallet by wallet_binding_id
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Verify recovery code
    // Recovery code is stored as a hash in the wallet
    const recoveryCodeHash = crypto
      .createHash('sha256')
      .update(recovery_code)
      .digest('hex');

    if (wallet.recovery_code_hash !== recoveryCodeHash) {
      return res.status(401).json({ error: 'Invalid recovery code' });
    }

    // Update wallet with new device fingerprint
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        device_fingerprint: newDeviceFingerprint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateError) {
      console.error('Failed to update wallet:', updateError);
      return res.status(500).json({ error: 'Failed to recover wallet' });
    }

    // Create new wallet session for the recovered wallet
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year session

    const { error: sessionError } = await supabase
      .from('wallet_sessions')
      .insert({
        id: sessionId,
        wallet_binding_id: wallet_binding_id,
        device_fingerprint: newDeviceFingerprint,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        force_surface: false,
        session_data: {
          recovered: true,
          recovered_at: new Date().toISOString(),
          previous_device: wallet.device_fingerprint,
        },
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      // Continue anyway - wallet was recovered
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet recovered successfully',
      wallet: {
        id: wallet.id,
        wallet_binding_id: wallet.wallet_binding_id,
        balance_cents: wallet.balance_cents,
      },
      session: {
        session_id: sessionId,
        expires_at: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Wallet recovery error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
