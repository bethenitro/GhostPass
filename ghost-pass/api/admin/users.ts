import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin or venue admin authentication
  const user = await requireAdmin(req, res);
  if (!user) return;

  // Allow VENUE_ADMIN to access
  if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { limit = '50', offset = '0', role, venue_id } = req.query;

    const limitNum = Math.min(parseInt(limit as string), 200);
    const offsetNum = Math.max(parseInt(offset as string), 0);

    let query = supabase
      .from('users')
      .select('id, email, role, venue_id, created_at');

    // If VENUE_ADMIN, only show users from their venue
    if (user.role === 'VENUE_ADMIN' && user.venue_id) {
      query = query.eq('venue_id', user.venue_id);
    } else if (venue_id) {
      // ADMIN can filter by venue_id
      query = query.eq('venue_id', venue_id);
    }

    if (role) {
      query = query.eq('role', (role as string).toUpperCase());
    }

    const { data: usersData, error } = await query
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) throw error;

    res.status(200).json(usersData || []);
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ detail: 'Failed to get users' });
  }
};
