/**
 * Verify Stripe Checkout Session and credit wallet.
 * Called by the frontend after returning from Stripe Checkout.
 * Idempotent — safe to call multiple times via provider_tx_id check.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return handleCors(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: 'unpaid', credited: false });
    }

    const { wallet_binding_id } = session.metadata || {};
    if (!wallet_binding_id) {
      return res.status(400).json({ error: 'Missing wallet_binding_id in session metadata' });
    }

    const amountCents = session.amount_total!;

    // Fetch wallet row (need wallet.id for FK)
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('id, balance_cents')
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (fetchError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Idempotency — don't double-credit if already processed
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('provider_tx_id', session_id)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({
        status: 'already_credited',
        credited: false,
        balance_cents: wallet.balance_cents,
        balance_dollars: wallet.balance_cents / 100,
      });
    }

    const newBalance = (wallet.balance_cents || 0) + amountCents;

    // Update balance
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_cents: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Record transaction using correct schema
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'FUND',
      amount_cents: amountCents,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      vendor_name: 'Stripe Wallet Funding',
      provider_tx_id: session_id,
      device_fingerprint: session.metadata?.device_fingerprint || null,
      metadata: { stripe_payment_intent: session.payment_intent, source: 'stripe_checkout' },
    });

    return res.status(200).json({
      status: 'credited',
      credited: true,
      amount_cents: amountCents,
      balance_cents: newBalance,
      balance_dollars: newBalance / 100,
    });
  } catch (error) {
    console.error('verify-session error:', error);
    return res.status(500).json({ error: 'Failed to verify session' });
  }
}
