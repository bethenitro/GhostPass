/**
 * Public Venues List - no auth required
 */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data, error } = await supabase
      .from('venues')
      .select('id, name, address, venue_type')
      .order('name', { ascending: true });

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list venues', detail: error.message });
  }
};
