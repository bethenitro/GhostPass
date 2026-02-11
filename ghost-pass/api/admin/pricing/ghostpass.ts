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
    const {
      one_day_cents,
      three_day_cents,
      five_day_cents,
      seven_day_cents,
      ten_day_cents,
      fourteen_day_cents,
      thirty_day_cents
    } = req.body;

    // Get current pricing config for audit
    const { data: currentConfig } = await supabase
      .from('system_configs')
      .select('*')
      .eq('config_key', 'ghostpass_pricing')
      .single();

    // New pricing configuration
    const newPricing = {
      '1': one_day_cents,
      '3': three_day_cents,
      '5': five_day_cents,
      '7': seven_day_cents,
      '10': ten_day_cents,
      '14': fourteen_day_cents,
      '30': thirty_day_cents
    };

    // Save updated pricing
    const { error } = await supabase
      .from('system_configs')
      .upsert({
        config_key: 'ghostpass_pricing',
        config_value: newPricing,
        updated_by: adminUser.id
      }, { onConflict: 'config_key' });

    if (error) throw error;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'UPDATE_GHOSTPASS_PRICING',
      resource_type: 'system_config',
      resource_id: 'ghostpass_pricing',
      old_value: currentConfig?.config_value || null,
      new_value: newPricing
    });

    res.status(200).json({
      status: 'success',
      message: 'GhostPass pricing updated'
    });
  } catch (error: any) {
    console.error('GhostPass pricing update error:', error);
    res.status(500).json({ detail: 'Failed to update GhostPass pricing' });
  }
};
