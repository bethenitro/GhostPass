import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { wallet_binding_id, venue_id, event_id, limit = '50' } = req.query;

    let query = supabase
      .from('entry_tracking')
      .select(`
        *,
        venue_transaction_ledger:transaction_id(*)
      `);

    if (wallet_binding_id) query = query.eq('wallet_binding_id', wallet_binding_id);
    if (venue_id) query = query.eq('venue_id', venue_id);
    if (event_id) query = query.eq('event_id', event_id);

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Get entry tracking history error:', error);
    res.status(500).json({ error: 'Failed to get entry tracking history', detail: error.message });
  }
};
