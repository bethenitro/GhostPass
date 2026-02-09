/**
 * Ticket Validation API
 * 
 * Validates a ticket for entry and grants permission.
 * Used by scanners/gateways to check if a ticket is valid for entry.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors';

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
      ticket_code,
      gateway_id,
      venue_id,
    } = req.body;

    // Validation
    if (!ticket_code) {
      return res.status(400).json({ error: 'ticket_code is required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('event_tickets')
      .select(`
        *,
        events (
          id,
          name,
          venue_id,
          start_date,
          end_date,
          status
        ),
        ticket_types (
          id,
          name,
          allows_reentry
        )
      `)
      .eq('ticket_code', ticket_code)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ 
        error: 'Ticket not found',
        allowed: false 
      });
    }

    // Check ticket status
    if (ticket.status !== 'active') {
      return res.status(400).json({ 
        error: `Ticket is ${ticket.status}`,
        allowed: false,
        ticket_status: ticket.status
      });
    }

    // Check if ticket is valid for this venue
    if (venue_id && ticket.events.venue_id !== venue_id) {
      return res.status(400).json({ 
        error: 'Ticket not valid for this venue',
        allowed: false 
      });
    }

    // Check if event is active
    if (ticket.events.status !== 'active') {
      return res.status(400).json({ 
        error: `Event is ${ticket.events.status}`,
        allowed: false,
        event_status: ticket.events.status
      });
    }

    // Check if ticket is within valid date range
    const now = new Date();
    const validFrom = new Date(ticket.valid_from);
    const validUntil = new Date(ticket.valid_until);

    if (now < validFrom) {
      return res.status(400).json({ 
        error: 'Ticket not yet valid',
        allowed: false,
        valid_from: ticket.valid_from
      });
    }

    if (now > validUntil) {
      return res.status(400).json({ 
        error: 'Ticket has expired',
        allowed: false,
        valid_until: ticket.valid_until
      });
    }

    // Check if already used (for non-reentry tickets)
    if (ticket.entry_granted && !ticket.ticket_types.allows_reentry) {
      return res.status(400).json({ 
        error: 'Ticket already used (no re-entry allowed)',
        allowed: false,
        entry_count: ticket.entry_count
      });
    }

    // Grant entry
    const newEntryCount = ticket.entry_count + 1;
    
    const { error: updateError } = await supabase
      .from('event_tickets')
      .update({
        entry_granted: true,
        entry_count: newEntryCount,
        last_entry_at: new Date().toISOString(),
        last_entry_gateway_id: gateway_id,
      })
      .eq('id', ticket.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update ticket' });
    }

    // Log entry
    await supabase.from('ticket_entries').insert({
      ticket_id: ticket.id,
      gateway_id,
      venue_id,
      entry_number: newEntryCount,
      entry_at: new Date().toISOString(),
      metadata: {
        event_id: ticket.event_id,
        ticket_type_id: ticket.ticket_type_id,
        wallet_binding_id: ticket.wallet_binding_id,
      },
    });

    return res.status(200).json({
      allowed: true,
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        event_name: ticket.events.name,
        ticket_type_name: ticket.ticket_types.name,
        entry_count: newEntryCount,
        allows_reentry: ticket.ticket_types.allows_reentry,
      },
      message: `Entry granted - ${ticket.events.name}`,
    });

  } catch (error) {
    console.error('Ticket validation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      allowed: false
    });
  }
}
