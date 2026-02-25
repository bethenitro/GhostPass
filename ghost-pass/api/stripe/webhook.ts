/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for payment confirmation and updates wallet balance.
 * 
 * Key Events Handled:
 * - checkout.session.completed: Payment successful, credit wallet
 * - payment_intent.succeeded: Additional confirmation
 * - payment_intent.payment_failed: Handle failed payments
 * 
 * Security: Verifies webhook signature to ensure events are from Stripe
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
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

// Disable body parsing, need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    // Get raw body for signature verification
    const rawBody = await buffer(req);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).json({
      error: 'Webhook signature verification failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({
      error: 'Webhook handler failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  const { type, wallet_binding_id, device_fingerprint } = session.metadata || {};

  if (type === 'ticket_purchase') {
    return handleTicketPurchaseCompleted(session);
  }

  // Default Wallet Funding Flow
  if (!wallet_binding_id) {
    console.error('Missing wallet_binding_id in session metadata');
    return;
  }

  const amountTotal = session.amount_total; // Amount in cents

  if (!amountTotal) {
    console.error('Missing amount_total in session');
    return;
  }

  // Update wallet balance in database
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get current wallet
  const { data: wallet, error: fetchError } = await supabase
    .from('wallets')
    .select('*')
    .eq('wallet_binding_id', wallet_binding_id)
    .single();

  if (fetchError || !wallet) {
    console.error('Failed to fetch wallet:', fetchError);
    return;
  }

  // Update balance
  const newBalance = (wallet.balance_cents || 0) + amountTotal;

  const { error: updateError } = await supabase
    .from('wallets')
    .update({
      balance_cents: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_binding_id', wallet_binding_id);

  if (updateError) {
    console.error('Failed to update wallet balance:', updateError);
    return;
  }

  // Record transaction
  await supabase.from('transactions').insert({
    wallet_binding_id,
    type: 'credit',
    amount_cents: amountTotal,
    description: 'Wallet funding via Stripe',
    status: 'completed',
    payment_method: 'stripe',
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent as string,
    metadata: {
      device_fingerprint,
      session_metadata: session.metadata,
    },
    created_at: new Date().toISOString(),
  });

  console.log(`✅ Wallet ${wallet_binding_id} credited with $${(amountTotal / 100).toFixed(2)}`);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent succeeded:', paymentIntent.id);
  // Additional logging or processing if needed
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent failed:', paymentIntent.id);

  const { wallet_binding_id } = paymentIntent.metadata || {};

  if (!wallet_binding_id) {
    return;
  }

  // Record failed transaction
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase.from('transactions').insert({
    wallet_binding_id,
    type: 'credit',
    amount_cents: paymentIntent.amount,
    description: 'Failed wallet funding via Stripe',
    status: 'failed',
    payment_method: 'stripe',
    stripe_payment_intent_id: paymentIntent.id,
    metadata: {
      failure_reason: paymentIntent.last_payment_error?.message,
    },
    created_at: new Date().toISOString(),
  });

  console.log(`❌ Payment failed for wallet ${wallet_binding_id}`);
}

async function handleTicketPurchaseCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing ticket purchase checkout.session.completed:', session.id);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const metadata = session.metadata || {};
  const deviceFingerprint = metadata.device_fingerprint;
  let targetWalletBindingId = metadata.wallet_binding_id;

  if (!deviceFingerprint) {
    throw new Error('No device_fingerprint in session metadata');
  }

  // 1. Find or create the wallet based on the device_fingerprint
  let { data: wallet } = await supabase
    .from('wallets')
    .select('*')
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
      .select()
      .single();

    if (createError || !newWallet) {
      throw new Error(`Failed to create wallet for ${deviceFingerprint}: ${createError?.message}`);
    }
    wallet = newWallet;
  } else {
    targetWalletBindingId = wallet.wallet_binding_id;
  }

  // 2. Fetch event details to calculate validity window
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
  const validUntil = eventData?.end_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Fallback +24h

  // 3. Create the ticket record(s) - handle quantity > 1 if needed
  // For GhostPass standard, we'll insert N records if quantity > 1
  for (let i = 0; i < quantity; i++) {
    const ticketId = `ticket_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const ticketCode = crypto.randomBytes(16).toString('hex').toUpperCase();

    const { error: ticketError } = await supabase
      .from('event_tickets')
      .insert({
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

    if (ticketError) {
      console.error('Failed to create ticket:', ticketError);
    }
  }

  // 4. Record transaction in ledger
  await supabase.from('transactions').insert({
    wallet_binding_id: targetWalletBindingId,
    type: 'TICKET_PURCHASE',
    amount_cents: totalCentsPaid, // Assuming user pays Stripe and we just grant ticket. Cost logic: usually this shows as a debit, but since they paid via external card maybe it's 0 or we log an external payment?
    description: `Ticket Purchase via Stripe for Event ${eventId}`,
    status: 'completed',
    payment_method: 'stripe',
    stripe_session_id: session.id,
    metadata: {
      device_fingerprint: deviceFingerprint,
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      quantity,
      service_fee_cents: serviceFeeCents,
    },
    created_at: new Date().toISOString(),
  });

  // 5. Update ticket type sold count safely
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

  console.log(`✅ Ticket purchase complete. Wallet ${targetWalletBindingId} created/updated.`);
}
