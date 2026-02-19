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
        .eq('is_active', true)
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

      if (!profile_name || valid_percentage === undefined || vendor_percentage === undefined || 
          pool_percentage === undefined || promoter_percentage === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate total = 100
      const total = parseFloat(valid_percentage) + parseFloat(vendor_percentage) + 
                    parseFloat(pool_percentage) + parseFloat(promoter_percentage) + 
                    parseFloat(executive_percentage || 0);

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
          valid_percentage: parseFloat(valid_percentage),
          vendor_percentage: parseFloat(vendor_percentage),
          pool_percentage: parseFloat(pool_percentage),
          promoter_percentage: parseFloat(promoter_percentage),
          executive_percentage: parseFloat(executive_percentage || 0)
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        action: 'CREATE_REVENUE_PROFILE',
        resource_type: 'revenue_profile',
        resource_id: data.id,
        new_value: data
      });

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Create revenue profile error:', error);
      res.status(500).json({ error: 'Failed to create revenue profile', detail: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Profile ID required' });
      }

      // If percentages are being updated, validate total
      if (updates.valid_percentage !== undefined || updates.vendor_percentage !== undefined ||
          updates.pool_percentage !== undefined || updates.promoter_percentage !== undefined ||
          updates.executive_percentage !== undefined) {
        
        const { data: existing } = await supabase
          .from('revenue_profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (!existing) {
          return res.status(404).json({ error: 'Profile not found' });
        }

        const total = parseFloat(updates.valid_percentage ?? existing.valid_percentage) +
                      parseFloat(updates.vendor_percentage ?? existing.vendor_percentage) +
                      parseFloat(updates.pool_percentage ?? existing.pool_percentage) +
                      parseFloat(updates.promoter_percentage ?? existing.promoter_percentage) +
                      parseFloat(updates.executive_percentage ?? existing.executive_percentage);

        if (Math.abs(total - 100) > 0.01) {
          return res.status(400).json({ 
            error: 'Percentages must total 100',
            current_total: total
          });
        }
      }

      const { data, error } = await supabase
        .from('revenue_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json(data);
    } catch (error: any) {
      console.error('Update revenue profile error:', error);
      res.status(500).json({ error: 'Failed to update revenue profile', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
