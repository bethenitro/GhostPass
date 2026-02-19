import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const { venue_id, event_id, station_type } = req.query;

      let query = supabase
        .from('menu_items')
        .select(`
          *,
          revenue_profiles:revenue_profile_id(*)
        `);

      if (venue_id) query = query.eq('venue_id', venue_id);
      if (event_id) query = query.eq('event_id', event_id);
      if (station_type) query = query.eq('station_type', station_type);

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Get menu items error:', error);
      res.status(500).json({ error: 'Failed to get menu items', detail: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        venue_id,
        event_id,
        station_type,
        item_name,
        item_category,
        price_cents,
        is_taxable,
        is_alcohol,
        is_food,
        revenue_profile_id,
        sort_order
      } = req.body;

      if (!venue_id || !station_type || !item_name || price_cents === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('menu_items')
        .insert({
          venue_id,
          event_id,
          station_type,
          item_name,
          item_category,
          price_cents,
          is_taxable: is_taxable !== undefined ? is_taxable : true,
          is_alcohol: is_alcohol || false,
          is_food: is_food || false,
          revenue_profile_id,
          sort_order: sort_order || 0
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Create menu item error:', error);
      res.status(500).json({ error: 'Failed to create menu item', detail: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Item ID required' });
      }

      const { data, error } = await supabase
        .from('menu_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json(data);
    } catch (error: any) {
      console.error('Update menu item error:', error);
      res.status(500).json({ error: 'Failed to update menu item', detail: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Item ID required' });
      }

      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Delete menu item error:', error);
      res.status(500).json({ error: 'Failed to delete menu item', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
