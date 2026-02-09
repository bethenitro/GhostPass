/**
 * Create Stripe Checkout Session
 * 
 * Creates a Checkout Session for wallet funding using Stripe's recommended
 * Checkout Sessions API with Payment Element integration.
 * 
 * Best Practices Implemented:
 * - Uses Checkout Sessions API (recommended over Payment Intents)
 * - Supports dynamic payment methods
 * - Includes proper metadata for tracking
 * - Webhook-ready for payment confirmation
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { handleCors } from '../_lib/cors';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      amount, // Amount in cents
      wallet_binding_id,
      device_fingerprint,
      success_url,
      cancel_url,
    } = req.body;

    // Validation
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Amount must be at least $0.50' });
    }

    if (!wallet_binding_id) {
      return res.status(400).json({ error: 'wallet_binding_id is required' });
    }

    if (!success_url || !cancel_url) {
      return res.status(400).json({ error: 'success_url and cancel_url are required' });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'], // Can add more: ['card', 'us_bank_account', 'link']
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Ghost Pass Wallet Funding',
              description: 'Add funds to your Ghost Pass wallet',
              images: [], // Add your logo URL here
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      // Metadata for tracking and webhook processing
      metadata: {
        wallet_binding_id,
        device_fingerprint: device_fingerprint || '',
        type: 'wallet_funding',
      },
      // Customer email collection
      customer_email: undefined, // Optional: can collect email
      // Automatic tax calculation (if enabled)
      automatic_tax: {
        enabled: false, // Set to true if you have Stripe Tax enabled
      },
      // Payment intent data for additional control
      payment_intent_data: {
        metadata: {
          wallet_binding_id,
          device_fingerprint: device_fingerprint || '',
          type: 'wallet_funding',
        },
        description: `Wallet funding for ${wallet_binding_id}`,
      },
      // Expires after 24 hours
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
    });

    return res.status(200).json({
      success: true,
      session_id: session.id,
      url: session.url,
      expires_at: session.expires_at,
    });

  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({
        error: error.message,
        type: error.type,
      });
    }

    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
