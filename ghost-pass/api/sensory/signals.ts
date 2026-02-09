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

    const limit = parseInt((req.query.limit as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');

    const { data: signals } = await supabase
      .from('sensory_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    res.status(200).json(signals || []);
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({ detail: 'Failed to fetch signals' });
  }
};
