import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabase } from '../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gateway_point_id, metric_type, amount_cents, metadata } = req.body;

    // Verify gateway point exists
    const { data: gateway } = await supabase
      .from('gateway_points')
      .select('id, type')
      .eq('id', gateway_point_id)
      .single();

    if (!gateway) {
      return res.status(404).json({ detail: 'Gateway point not found' });
    }

    // Call the database function to record metric
    const { data, error } = await supabase.rpc('record_gateway_metric', {
      p_gateway_point_id: gateway_point_id,
      p_metric_type: metric_type,
      p_amount_cents: amount_cents || null,
      p_metadata: metadata || {}
    });

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      metric_id: data,
      message: 'Metric recorded successfully'
    });
  } catch (error) {
    console.error('Record metric error:', error);
    res.status(500).json({ detail: 'Failed to record metric' });
  }
};
