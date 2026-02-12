import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { entry_point_id, limit = '50' } = req.query;

      if (!entry_point_id) {
        return res.status(400).json({ error: 'entry_point_id is required' });
      }

      // Verify entry point exists
      const { data: gateway, error: gatewayError } = await supabase
        .from('gateway_points')
        .select('id')
        .eq('id', entry_point_id)
        .single();

      if (gatewayError || !gateway) {
        return res.status(404).json({ error: 'Entry point not found' });
      }

      // Get audit history
      const { data, error } = await supabase.rpc('get_entry_point_audit_logs', {
        p_entry_point_id: entry_point_id,
        p_employee_name: null,
        p_action_type: null,
        p_start_date: null,
        p_end_date: null,
        p_source_location: null,
        p_limit: parseInt(limit as string),
        p_offset: 0
      });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Error fetching entry point history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch entry point history',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
