import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('revenue_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Get revenue profiles error:', error);
      res.status(500).json({ error: 'Failed to get revenue profiles', detail: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        profile_name,
        description,
        valid_percentage,
        vendor_percentage,
        pool_percentage,
        promoter_percentage,
        executive_percentage
      } = req.body;

      // Validate total = 100
      const total = (valid_percentage || 0) + (vendor_percentage || 0) + 
                    (pool_percentage || 0) + (promoter_percentage || 0) + 
                    (executive_percentage || 0);

      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({ 
          error: 'Percentages must total 100',
          current_total: total
        });
      }

      const { data, error } = await supabase
        .from('revenue_profiles')
        .insert({
          profile_name,
          description,
          valid_percentage,
          vendor_percentage,
          pool_percentage,
          promoter_percentage,
          executive_percentage: executive_percentage || 0
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Create revenue profile error:', error);
      res.status(500).json({ error: 'Failed to create revenue profile', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
