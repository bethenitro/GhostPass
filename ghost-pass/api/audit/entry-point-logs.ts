import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req, res);

    const { entry_point_id, employee_name, action_type, limit = 50, offset = 0 } = req.query;

    let query = supabase.from('audit_logs').select('*');

    if (entry_point_id) query = query.eq('entry_point_id', entry_point_id);
    if (employee_name) query = query.eq('employee_name', employee_name);
    if (action_type) query = query.eq('action_type', action_type);

    const { data: logs } = await query
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.status(200).json(logs || []);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ detail: 'Failed to fetch audit logs' });
  }
};
