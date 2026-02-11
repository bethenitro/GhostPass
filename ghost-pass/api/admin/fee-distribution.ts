import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  // Require admin authentication
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  // GET /api/admin/fee-distribution - Get current fee distribution configuration
  if (req.method === 'GET') {
    try {
      // Get fee distribution config from system_configs
      const { data: config, error } = await supabase
        .from('system_configs')
        .select('config_value')
        .eq('config_key', 'fee_distribution')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      // Default distribution if not configured
      const distribution = config?.config_value || {
        valid_platform_percentage: 40,
        vendor_percentage: 30,
        pool_percentage: 20,
        promoter_percentage: 10
      };

      res.status(200).json({
        distribution: {
          valid_platform: `${distribution.valid_platform_percentage}%`,
          vendor: `${distribution.vendor_percentage}%`,
          pool: `${distribution.pool_percentage}%`,
          promoter: `${distribution.promoter_percentage}%`
        },
        raw_percentages: distribution
      });
    } catch (error: any) {
      console.error('Get fee distribution error:', error);
      res.status(500).json({ detail: 'Failed to get fee distribution' });
    }
  }
  // POST /api/admin/fee-distribution - Set fee distribution percentages
  else if (req.method === 'POST') {
    try {
      const { valid_percentage, vendor_percentage, pool_percentage, promoter_percentage } = req.query;

      // Validate percentages
      const validPct = parseInt(valid_percentage as string);
      const vendorPct = parseInt(vendor_percentage as string);
      const poolPct = parseInt(pool_percentage as string);
      const promoterPct = parseInt(promoter_percentage as string);

      if (isNaN(validPct) || isNaN(vendorPct) || isNaN(poolPct) || isNaN(promoterPct)) {
        return res.status(400).json({ detail: 'All percentages must be valid integers' });
      }

      const total = validPct + vendorPct + poolPct + promoterPct;
      if (total !== 100) {
        return res.status(400).json({
          detail: `Percentages must add up to 100. Current total: ${total}`
        });
      }

      // Get old config for audit log
      const { data: oldConfig } = await supabase
        .from('system_configs')
        .select('config_value')
        .eq('config_key', 'fee_distribution')
        .single();

      const newDistribution = {
        valid_platform_percentage: validPct,
        vendor_percentage: vendorPct,
        pool_percentage: poolPct,
        promoter_percentage: promoterPct
      };

      // Update fee distribution config
      const { error: updateError } = await supabase
        .from('system_configs')
        .upsert({
          config_key: 'fee_distribution',
          config_value: newDistribution,
          updated_by: adminUser.id
        }, { onConflict: 'config_key' });

      if (updateError) throw updateError;

      // Log admin action
      await supabase.from('audit_logs').insert({
        admin_user_id: adminUser.id,
        action: 'FEE_DISTRIBUTION_UPDATED',
        resource_type: 'platform_fee_config',
        resource_id: 'fee_distribution',
        old_value: oldConfig?.config_value || {},
        new_value: newDistribution
      });

      res.status(200).json({
        status: 'SUCCESS',
        message: 'Fee distribution updated successfully',
        distribution: {
          valid_platform: `${validPct}%`,
          vendor: `${vendorPct}%`,
          pool: `${poolPct}%`,
          promoter: `${promoterPct}%`
        }
      });
    } catch (error: any) {
      console.error('Fee distribution update error:', error);
      res.status(500).json({ detail: 'Failed to update fee distribution' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
