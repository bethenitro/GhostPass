/**
 * Process Scan/Interaction API
 * 
 * Handles both Mode A (pay-per-scan) and Mode B (event pass) interactions.
 * Based on backend/routes/ghost_pass_modes.py implementation
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors';
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
    const {
      context,
      wallet_binding_id,
      interaction_method, // 'QR' or 'NFC'
      gateway_id,
      ghost_pass_token,
    } = req.body;

    if (!context || !wallet_binding_id || !interaction_method || !gateway_id) {
      return res.status(400).json({
        error: 'Missing required fields: context, wallet_binding_id, interaction_method, gateway_id',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const interactionId = `int_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Check context mode first
    const checkResponse = await fetch(`${req.headers.host}/api/modes/check-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, wallet_binding_id, ghost_pass_token }),
    });

    const accessCheck = await checkResponse.json() as {
      access_granted: boolean;
      mode: string;
      message?: string;
      requires_pass_purchase?: boolean;
      pass_options?: any[];
      requires_payment?: boolean;
      payment_amount_cents?: number;
    };

    if (!accessCheck.access_granted) {
      // Access denied
      return res.status(200).json({
        success: false,
        interaction_id: interactionId,
        mode: accessCheck.mode,
        message: accessCheck.message || 'Access denied',
        requires_pass_purchase: accessCheck.requires_pass_purchase,
        pass_options: accessCheck.pass_options || [],
      });
    }

    // Access granted - process the interaction
    let amountCharged = 0;
    let newBalance = 0;

    if (accessCheck.requires_payment) {
      // Mode A: Pay-per-scan - charge the fee
      amountCharged = accessCheck.payment_amount_cents || 0;

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
      if (wallet.balance_cents < amountCharged) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
          required_cents: amountCharged,
          current_balance_cents: wallet.balance_cents,
        });
      }

      // Deduct from wallet
      newBalance = wallet.balance_cents - amountCharged;

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

      // Record transaction
      await supabase.from('transactions').insert({
        id: `txn_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        wallet_binding_id,
        type: 'PAY_PER_SCAN',
        amount_cents: -amountCharged,
        description: `Per-scan fee for ${context}`,
        status: 'completed',
        payment_method: 'wallet',
        metadata: {
          context,
          interaction_id: interactionId,
          interaction_method,
          gateway_id,
        },
        created_at: new Date().toISOString(),
      });
    } else {
      // Mode B: Event pass - no charge, just validate
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_cents')
        .eq('wallet_binding_id', wallet_binding_id)
        .single();

      newBalance = wallet?.balance_cents || 0;
    }

    // Log the interaction
    await supabase.from('interactions').insert({
      id: interactionId,
      wallet_binding_id,
      context,
      interaction_method,
      gateway_id,
      ghost_pass_token: ghost_pass_token || null,
      mode: accessCheck.mode,
      amount_charged_cents: amountCharged,
      status: 'success',
      created_at: new Date().toISOString(),
      metadata: {
        access_check: accessCheck,
      },
    });

    return res.status(200).json({
      success: true,
      interaction_id: interactionId,
      mode: accessCheck.mode,
      amount_charged_cents: amountCharged,
      balance_after_cents: newBalance,
      message:
        `Access granted to ${context}` +
        (amountCharged > 0 ? ` (charged $${(amountCharged / 100).toFixed(2)})` : ' (pass validated)'),
    });
  } catch (error) {
    console.error('Interaction processing error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
