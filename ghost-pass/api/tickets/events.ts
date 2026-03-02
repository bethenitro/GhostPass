/**
 * List / Fetch Events API
 *
 * GET /api/tickets/events            – Returns all active, non-expired events.
 * GET /api/tickets/events?event_id=X – Returns a single event by its ID
 *                                       (no expiry filter, so it works for
 *                                        recently-ended events as well).
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id } = req.query;

    // --- Single-event lookup (used by the WebApp onboarding flow) ---
    if (event_id && typeof event_id === 'string') {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (eventError || !event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Return in the same shape as the list endpoint so the frontend
      // code can work with both responses seamlessly.
      return res.status(200).json({
        events: [event],
        count: 1,
      });
    }

    // --- Full list (used by TicketPurchase, etc.) ---
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (eventsError) {
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    return res.status(200).json({
      events: events || [],
      count: events?.length || 0,
    });

  } catch (error) {
    console.error('List events error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
