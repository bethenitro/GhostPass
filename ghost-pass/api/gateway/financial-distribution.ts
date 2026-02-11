import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: Get actual venue_id from user context
    const venueId = 'venue_001';

    // Get all FEE transactions for this venue
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'FEE')
      .eq('venue_id', venueId);

    if (error) throw error;

    if (!transactions || transactions.length === 0) {
      return res.status(200).json({
        gross_collected_cents: 0,
        scan_fee_total_cents: 0,
        vendor_net_cents: 0,
        total_scans: 0,
        status: 'NO_ACTIVITY',
        breakdown: {
          valid_pct_cents: 0,
          vendor_pct_cents: 0,
          pool_pct_cents: 0,
          promoter_pct_cents: 0
        }
      });
    }

    // Calculate totals
    const uniquePassIds = new Set(
      transactions
        .map(tx => tx.metadata?.pass_id)
        .filter(Boolean)
    );
    const totalScans = uniquePassIds.size;

    // Group by split type
    const breakdown = {
      valid_pct_cents: 0,
      vendor_pct_cents: 0,
      pool_pct_cents: 0,
      promoter_pct_cents: 0
    };

    for (const tx of transactions) {
      const vendorName = tx.vendor_name || '';
      const amount = tx.amount_cents || 0;

      if (vendorName.toLowerCase().includes('valid')) {
        breakdown.valid_pct_cents += amount;
      } else if (vendorName.toLowerCase().includes('vendor')) {
        breakdown.vendor_pct_cents += amount;
      } else if (vendorName.toLowerCase().includes('pool')) {
        breakdown.pool_pct_cents += amount;
      } else if (vendorName.toLowerCase().includes('promoter')) {
        breakdown.promoter_pct_cents += amount;
      }
    }

    // Calculate totals
    const grossCollected = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    const scanFeeTotal = grossCollected; // All fees collected from scans
    const vendorNet = breakdown.vendor_pct_cents; // Vendor's portion

    // Determine status (simplified - in production would check payout records)
    const status = vendorNet > 0 ? 'PENDING' : 'NO_ACTIVITY';

    res.status(200).json({
      gross_collected_cents: grossCollected,
      scan_fee_total_cents: scanFeeTotal,
      vendor_net_cents: vendorNet,
      total_scans: totalScans,
      status,
      breakdown,
      gross_collected_dollars: grossCollected / 100.0,
      scan_fee_total_dollars: scanFeeTotal / 100.0,
      vendor_net_dollars: vendorNet / 100.0
    });
  } catch (error) {
    console.error('Financial distribution error:', error);
    res.status(500).json({ detail: 'Failed to fetch financial distribution' });
  }
};
