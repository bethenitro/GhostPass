/**
 * List Ticket Types API
 * 
 * Returns all ticket types for a specific event.
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event_id } = req.query;

    if (!event_id || typeof event_id !== 'string') {
      return res.status(400).json({ error: 'event_id query parameter required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ticket types for event
    const { data: ticketTypes, error: ticketTypesError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', event_id)
      .order('price_cents', { ascending: true });

    if (ticketTypesError) {
      return res.status(500).json({ error: 'Failed to fetch ticket types' });
    }

    return res.status(200).json({
      ticket_types: ticketTypes || [],
      count: ticketTypes?.length || 0,
    });

  } catch (error) {
    console.error('List ticket types error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
