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
    const user = await requireAuth(req, res);
    if (!user) return;

    const { data: proofs } = await supabase
      .from('cryptographic_proofs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    res.status(200).json({
      proofs: proofs || []
    });
  } catch (error) {
    console.error('Get proofs error:', error);
    res.status(500).json({ detail: 'Failed to get proofs' });
  }
};
