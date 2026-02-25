/**
 * Public Menu Items Endpoint
 * 
 * Allows anonymous users to view menu items for a venue/event
 * No authentication required - read-only access
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { venue_id, event_id, station_type } = req.query;

    // At least one filter is required to prevent fetching all menu items
    if (!venue_id && !event_id) {
      return res.status(400).json({ 
        error: 'Either venue_id or event_id is required' 
      });
    }

    let query = supabase
      .from('menu_items')
      .select('id, venue_id, event_id, station_type, item_name, item_category, price_cents, is_taxable, is_alcohol, is_food, sort_order');

    if (venue_id) query = query.eq('venue_id', venue_id);
    if (event_id) query = query.eq('event_id', event_id);
    if (station_type) query = query.eq('station_type', station_type);

    const { data, error } = await query.order('sort_order', { ascending: true });

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Get public menu items error:', error);
    res.status(500).json({ 
      error: 'Failed to get menu items', 
      detail: error.message 
    });
  }
};
