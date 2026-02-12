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

      // Get vendor payouts for this venue/event
      // This requires joining transactions with payout_requests
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('vendor_id, vendor_name, vendor_payout_cents, metadata')
        .eq('venue_id', targetVenueId)
        .not('vendor_id', 'is', null);

      if (txError) throw txError;

      // Group by vendor and calculate totals
      const vendorPayouts: Record<string, any> = {};

      transactions?.forEach(tx => {
        if (!tx.vendor_id) return;

        if (!vendorPayouts[tx.vendor_id]) {
          vendorPayouts[tx.vendor_id] = {
            vendor_id: tx.vendor_id,
            vendor_name: tx.vendor_name || 'Unknown Vendor',
            event_id: event_id || 'all',
            amount_cents: 0,
            transaction_count: 0,
            status: 'PENDING'
          };
        }

        vendorPayouts[tx.vendor_id].amount_cents += tx.vendor_payout_cents || 0;
        vendorPayouts[tx.vendor_id].transaction_count += 1;
      });

      // Get actual payout requests to update status
      const { data: payoutRequests, error: payoutError } = await supabase
        .from('payout_requests')
        .select('*')
        .in('vendor_id', Object.keys(vendorPayouts));

      if (payoutError) throw payoutError;

      // Update status based on payout requests
      payoutRequests?.forEach(payout => {
        if (vendorPayouts[payout.vendor_id]) {
          vendorPayouts[payout.vendor_id].status = payout.status;
          vendorPayouts[payout.vendor_id].id = payout.id;
          vendorPayouts[payout.vendor_id].created_at = payout.created_at;
          vendorPayouts[payout.vendor_id].paid_at = payout.processed_at;
        }
      });

      const payouts = Object.values(vendorPayouts);

      res.status(200).json(payouts);
    } catch (error: any) {
      console.error('Error fetching vendor payouts:', error);
      res.status(500).json({ 
        error: 'Failed to fetch vendor payouts',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
