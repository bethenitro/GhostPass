import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { venue_id, status } = req.query;

    let query = supabase
      .from('events')
      .select('*');

    // Filter events based on user role and venue
    if (venue_id) {
      query = query.eq('venue_id', venue_id);
    } else if (user.role === 'VENUE_ADMIN' && user.venue_id) {
      // VENUE_ADMIN only sees events for their venue
      query = query.eq('venue_id', user.venue_id);
    }
    // ADMIN sees all events (no filter)

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('start_date', { ascending: false });

    if (error) throw error;

    // Map database columns to frontend expected format
    const mappedData = (data || []).map(event => ({
      ...event,
      event_id: event.id,
      event_name: event.name,
    }));

    res.status(200).json(mappedData);
  } catch (error: any) {
    console.error('List events error:', error);
    res.status(500).json({ error: 'Failed to list events', detail: error.message });
  }
};
