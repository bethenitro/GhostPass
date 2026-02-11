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
    const { retention_days, justification } = req.body;

    if (!retention_days || !justification) {
      return res.status(400).json({ detail: 'retention_days and justification are required' });
    }

    if (justification.length < 10) {
      return res.status(400).json({ detail: 'Justification must be at least 10 characters' });
    }

    // Get current retention config
    const { data: currentConfig } = await supabase
      .from('system_configs')
      .select('*')
      .eq('config_key', 'data_retention')
      .single();

    const oldValue = currentConfig?.config_value || { retention_days: 60 };

    // New retention configuration
    const newRetention = {
      retention_days,
      justification,
      overridden_by: adminUser.id,
      overridden_at: new Date().toISOString()
    };

    // Save updated retention config
    const { error } = await supabase
      .from('system_configs')
      .upsert({
        config_key: 'data_retention',
        config_value: newRetention,
        updated_by: adminUser.id
      }, { onConflict: 'config_key' });

    if (error) throw error;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'OVERRIDE_DATA_RETENTION',
      resource_type: 'system_config',
      resource_id: 'data_retention',
      old_value: oldValue,
      new_value: newRetention,
      metadata: { justification }
    });

    res.status(200).json({
      status: 'success',
      message: `Data retention period updated to ${retention_days} days`
    });
  } catch (error: any) {
    console.error('Retention override error:', error);
    res.status(500).json({ detail: 'Failed to override retention period' });
  }
};
