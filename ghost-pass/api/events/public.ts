/**
 * Public Events List - no auth required
 */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { venue_id } = req.query;

    let query = supabase
      .from('events')
      .select('id, name, venue_id, start_date, end_date, status')
      .eq('status', 'active')
      .order('start_date', { ascending: true });

    if (venue_id) query = query.eq('venue_id', venue_id as string);

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list events', detail: error.message });
  }
};
