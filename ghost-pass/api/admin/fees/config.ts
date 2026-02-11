import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/auth.js';
import { supabase } from '../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin authentication
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  try {
    const { valid_pct, vendor_pct, pool_pct, promoter_pct, venue_id = 'default' } = req.body;

    // Validate percentages sum to 100
    const total = valid_pct + vendor_pct + pool_pct + promoter_pct;
    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({ detail: 'Fee percentages must sum to 100%' });
    }

    // Get current config for audit
    const { data: currentConfig } = await supabase
      .from('fee_configs')
      .select('*')
      .eq('venue_id', venue_id)
      .single();

    // Upsert new config
    const newConfig = {
      venue_id,
      valid_pct,
      vendor_pct,
      pool_pct,
      promoter_pct,
    };

    const { error } = await supabase
      .from('fee_configs')
      .upsert(newConfig, { onConflict: 'venue_id' });

    if (error) throw error;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'UPDATE_FEE_CONFIG',
      resource_type: 'fee_config',
      resource_id: venue_id,
      old_value: currentConfig,
      new_value: newConfig,
    });

    res.status(200).json({
      status: 'success',
      message: `Fee configuration updated for ${venue_id}`,
    });
  } catch (error: any) {
    console.error('Fee config update error:', error);
    res.status(500).json({ detail: 'Failed to update fee configuration' });
  }
};
