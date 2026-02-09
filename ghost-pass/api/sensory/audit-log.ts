import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req, res);

    const { signal_id, sensory_type, timestamp, outcome, metadata } = req.body;

    const { data: log } = await supabase
      .from('sensory_audit_logs')
      .insert({
        signal_id,
        sensory_type,
        timestamp,
        outcome,
        metadata,
        created_at: new Date().toISOString()
      })
      .select();

    res.status(201).json(log?.[0]);
  } catch (error) {
    console.error('Log audit entry error:', error);
    res.status(500).json({ detail: 'Failed to log audit entry' });
  }
};
