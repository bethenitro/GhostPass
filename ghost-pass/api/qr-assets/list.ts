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

    const { venue_id, event_id, station_id, asset_type } = req.query;

    let query = supabase
      .from('qr_nfc_assets')
      .select(`
        *,
        revenue_profiles:revenue_profile_id(*),
        tax_profiles:tax_profile_id(*)
      `);

    if (venue_id) query = query.eq('venue_id', venue_id);
    if (event_id) query = query.eq('event_id', event_id);
    if (station_id) query = query.eq('station_id', station_id);
    if (asset_type) query = query.eq('asset_type', asset_type);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (error: any) {
    console.error('List QR assets error:', error);
    res.status(500).json({ error: 'Failed to list QR assets', detail: error.message });
  }
};
