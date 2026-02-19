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

    if (venue_id) {
      query = query.eq('venue_id', venue_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('start_date', { ascending: false });

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (error: any) {
    console.error('List events error:', error);
    res.status(500).json({ error: 'Failed to list events', detail: error.message });
  }
};
