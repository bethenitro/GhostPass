import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../../_lib/cors.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { supabase } from '../../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin authentication
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  try {
    // Get all pending payouts
    const { data: pendingPayouts, error: fetchError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('status', 'PENDING');

    if (fetchError) throw fetchError;

    if (!pendingPayouts || pendingPayouts.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No pending payouts to process',
        processed_count: 0
      });
    }

    // Update all to approved
    const updateData = {
      status: 'APPROVED',
      processed_at: new Date().toISOString(),
      processed_by: adminUser.id,
      notes: 'Batch processed by admin'
    };

    const { error: updateError } = await supabase
      .from('payout_requests')
      .update(updateData)
      .eq('status', 'PENDING');

    if (updateError) throw updateError;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'BATCH_APPROVE_PAYOUTS',
      resource_type: 'payout_request',
      resource_id: null,
      old_value: null,
      new_value: { processed_count: pendingPayouts.length }
    });

    res.status(200).json({
      status: 'success',
      message: `Processed ${pendingPayouts.length} payouts`,
      processed_count: pendingPayouts.length
    });
  } catch (error: any) {
    console.error('Batch payout processing error:', error);
    res.status(500).json({ detail: 'Failed to process batch payouts' });
  }
};
