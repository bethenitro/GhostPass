import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { adminSupabase } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { vendor_id } = req.query;
    const targetId = (vendor_id as string) || user.id;

    const { data, error } = await adminSupabase
      .from('vendor_payout_setups')
      .select('*')
      .eq('vendor_id', targetId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || null);
  }

  if (req.method === 'POST') {
    const { method, details, venue_id } = req.body;

    if (!method) return res.status(400).json({ error: 'method is required' });

    // Only include venue_id if it looks like a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeVenueId = venue_id && uuidRegex.test(venue_id) ? venue_id : null;

    const { data, error } = await adminSupabase
      .from('vendor_payout_setups')
      .upsert({
        vendor_id: user.id,
        venue_id: safeVenueId,
        method,
        details,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'vendor_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
