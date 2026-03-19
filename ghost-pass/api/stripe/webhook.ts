/**
 * Stripe Webhook Handler
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event: Stripe.Event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded:', (event.data.object as Stripe.PaymentIntent).id);
        break;
      case 'payment_intent.payment_failed':
        console.log('Payment intent failed:', (event.data.object as Stripe.PaymentIntent).id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  const { type, wallet_binding_id, device_fingerprint } = session.metadata || {};

  if (type === 'ticket_purchase') {
    return handleTicketPurchaseCompleted(session);
  }

  // Wallet funding flow
  if (!wallet_binding_id) {
    console.error('Missing wallet_binding_id in session metadata');
    return;
  }

  const amountTotal = session.amount_total;
  if (!amountTotal) {
    console.error('Missing amount_total in session');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch wallet by wallet_binding_id — need wallet.id (UUID PK) for transactions FK
  const { data: wallet, error: fetchError } = await supabase
    .from('wallets')
    .select('id, balance_cents')
    .eq('wallet_binding_id', wallet_binding_id)
    .single();

  if (fetchError || !wallet) {
    console.error('Failed to fetch wallet:', fetchError);
    return;
  }

  // Idempotency — skip if already processed
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('provider_tx_id', session.id)
    .maybeSingle();

  if (existing) {
    console.log(`⚠️ Session ${session.id} already processed, skipping.`);
    return;
  }

  const newBalance = (wallet.balance_cents || 0) + amountTotal;

  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance_cents: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (updateError) {
    console.error('Failed to update wallet balance:', updateError);
    return;
  }

  await supabase.from('transactions').insert({
    wallet_id: wallet.id,
    wallet_binding_id: wallet_binding_id,
    type: 'FUND',
    amount_cents: amountTotal,
    balance_before_cents: wallet.balance_cents || 0,
    balance_after_cents: newBalance,
    vendor_name: 'Stripe Wallet Funding',
    provider_tx_id: session.id,
    device_fingerprint: device_fingerprint || null,
    metadata: { stripe_payment_intent: session.payment_intent, source: 'stripe_webhook' },
  });

  console.log(`✅ Wallet ${wallet_binding_id} credited with $${(amountTotal / 100).toFixed(2)}`);
}

async function handleTicketPurchaseCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing ticket purchase:', session.id);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const metadata = session.metadata || {};
  const deviceFingerprint = metadata.device_fingerprint;
  let targetWalletBindingId = metadata.wallet_binding_id;

  if (!deviceFingerprint) throw new Error('No device_fingerprint in session metadata');

  // Find or create wallet
  let { data: wallet } = await supabase
    .from('wallets')
    .select('id, wallet_binding_id, balance_cents')
    .eq('device_fingerprint', deviceFingerprint)
    .single();

  if (!wallet) {
    targetWalletBindingId = targetWalletBindingId || `wallet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { data: newWallet, error: createError } = await supabase
      .from('wallets')
      .insert({
        device_fingerprint: deviceFingerprint,
        wallet_binding_id: targetWalletBindingId,
        balance_cents: 0,
        device_bound: true,
        wallet_surfaced: false,
        entry_count: 0,
      })
      .select('id, wallet_binding_id, balance_cents')
      .single();

    if (createError || !newWallet) throw new Error(`Failed to create wallet: ${createError?.message}`);
    wallet = newWallet;
  } else {
    targetWalletBindingId = wallet.wallet_binding_id;
  }

  const eventId = metadata.event_id;
  const ticketTypeId = metadata.ticket_type_id;
  const quantity = parseInt(metadata.quantity || '1', 10);
  const totalCentsPaid = parseInt(metadata.total_cents || session.amount_total?.toString() || '0', 10);
  const serviceFeeCents = parseInt(metadata.service_fee_cents || '0', 10);
  const ticketPriceCents = totalCentsPaid - serviceFeeCents;

  const { data: eventData } = await supabase
    .from('events')
    .select('start_date, end_date')
    .eq('id', eventId)
    .single();

  const validFrom = eventData?.start_date || new Date().toISOString();
  const validUntil = eventData?.end_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  for (let i = 0; i < quantity; i++) {
    const ticketId = `ticket_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const ticketCode = crypto.randomBytes(16).toString('hex').toUpperCase();

    const { error: ticketError } = await supabase.from('event_tickets').insert({
      id: ticketId,
      ticket_code: ticketCode,
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      wallet_binding_id: targetWalletBindingId,
      device_fingerprint: deviceFingerprint,
      ticket_price_cents: Math.floor(ticketPriceCents / quantity),
      service_fee_cents: Math.floor(serviceFeeCents / quantity),
      total_paid_cents: Math.floor(totalCentsPaid / quantity),
      status: 'active',
      purchased_at: new Date().toISOString(),
      valid_from: validFrom,
      valid_until: validUntil,
      entry_granted: false,
      entry_count: 0,
    });

    if (ticketError) console.error('Failed to create ticket:', ticketError);
  }

  // Record transaction with correct schema
  await supabase.from('transactions').insert({
    wallet_id: wallet.id,
    wallet_binding_id: targetWalletBindingId,
    type: 'SPEND',
    amount_cents: totalCentsPaid,
    balance_before_cents: wallet.balance_cents || 0,
    balance_after_cents: wallet.balance_cents || 0,
    vendor_name: `Ticket Purchase - Event ${eventId}`,
    provider_tx_id: session.id,
    device_fingerprint: deviceFingerprint || null,
    metadata: { event_id: eventId, ticket_type_id: ticketTypeId, quantity, service_fee_cents: serviceFeeCents },
  });

  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('sold_count')
    .eq('id', ticketTypeId)
    .single();

  if (ticketType) {
    await supabase
      .from('ticket_types')
      .update({ sold_count: (ticketType.sold_count || 0) + quantity })
      .eq('id', ticketTypeId);
  }

  console.log(`✅ Ticket purchase complete. Wallet ${targetWalletBindingId}`);
}
