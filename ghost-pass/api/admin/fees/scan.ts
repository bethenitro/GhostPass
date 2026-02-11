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
    const { venue_id, fee_cents } = req.body;

    if (!venue_id) {
      return res.status(400).json({ detail: 'venue_id is required' });
    }

    // Get current system config for scan fees
    const { data: currentConfig } = await supabase
      .from('system_configs')
      .select('*')
      .eq('config_key', 'scan_fees')
      .single();

    let scanFees: Record<string, number> = {};
    let oldValue = null;

    if (currentConfig) {
      scanFees = currentConfig.config_value || {};
      oldValue = { ...scanFees };
    }

    // Update scan fee for venue
    scanFees[venue_id] = fee_cents;

    // Save updated config
    const { error } = await supabase
      .from('system_configs')
      .upsert({
        config_key: 'scan_fees',
        config_value: scanFees,
        updated_by: adminUser.id
      }, { onConflict: 'config_key' });

    if (error) throw error;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'UPDATE_SCAN_FEE',
      resource_type: 'system_config',
      resource_id: 'scan_fees',
      old_value: oldValue,
      new_value: scanFees
    });

    res.status(200).json({
      status: 'success',
      message: `Scan fee updated for ${venue_id}`
    });
  } catch (error: any) {
    console.error('Scan fee update error:', error);
    res.status(500).json({ detail: 'Failed to update scan fee' });
  }
};
