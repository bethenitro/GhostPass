import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  // Check if user is VENUE_ADMIN or ADMIN
  if (user.role !== 'VENUE_ADMIN' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', detail: 'Venue admin access required' });
  }

  if (req.method === 'GET') {
    try {
      const { venue_id, event_id, limit = '50' } = req.query;

      // For VENUE_ADMIN, use their assigned venue_id
      const targetVenueId = user.role === 'VENUE_ADMIN' ? (user as any).venue_id : venue_id;

      if (!targetVenueId) {
        return res.status(400).json({ error: 'venue_id is required' });
      }

      // Get audit logs related to this venue
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('resource_id', targetVenueId)
        .order('timestamp', { ascending: false })
        .limit(parseInt(limit as string));

      const { data, error } = await query;

      if (error) throw error;

      // Format for venue admin view
      const formattedLogs = data?.map(log => ({
        id: log.id,
        action_type: log.action,
        event_id: event_id || 'all',
        venue_id: targetVenueId,
        admin_email: log.admin_email || 'System',
        details: log.new_value || log.metadata || {},
        created_at: log.timestamp
      })) || [];

      res.status(200).json(formattedLogs);
    } catch (error: any) {
      console.error('Error fetching venue audit logs:', error);
      res.status(500).json({ 
        error: 'Failed to fetch audit logs',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
