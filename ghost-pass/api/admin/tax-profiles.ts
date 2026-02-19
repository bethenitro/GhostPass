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
      const { venue_id } = req.query;

      let query = supabase
        .from('tax_profiles')
        .select('*')
        .eq('is_active', true);

      if (venue_id) {
        query = query.eq('venue_id', venue_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Get tax profiles error:', error);
      res.status(500).json({ error: 'Failed to get tax profiles', detail: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        profile_name,
        venue_id,
        state_tax_percentage,
        local_tax_percentage,
        alcohol_tax_percentage,
        food_tax_percentage
      } = req.body;

      if (!profile_name) {
        return res.status(400).json({ error: 'Profile name required' });
      }

      const { data, error } = await supabase
        .from('tax_profiles')
        .insert({
          profile_name,
          venue_id,
          state_tax_percentage: parseFloat(state_tax_percentage || 0),
          local_tax_percentage: parseFloat(local_tax_percentage || 0),
          alcohol_tax_percentage: parseFloat(alcohol_tax_percentage || 0),
          food_tax_percentage: parseFloat(food_tax_percentage || 0)
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Create tax profile error:', error);
      res.status(500).json({ error: 'Failed to create tax profile', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
