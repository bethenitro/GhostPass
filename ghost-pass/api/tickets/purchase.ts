/**
 * Single-Event Ticket Purchase API
 * 
 * Implements one-time ticket purchase for events that don't use pass duration logic.
 * This is simpler than Ghost Pass - just a ticket that grants entry permission.
 * 
 * Flow:
 * 1. User selects event and ticket type
 * 2. Ticket price debits from wallet
 * 3. Ticket record created with entry permission
 * 4. VALID service fee applied (adjustable per event)
 * 5. Receipt generated
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';
import crypto from 'crypto';

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
    const {
      event_id,
      ticket_type_id,
      wallet_binding_id,
      device_fingerprint,
    } = req.body;

    // Validation
    if (!event_id || !ticket_type_id || !wallet_binding_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: event_id, ticket_type_id, wallet_binding_id' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get event and ticket type information
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get ticket type pricing
    const { data: ticketType, error: ticketTypeError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('id', ticket_type_id)
      .eq('event_id', event_id)
      .single();

    if (ticketTypeError || !ticketType) {
      return res.status(404).json({ error: 'Ticket type not found' });
    }

    // Check if ticket type is still available
    if (ticketType.sold_count >= ticketType.max_quantity) {
      return res.status(400).json({ error: 'Ticket type sold out' });
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Calculate total cost (ticket price + VALID service fee)
    const ticketPriceCents = ticketType.price_cents;
    const serviceFeePercent = event.service_fee_percent || 5; // Default 5%
    const serviceFeeCents = Math.round(ticketPriceCents * (serviceFeePercent / 100));
    const totalCostCents = ticketPriceCents + serviceFeeCents;

    // Check if wallet has sufficient balance
    if (wallet.balance_cents < totalCostCents) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        required_cents: totalCostCents,
        current_balance_cents: wallet.balance_cents,
        shortfall_cents: totalCostCents - wallet.balance_cents
      });
    }

    // Generate ticket ID
    const ticketId = `ticket_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const ticketCode = crypto.randomBytes(16).toString('hex').toUpperCase();

    // Start transaction
    const newBalance = wallet.balance_cents - totalCostCents;

    // Update wallet balance
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

    // Create ticket record
    const { data: ticket, error: ticketError } = await supabase
      .from('event_tickets')
      .insert({
        id: ticketId,
        ticket_code: ticketCode,
        event_id,
        ticket_type_id,
        wallet_binding_id,
        device_fingerprint,
        ticket_price_cents: ticketPriceCents,
        service_fee_cents: serviceFeeCents,
        total_paid_cents: totalCostCents,
        status: 'active',
        purchased_at: new Date().toISOString(),
        valid_from: event.start_date,
        valid_until: event.end_date,
        entry_granted: false,
        entry_count: 0,
        metadata: {
          event_name: event.name,
          ticket_type_name: ticketType.name,
          venue_id: event.venue_id,
        },
      })
      .select()
      .single();

    if (ticketError) {
      // Rollback wallet balance
      await supabase
        .from('wallets')
        .update({ balance_cents: wallet.balance_cents })
        .eq('wallet_binding_id', wallet_binding_id);
      
      return res.status(500).json({ error: 'Failed to create ticket' });
    }

    // Record transaction
    const transactionId = `txn_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    await supabase.from('transactions').insert({
      id: transactionId,
      wallet_binding_id,
      type: 'TICKET_PURCHASE',
      amount_cents: -totalCostCents,
      description: `Ticket: ${ticketType.name} for ${event.name}`,
      status: 'completed',
      payment_method: 'wallet',
      metadata: {
        event_id,
        ticket_id: ticketId,
        ticket_type_id,
        ticket_price_cents: ticketPriceCents,
        service_fee_cents: serviceFeeCents,
        device_fingerprint,
      },
      created_at: new Date().toISOString(),
    });

    // Update ticket type sold count
    await supabase
      .from('ticket_types')
      .update({
        sold_count: ticketType.sold_count + 1,
      })
      .eq('id', ticket_type_id);

    // Generate receipt
    const receipt = {
      receipt_id: `receipt_${Date.now()}`,
      ticket_id: ticketId,
      ticket_code: ticketCode,
      event: {
        id: event.id,
        name: event.name,
        venue_name: event.venue_name,
        start_date: event.start_date,
        end_date: event.end_date,
      },
      ticket_type: {
        id: ticketType.id,
        name: ticketType.name,
        description: ticketType.description,
      },
      pricing: {
        ticket_price_cents: ticketPriceCents,
        service_fee_cents: serviceFeeCents,
        service_fee_percent: serviceFeePercent,
        total_paid_cents: totalCostCents,
      },
      wallet: {
        previous_balance_cents: wallet.balance_cents,
        new_balance_cents: newBalance,
      },
      purchased_at: ticket.purchased_at,
      valid_from: ticket.valid_from,
      valid_until: ticket.valid_until,
    };

    return res.status(200).json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        event_id: ticket.event_id,
        ticket_type_id: ticket.ticket_type_id,
        status: ticket.status,
        purchased_at: ticket.purchased_at,
        valid_from: ticket.valid_from,
        valid_until: ticket.valid_until,
      },
      receipt,
      transaction_id: transactionId,
      message: 'Ticket purchased successfully',
    });

  } catch (error) {
    console.error('Ticket purchase error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
