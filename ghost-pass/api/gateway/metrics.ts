import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req, res);

    const { pointId } = req.query;

    if (pointId) {
      const { data: metrics } = await supabase
        .from('gateway_metrics')
        .select('*')
        .eq('gateway_point_id', pointId)
        .order('created_at', { ascending: false });

      res.status(200).json(metrics || []);
    } else {
      const { data: metrics } = await supabase
        .from('gateway_metrics')
        .select('*')
        .order('created_at', { ascending: false });

      res.status(200).json(metrics || []);
    }
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ detail: 'Failed to fetch metrics' });
  }
};
