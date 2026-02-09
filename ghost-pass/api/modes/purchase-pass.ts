/**
 * Purchase Ghost Pass API (Mode B)
 * 
 * Purchases a Ghost Pass for event mode contexts.
 * Based on backend/routes/ghost_pass_modes.py implementation
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { context, pass_id, wallet_binding_id, device_fingerprint } = req.body;

    if (!context || !pass_id || !wallet_binding_id) {
      return res.status(400).json({
        error: 'Missing required fields: context, pass_id, wallet_binding_id',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get context configuration (simplified - in production this would be from database)
    const passOptions: Record<string, any> = {
      '1day': { name: '1-Day Pass', price_cents: 2500, duration_hours: 24, includes: ['entry', 'vendors'] },
      '3day': { name: '3-Day Pass', price_cents: 6000, duration_hours: 72, includes: ['entry', 'vendors', 'vip_areas'] },
      'weekend': { name: 'Weekend Pass', price_cents: 4500, duration_hours: 48, includes: ['entry', 'vendors'] },
      'single_day': { name: 'Single Day', price_cents: 7500, duration_hours: 16, includes: ['entry', 'vendors', 'stages'] },
      'full_festival': { name: 'Full Festival Pass', price_cents: 20000, duration_hours: 96, includes: ['entry', 'vendors', 'stages', 'vip_areas', 'camping'] },
    };

    const passOption = passOptions[pass_id];

    if (!passOption) {
      return res.status(400).json({
        error: `Pass option '${pass_id}' not found`,
      });
    }

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Check balance
    if (wallet.balance_cents < passOption.price_cents) {
      return res.status(400).json({
        error: 'Insufficient balance',
        required_cents: passOption.price_cents,
        current_balance_cents: wallet.balance_cents,
        shortfall_cents: passOption.price_cents - wallet.balance_cents,
      });
    }

    // Generate Ghost Pass token
    const ghostPassToken = `gp_${context}_${crypto.randomBytes(16).toString('hex')}`;
    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt.getTime() + passOption.duration_hours * 60 * 60 * 1000);

    // Deduct from wallet
    const newBalance = wallet.balance_cents - passOption.price_cents;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance_cents: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_binding_id', wallet_binding_id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update wallet balance' });
    }

    // Create Ghost Pass
    const { data: ghostPass, error: passError } = await supabase
      .from('ghost_passes')
      .insert({
        id: ghostPassToken,
        wallet_binding_id,
        device_fingerprint,
        context,
        pass_type: pass_id,
        pass_name: passOption.name,
        price_cents: passOption.price_cents,
        duration_hours: passOption.duration_hours,
        status: 'ACTIVE',
        purchased_at: purchasedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        metadata: {
          includes: passOption.includes,
        },
      })
      .select()
      .single();

    if (passError) {
      // Rollback wallet balance
      await supabase
        .from('wallets')
        .update({ balance_cents: wallet.balance_cents })
        .eq('wallet_binding_id', wallet_binding_id);

      return res.status(500).json({ error: 'Failed to create Ghost Pass' });
    }

    // Record transaction
    const transactionId = `txn_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    await supabase.from('transactions').insert({
      id: transactionId,
      wallet_binding_id,
      type: 'GHOST_PASS_PURCHASE',
      amount_cents: -passOption.price_cents,
      description: `Ghost Pass: ${passOption.name} for ${context}`,
      status: 'completed',
      payment_method: 'wallet',
      metadata: {
        context,
        ghost_pass_token: ghostPassToken,
        pass_id,
        pass_name: passOption.name,
        duration_hours: passOption.duration_hours,
        expires_at: expiresAt.toISOString(),
        device_fingerprint,
      },
      created_at: new Date().toISOString(),
    });

    const passInfo = {
      token: ghostPassToken,
      pass_id,
      pass_name: passOption.name,
      context,
      price_paid_cents: passOption.price_cents,
      duration_hours: passOption.duration_hours,
      includes: passOption.includes,
      purchased_at: purchasedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      wallet_binding_id,
    };

    return res.status(200).json({
      success: true,
      ghost_pass_token: ghostPassToken,
      pass_info: passInfo,
      transaction_id: transactionId,
      message: 'Ghost Pass purchased successfully',
    });
  } catch (error) {
    console.error('Pass purchase error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
