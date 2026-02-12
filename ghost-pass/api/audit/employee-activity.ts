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
      const { employee_name, days = '7', limit = '100' } = req.query;

      if (!employee_name) {
        return res.status(400).json({ error: 'employee_name is required' });
      }

      const daysNum = parseInt(days as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // Get employee activity
      const { data, error } = await supabase.rpc('get_entry_point_audit_logs', {
        p_entry_point_id: null,
        p_employee_name: employee_name,
        p_action_type: null,
        p_start_date: startDate.toISOString(),
        p_end_date: null,
        p_source_location: null,
        p_limit: parseInt(limit as string),
        p_offset: 0
      });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Error fetching employee activity:', error);
      res.status(500).json({ 
        error: 'Failed to fetch employee activity',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
