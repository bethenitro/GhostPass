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
    const { status } = req.query;

    let query = supabase
      .from('payout_requests')
      .select(`
        id, vendor_user_id, amount_cents, status, requested_at, processed_at, processed_by, notes
      `);

    if (status) {
      query = query.eq('status', (status as string).toUpperCase());
    }

    const { data: payoutsData, error } = await query.order('requested_at', { ascending: false });

    if (error) throw error;

    // Fetch vendor emails for each payout
    const payouts = await Promise.all(
      (payoutsData || []).map(async (payout) => {
        try {
          const { data: vendorData } = await supabase
            .from('users')
            .select('email')
            .eq('id', payout.vendor_user_id)
            .single();

          return {
            ...payout,
            vendor_email: vendorData?.email || 'Unknown'
          };
        } catch (error) {
          console.warn(`Error fetching vendor email for ${payout.vendor_user_id}:`, error);
          return {
            ...payout,
            vendor_email: 'Unknown'
          };
        }
      })
    );

    res.status(200).json(payouts);
  } catch (error: any) {
    console.error('Get payout requests error:', error);
    res.status(500).json({ detail: 'Failed to get payout requests' });
  }
};
