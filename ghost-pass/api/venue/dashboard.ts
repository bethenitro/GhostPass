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
      const { venue_id, event_id } = req.query;

      // For VENUE_ADMIN, use their assigned venue_id
      const targetVenueId = user.role === 'VENUE_ADMIN' ? (user as any).venue_id : venue_id;

      if (!targetVenueId) {
        return res.status(400).json({ error: 'venue_id is required' });
      }

      // Fetch all data in parallel
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${protocol}://${req.headers.host}`;
      
      const [configRes, statsRes, payoutsRes, auditLogsRes] = await Promise.allSettled([
        // Config
        fetch(`${baseUrl}/api/venue/config?venue_id=${targetVenueId}${event_id ? `&event_id=${event_id}` : ''}`, {
          headers: { Authorization: req.headers.authorization || '' }
        }).then(r => r.json()),
        
        // Stats
        fetch(`${baseUrl}/api/venue/stats?venue_id=${targetVenueId}${event_id ? `&event_id=${event_id}` : ''}`, {
          headers: { Authorization: req.headers.authorization || '' }
        }).then(r => r.json()),
        
        // Payouts
        fetch(`${baseUrl}/api/venue/payouts?venue_id=${targetVenueId}${event_id ? `&event_id=${event_id}` : ''}`, {
          headers: { Authorization: req.headers.authorization || '' }
        }).then(r => r.json()),
        
        // Audit Logs
        fetch(`${baseUrl}/api/venue/audit-logs?venue_id=${targetVenueId}${event_id ? `&event_id=${event_id}` : ''}&limit=10`, {
          headers: { Authorization: req.headers.authorization || '' }
        }).then(r => r.json())
      ]);

      const dashboard = {
        config: configRes.status === 'fulfilled' ? configRes.value : null,
        stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
        vendor_payouts: payoutsRes.status === 'fulfilled' ? payoutsRes.value : [],
        recent_audit_logs: auditLogsRes.status === 'fulfilled' ? auditLogsRes.value : []
      };

      res.status(200).json(dashboard);
    } catch (error: any) {
      console.error('Error fetching venue dashboard:', error);
      res.status(500).json({ 
        error: 'Failed to fetch venue dashboard',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
