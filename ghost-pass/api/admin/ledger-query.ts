import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      venue_id,
      event_id,
      station_id,
      employee_id,
      revenue_profile_id,
      transaction_type,
      start_date,
      end_date,
      limit = '50',
      offset = '0'
    } = req.query;

    let query = supabase
      .from('transaction_ledger')
      .select(`
        *,
        revenue_profiles:revenue_profile_id(profile_name)
      `);

    // Apply filters
    if (venue_id) query = query.eq('venue_id', venue_id);
    if (event_id) query = query.eq('event_id', event_id);
    if (station_id) query = query.eq('station_id', station_id);
    if (employee_id) query = query.eq('employee_id', employee_id);
    if (revenue_profile_id) query = query.eq('revenue_profile_id', revenue_profile_id);
    if (transaction_type) query = query.eq('transaction_type', transaction_type);
    
    if (start_date) {
      query = query.gte('timestamp', start_date);
    }
    if (end_date) {
      query = query.lte('timestamp', end_date);
    }

    const { data, error, count } = await query
      .order('timestamp', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) throw error;

    res.status(200).json({
      transactions: data || [],
      total: count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error: any) {
    console.error('Ledger query error:', error);
    res.status(500).json({ error: 'Failed to query ledger', detail: error.message });
  }
};
