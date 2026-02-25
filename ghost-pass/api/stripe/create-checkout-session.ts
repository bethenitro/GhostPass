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
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY environment variable is not set');
      return res.status(500).json({
        error: 'Stripe is not configured. Please contact support.',
        details: 'Missing STRIPE_SECRET_KEY environment variable'
      });
    }

    const {
      type = 'wallet_funding',
      amount, // Amount in cents (for wallet funding)
      event_id, // For ticket_purchase
      ticket_type_id,
      quantity = 1,
      asset_id,
      wallet_binding_id,
      device_fingerprint,
      success_url,
      cancel_url,
    } = req.body;

    // Log request for debugging
    console.log(`Stripe checkout request (${type}):`, {
      wallet_binding_id: wallet_binding_id ? 'present' : 'missing',
      success_url: success_url ? 'present' : 'missing',
      cancel_url: cancel_url ? 'present' : 'missing',
    });

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

    if (type === 'ticket_purchase') {
      if (!event_id || !ticket_type_id || !quantity) {
        return res.status(400).json({ error: 'Missing required fields for ticket purchase' });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (eventError || !event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const { data: ticketType, error: ticketTypeError } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('id', ticket_type_id)
        .eq('event_id', event_id)
        .single();

      if (ticketTypeError || !ticketType) {
        return res.status(404).json({ error: 'Ticket type not found' });
      }

      if (ticketType.sold_count + quantity > ticketType.max_quantity) {
        return res.status(400).json({ error: 'Not enough tickets available' });
      }

      const ticketPriceCents = ticketType.price_cents;
      const serviceFeePercent = event.service_fee_percent || 5;
      const serviceFeeCents = Math.round(ticketPriceCents * (serviceFeePercent / 100));
      const totalUnitCostCents = ticketPriceCents + serviceFeeCents;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${ticketType.name} - ${event.name}`,
                description: `Includes $${(serviceFeeCents / 100).toFixed(2)} platform fee.`,
              },
              unit_amount: totalUnitCostCents,
            },
            quantity: quantity,
          },
        ],
        success_url: success_url || `${req.headers.origin}/#/wallet?payment=success`,
        cancel_url: cancel_url || `${req.headers.origin}/#/wallet?payment=cancelled`,
        metadata: {
          type: 'ticket_purchase',
          event_id,
          ticket_type_id,
          quantity: quantity.toString(),
          wallet_binding_id: wallet_binding_id || '',
          device_fingerprint: device_fingerprint || '',
          asset_id: asset_id || '',
          total_cents: (totalUnitCostCents * quantity).toString(),
          service_fee_cents: serviceFeeCents.toString(),
        },
        payment_intent_data: {
          metadata: {
            type: 'ticket_purchase',
            event_id,
            ticket_type_id,
            wallet_binding_id: wallet_binding_id || '',
            device_fingerprint: device_fingerprint || '',
          },
          description: `Ticket Purchase for ${event.name}`,
        },
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      });

      return res.status(200).json({
        success: true,
        session_id: session.id,
        url: session.url,
        expires_at: session.expires_at,
      });
    }

    // Default Wallet Funding Flow
    // Validation
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Amount must be at least $0.50' });
    }

    if (!wallet_binding_id) {
      return res.status(400).json({ error: 'wallet_binding_id is required' });
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
