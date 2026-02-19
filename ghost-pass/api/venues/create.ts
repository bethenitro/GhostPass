import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      venue_id,
      venue_name,
      address,
      city,
      state,
      country,
      timezone
    } = req.body;

    if (!venue_id || !venue_name) {
      return res.status(400).json({ error: 'venue_id and venue_name are required' });
    }

    const { data, error } = await supabase
      .from('venues')
      .insert({
        venue_id,
        venue_name,
        address,
        city,
        state,
        country: country || 'US',
        timezone: timezone || 'America/New_York'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Create venue error:', error);
    res.status(500).json({ error: 'Failed to create venue', detail: error.message });
  }
};
