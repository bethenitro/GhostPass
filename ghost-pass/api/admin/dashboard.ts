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
  if (!adminUser) return; // Response already sent by requireAdmin

  try {
    // Check if admin tables exist first
    try {
      await supabase.from('audit_logs').select('id').limit(1);
    } catch (error) {
      return res.status(503).json({
        detail: 'Admin tables not found. Please run admin_schema.sql in Supabase Dashboard first.'
      });
    }

    // Get system statistics
    const { count: usersCount } = await supabase.from('users').select('id', { count: 'exact', head: true });
    const { count: walletsCount } = await supabase.from('wallets').select('id', { count: 'exact', head: true });

    // Get total balance across all wallets
    let totalBalance = 0;
    try {
      const { data: walletsData } = await supabase.from('wallets').select('balance_cents');
      totalBalance = (walletsData || []).reduce((sum, w) => sum + (w.balance_cents || 0), 0);
    } catch (error) {
      console.warn('Error calculating total balance:', error);
    }

    // Get pass statistics based on expires_at timestamp
    const nowIso = new Date().toISOString();
    const { count: activePasses } = await supabase
      .from('ghost_passes')
      .select('id', { count: 'exact', head: true })
      .gte('expires_at', nowIso);

    const { count: expiredPasses } = await supabase
      .from('ghost_passes')
      .select('id', { count: 'exact', head: true })
      .lt('expires_at', nowIso);

    // Get payout statistics
    const { count: pendingPayouts } = await supabase
      .from('payout_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // Get transaction count
    const { count: transactionsCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true });

    // Get total scans from entry events
    const { count: totalScans } = await supabase
      .from('entry_events')
      .select('id', { count: 'exact', head: true });

    // Get initial vs re-entry counts
    const { count: initialEntries } = await supabase
      .from('entry_events')
      .select('id', { count: 'exact', head: true })
      .eq('entry_type', 'initial');

    const { count: reentries } = await supabase
      .from('entry_events')
      .select('id', { count: 'exact', head: true })
      .eq('entry_type', 're_entry');

    // Get revenue statistics (last 24h, 7d, 30d)
    const now = new Date();
    const today = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: revenueToday } = await supabase
      .from('transactions')
      .select('amount_cents')
      .eq('type', 'SPEND')
      .gte('timestamp', today);

    const { data: revenueWeek } = await supabase
      .from('transactions')
      .select('amount_cents')
      .eq('type', 'SPEND')
      .gte('timestamp', weekAgo);

    const { data: revenueMonth } = await supabase
      .from('transactions')
      .select('amount_cents')
      .eq('type', 'SPEND')
      .gte('timestamp', monthAgo);

    const revenueTodayCents = (revenueToday || []).reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);
    const revenueWeekCents = (revenueWeek || []).reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);
    const revenueMonthCents = (revenueMonth || []).reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);

    const stats = {
      total_users: usersCount || 0,
      total_wallets: walletsCount || 0,
      total_balance_cents: totalBalance,
      active_passes: activePasses || 0,
      expired_passes: expiredPasses || 0,
      pending_payouts: pendingPayouts || 0,
      total_transactions: transactionsCount || 0,
      total_scans: totalScans || 0,
      initial_entries: initialEntries || 0,
      reentries: reentries || 0,
      revenue_today_cents: revenueTodayCents,
      revenue_week_cents: revenueWeekCents,
      revenue_month_cents: revenueMonthCents
    };

    // Get recent transactions (last 10)
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    // Get pending payouts with vendor info
    const { data: pendingPayoutsData } = await supabase
      .from('payout_requests')
      .select('id, vendor_user_id, amount_cents, status, requested_at, processed_at, processed_by, notes')
      .eq('status', 'PENDING')
      .order('requested_at', { ascending: false })
      .limit(10);

    const pendingPayoutsList = await Promise.all(
      (pendingPayoutsData || []).map(async (payout) => {
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
          return {
            ...payout,
            vendor_email: 'Unknown'
          };
        }
      })
    );

    // Get recent audit logs
    const { data: recentAuditData } = await supabase
      .from('audit_logs')
      .select('id, admin_user_id, action, resource_type, resource_id, old_value, new_value, timestamp, metadata')
      .order('timestamp', { ascending: false })
      .limit(10);

    const recentAuditLogs = await Promise.all(
      (recentAuditData || []).map(async (log) => {
        try {
          const { data: adminData } = await supabase
            .from('users')
            .select('email')
            .eq('id', log.admin_user_id)
            .single();

          return {
            ...log,
            admin_email: adminData?.email || 'Unknown'
          };
        } catch (error) {
          return {
            ...log,
            admin_email: 'Unknown'
          };
        }
      })
    );

    // Get current configurations - ensure defaults exist in database
    let currentFeeConfig;
    try {
      const { data: feeConfigData } = await supabase
        .from('fee_configs')
        .select('*')
        .eq('venue_id', 'default')
        .single();

      if (!feeConfigData) {
        const defaultFeeConfig = {
          venue_id: 'default',
          valid_pct: 30.0,
          vendor_pct: 30.0,
          pool_pct: 30.0,
          promoter_pct: 10.0
        };
        await supabase.from('fee_configs').insert(defaultFeeConfig);
        currentFeeConfig = defaultFeeConfig;
      } else {
        currentFeeConfig = feeConfigData;
      }
    } catch (error) {
      console.warn('Error fetching fee config:', error);
      currentFeeConfig = {
        valid_pct: 30.0,
        vendor_pct: 30.0,
        pool_pct: 30.0,
        promoter_pct: 10.0
      };
    }

    let currentScanFees;
    try {
      const { data: scanFeesData } = await supabase
        .from('system_configs')
        .select('*')
        .eq('config_key', 'scan_fees')
        .single();

      if (!scanFeesData) {
        const defaultScanFees = { default: 10 };
        await supabase.from('system_configs').insert({
          config_key: 'scan_fees',
          config_value: defaultScanFees
        });
        currentScanFees = defaultScanFees;
      } else {
        currentScanFees = scanFeesData.config_value;
      }
    } catch (error) {
      console.warn('Error fetching scan fees:', error);
      currentScanFees = { default: 10 };
    }

    let currentPricing;
    try {
      const { data: pricingData } = await supabase
        .from('system_configs')
        .select('*')
        .eq('config_key', 'ghostpass_pricing')
        .single();

      if (!pricingData) {
        const defaultPricing = { '1': 1000, '3': 2000, '5': 3500, '7': 5000, '10': 6500, '14': 8500, '30': 10000 };
        await supabase.from('system_configs').insert({
          config_key: 'ghostpass_pricing',
          config_value: defaultPricing
        });
        currentPricing = defaultPricing;
      } else {
        currentPricing = pricingData.config_value;
      }
    } catch (error) {
      console.warn('Error fetching pricing:', error);
      currentPricing = { '1': 1000, '3': 2000, '5': 3500, '7': 5000, '10': 6500, '14': 8500, '30': 10000 };
    }

    let currentRetention;
    try {
      const { data: retentionData } = await supabase
        .from('system_configs')
        .select('*')
        .eq('config_key', 'data_retention')
        .single();

      if (!retentionData) {
        const defaultRetention = { retention_days: 60 };
        await supabase.from('system_configs').insert({
          config_key: 'data_retention',
          config_value: defaultRetention
        });
        currentRetention = defaultRetention;
      } else {
        currentRetention = retentionData.config_value;
      }
    } catch (error) {
      console.warn('Error fetching retention:', error);
      currentRetention = { retention_days: 60 };
    }

    res.status(200).json({
      stats,
      recent_transactions: recentTransactions || [],
      pending_payouts: pendingPayoutsList,
      recent_audit_logs: recentAuditLogs,
      current_fee_config: currentFeeConfig,
      current_scan_fees: currentScanFees,
      current_pricing: currentPricing,
      current_retention: currentRetention
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ detail: 'Failed to load admin dashboard' });
  }
};
