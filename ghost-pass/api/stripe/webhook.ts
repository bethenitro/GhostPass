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

  const { wallet_binding_id, device_fingerprint } = session.metadata || {};

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
