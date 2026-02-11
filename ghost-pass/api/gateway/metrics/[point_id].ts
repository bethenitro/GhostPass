import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabase } from '../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { point_id } = req.query;

    // Call the database function to get real-time metrics
    const { data, error } = await supabase.rpc('get_gateway_realtime_metrics', {
      p_gateway_point_id: point_id
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ detail: 'Gateway point not found' });
    }

    const metricsData = data[0];

    res.status(200).json({
      gateway_point_id: metricsData.gateway_point_id,
      gateway_name: metricsData.gateway_name,
      gateway_type: metricsData.gateway_type,
      gateway_status: metricsData.gateway_status,
      total_qr_scans: metricsData.total_qr_scans || 0,
      last_qr_scan: metricsData.last_qr_scan || null,
      qr_scans_last_hour: metricsData.qr_scans_last_hour || 0,
      qr_scans_today: metricsData.qr_scans_today || 0,
      total_transactions: metricsData.total_transactions || 0,
      last_transaction: metricsData.last_transaction || null,
      transactions_last_hour: metricsData.transactions_last_hour || 0,
      transactions_today: metricsData.transactions_today || 0,
      total_sales_cents: metricsData.total_sales_cents || 0,
      sales_last_hour_cents: metricsData.sales_last_hour_cents || 0,
      sales_today_cents: metricsData.sales_today_cents || 0
    });
  } catch (error) {
    console.error('Get gateway metrics error:', error);
    res.status(500).json({ detail: 'Failed to fetch gateway metrics' });
  }
};
