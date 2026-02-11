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
    const { payout_id } = req.query;
    const { action, notes } = req.body;

    if (!payout_id) {
      return res.status(400).json({ detail: 'payout_id is required' });
    }

    if (!action || !['approve', 'reject', 'process'].includes(action.toLowerCase())) {
      return res.status(400).json({ detail: 'Invalid action. Must be approve, reject, or process' });
    }

    // Get current payout
    const { data: currentPayout, error: fetchError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', payout_id)
      .single();

    if (fetchError || !currentPayout) {
      return res.status(404).json({ detail: 'Payout request not found' });
    }

    // Update payout status
    const updateData = {
      status: action.toUpperCase(),
      processed_at: new Date().toISOString(),
      processed_by: adminUser.id,
      notes: notes || null
    };

    const { error: updateError } = await supabase
      .from('payout_requests')
      .update(updateData)
      .eq('id', payout_id);

    if (updateError) throw updateError;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: `PAYOUT_${action.toUpperCase()}`,
      resource_type: 'payout_request',
      resource_id: payout_id as string,
      old_value: currentPayout,
      new_value: { ...currentPayout, ...updateData }
    });

    res.status(200).json({
      status: 'success',
      message: `Payout ${action}d successfully`
    });
  } catch (error: any) {
    console.error('Payout action error:', error);
    res.status(500).json({ detail: 'Failed to process payout action' });
  }
};
