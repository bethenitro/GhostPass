import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { ghost_pass_token, reason = 'Manual revocation' } = req.body;

    const { data: updated } = await supabase
      .from('ghost_passes')
      .update({
        status: 'REVOKED',
        revocation_reason: reason,
        revoked_at: new Date().toISOString()
      })
      .eq('id', ghost_pass_token)
      .eq('user_id', user.id)
      .select();

    if (!updated || updated.length === 0) {
      return res.status(404).json({ detail: 'Ghost pass not found' });
    }

    res.status(200).json({
      status: 'revoked',
      pass_id: ghost_pass_token,
      message: 'Ghost pass revoked successfully'
    });
  } catch (error) {
    console.error('Ghost pass revocation error:', error);
    res.status(500).json({ detail: 'Revocation failed' });
  }
};
