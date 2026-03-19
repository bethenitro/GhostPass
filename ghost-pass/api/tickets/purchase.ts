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
import { adminSupabase as supabase } from '../_lib/supabase.js';
import { handleCors } from '../_lib/cors.js';
import crypto from 'crypto';

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
      quantity = 1,
    } = req.body;

    // Validation
    if (!event_id || !ticket_type_id || !wallet_binding_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: event_id, ticket_type_id, wallet_binding_id' 
      });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

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

    // Check if ticket type is still available (only when a limit is set)
    if (ticketType.max_quantity != null && ticketType.max_quantity > 0 && ticketType.sold_count + qty > ticketType.max_quantity) {
      return res.status(400).json({ error: 'Not enough tickets available' });
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
    const serviceFeeCents = Math.round(ticketPriceCents * qty * (serviceFeePercent / 100));
    const totalCostCents = (ticketPriceCents * qty) + serviceFeeCents;

    // Check if wallet has sufficient balance
    if (wallet.balance_cents < totalCostCents) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        required_cents: totalCostCents,
        current_balance_cents: wallet.balance_cents,
        shortfall_cents: totalCostCents - wallet.balance_cents
      });
    }

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

    // Create ticket records (one per quantity)
    const now = new Date().toISOString();
    const ticketRows = Array.from({ length: qty }, (_, i) => {
      const ticketId = `ticket_${Date.now()}_${i}_${crypto.randomBytes(6).toString('hex')}`;
      const ticketCode = crypto.randomBytes(16).toString('hex').toUpperCase();
      return {
        id: ticketId,
        ticket_code: ticketCode,
        event_id,
        ticket_type_id,
        wallet_binding_id,
        device_fingerprint,
        ticket_price_cents: ticketPriceCents,
        service_fee_cents: Math.round(serviceFeeCents / qty),
        total_paid_cents: ticketPriceCents + Math.round(serviceFeeCents / qty),
        status: 'active',
        purchased_at: now,
        valid_from: event.start_date,
        valid_until: event.end_date,
        entry_granted: false,
        entry_count: 0,
        metadata: {
          event_name: event.name,
          ticket_type_name: ticketType.name,
          venue_id: event.venue_id,
        },
      };
    });

    const { data: tickets, error: ticketError } = await supabase
      .from('event_tickets')
      .insert(ticketRows)
      .select();

    if (ticketError || !tickets) {
      // Rollback wallet balance
      await supabase
        .from('wallets')
        .update({ balance_cents: wallet.balance_cents })
        .eq('wallet_binding_id', wallet_binding_id);
      
      return res.status(500).json({ error: 'Failed to create tickets' });
    }

    // Record a single transaction for the whole purchase
    const { error: txnError } = await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'SPEND',
      amount_cents: -totalCostCents,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      vendor_name: `${qty}x ${ticketType.name} — ${event.name}`,
      timestamp: new Date().toISOString(),
      metadata: {
        event_id,
        ticket_ids: tickets.map((t: any) => t.id),
        ticket_type_id,
        quantity: qty,
        ticket_price_cents: ticketPriceCents,
        service_fee_cents: serviceFeeCents,
        type: 'TICKET_PURCHASE',
      },
    });

    if (txnError) {
      console.error('Failed to record transaction:', txnError);
    }

    // Update ticket type sold count
    await supabase
      .from('ticket_types')
      .update({
        sold_count: (ticketType.sold_count || 0) + qty,
      })
      .eq('id', ticket_type_id);

    const firstTicket = tickets[0];

    // Generate receipt
    const receipt = {
      receipt_id: `receipt_${Date.now()}`,
      ticket_ids: tickets.map((t: any) => t.id),
      ticket_code: firstTicket.ticket_code,
      quantity: qty,
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
      purchased_at: firstTicket.purchased_at,
      valid_from: firstTicket.valid_from,
      valid_until: firstTicket.valid_until,
    };

    return res.status(200).json({
      success: true,
      ticket: {
        id: firstTicket.id,
        ticket_code: firstTicket.ticket_code,
        event_id: firstTicket.event_id,
        ticket_type_id: firstTicket.ticket_type_id,
        status: firstTicket.status,
        purchased_at: firstTicket.purchased_at,
        valid_from: firstTicket.valid_from,
        valid_until: firstTicket.valid_until,
      },
      tickets: tickets.map((t: any) => ({
        id: t.id,
        ticket_code: t.ticket_code,
        status: t.status,
      })),
      receipt,
      message: qty > 1 ? `${qty} tickets purchased successfully` : 'Ticket purchased successfully',
    });

  } catch (error) {
    console.error('Ticket purchase error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
