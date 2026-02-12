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
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      const endDate = new Date();

      // Call the database function to get summary stats
      const { data, error } = await supabase.rpc('get_audit_summary_stats', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(200).json({
          period_days: daysNum,
          total_actions: 0,
          total_scans: 0,
          total_edits: 0,
          total_creates: 0,
          total_deactivates: 0,
          unique_entry_points: 0,
          unique_employees: 0,
          most_active_entry_point: 'None',
          most_active_employee: 'None'
        });
      }

      const stats = data[0];
      stats.period_days = daysNum;

      res.status(200).json(stats);
    } catch (error: any) {
      console.error('Error fetching audit summary:', error);
      res.status(500).json({ 
        error: 'Failed to fetch audit summary',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
