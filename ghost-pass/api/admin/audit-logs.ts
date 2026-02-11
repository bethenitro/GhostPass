import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin authentication
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  try {
    const { limit = '50', offset = '0', action } = req.query;

    const limitNum = Math.min(parseInt(limit as string), 200);
    const offsetNum = Math.max(parseInt(offset as string), 0);

    let query = supabase
      .from('audit_logs')
      .select(`
        id, admin_user_id, action, resource_type, resource_id, old_value, new_value, timestamp, metadata
      `);

    if (action) {
      query = query.eq('action', (action as string).toUpperCase());
    }

    const { data: auditData, error } = await query
      .order('timestamp', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) throw error;

    // Fetch admin user emails for each log
    const auditLogs = await Promise.all(
      (auditData || []).map(async (log) => {
        try {
          const { data: adminData } = await supabase
            .from('users')
            .select('email')
            .eq('id', log.admin_user_id)
            .single();

          return {
            ...log,
            admin_email: adminData?.email || 'Unknown'
          };
        } catch (error) {
          console.warn(`Error fetching admin email for ${log.admin_user_id}:`, error);
          return {
            ...log,
            admin_email: 'Unknown'
          };
        }
      })
    );

    res.status(200).json(auditLogs);
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ detail: 'Failed to get audit logs' });
  }
};
