/**
 * List User Tickets API
 * 
 * Returns all tickets for a user's wallet.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'X-Device-Fingerprint header required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_binding_id')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Get tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('event_tickets')
      .select(`
        *,
        events (
          id,
          name,
          venue_name,
          start_date,
          end_date,
          status
        ),
        ticket_types (
          id,
          name,
          description,
          allows_reentry
        )
      `)
      .eq('wallet_binding_id', wallet.wallet_binding_id)
      .order('purchased_at', { ascending: false });

    if (ticketsError) {
      return res.status(500).json({ error: 'Failed to fetch tickets' });
    }

    // Format tickets
    const formattedTickets = (tickets || []).map(ticket => ({
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      status: ticket.status,
      event: {
        id: ticket.events.id,
        name: ticket.events.name,
        venue_name: ticket.events.venue_name,
        start_date: ticket.events.start_date,
        end_date: ticket.events.end_date,
        status: ticket.events.status,
      },
      ticket_type: {
        id: ticket.ticket_types.id,
        name: ticket.ticket_types.name,
        description: ticket.ticket_types.description,
        allows_reentry: ticket.ticket_types.allows_reentry,
      },
      pricing: {
        ticket_price_cents: ticket.ticket_price_cents,
        service_fee_cents: ticket.service_fee_cents,
        total_paid_cents: ticket.total_paid_cents,
      },
      entry: {
        granted: ticket.entry_granted,
        count: ticket.entry_count,
        last_entry_at: ticket.last_entry_at,
      },
      purchased_at: ticket.purchased_at,
      valid_from: ticket.valid_from,
      valid_until: ticket.valid_until,
    }));

    return res.status(200).json({
      tickets: formattedTickets,
      count: formattedTickets.length,
    });

  } catch (error) {
    console.error('List tickets error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
