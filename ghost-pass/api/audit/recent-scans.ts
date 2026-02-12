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
      const { hours = '24', limit = '50' } = req.query;
      const hoursNum = parseInt(hours as string);

      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hoursNum);

      // Get recent scans
      const { data, error } = await supabase.rpc('get_entry_point_audit_logs', {
        p_entry_point_id: null,
        p_employee_name: null,
        p_action_type: 'SCAN',
        p_start_date: startDate.toISOString(),
        p_end_date: null,
        p_source_location: null,
        p_limit: parseInt(limit as string),
        p_offset: 0
      });

      if (error) throw error;

      // Format for display
      const scans = (data || []).map((log: any) => ({
        id: log.id,
        entry_point_name: log.entry_point_name,
        entry_point_type: log.entry_point_type,
        employee_name: log.employee_name,
        timestamp: log.created_at,
        metadata: log.metadata
      }));

      res.status(200).json({
        period_hours: hoursNum,
        total_scans: scans.length,
        scans
      });
    } catch (error: any) {
      console.error('Error fetching recent scans:', error);
      res.status(500).json({ 
        error: 'Failed to fetch recent scans',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
