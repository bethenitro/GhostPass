import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { proof_type, proof_data } = req.body;

    const proofId = uuidv4();
    const { data: proofInsert } = await supabase
      .from('cryptographic_proofs')
      .insert({
        id: proofId,
        user_id: user.id,
        proof_type,
        proof_value: JSON.stringify(proof_data),
        verified: false,
        created_at: new Date().toISOString()
      })
      .select();

    if (!proofInsert) {
      return res.status(500).json({ detail: 'Failed to create proof' });
    }

    res.status(200).json({
      status: 'SUCCESS',
      proof_id: proofId,
      message: 'Proof created successfully'
    });
  } catch (error) {
    console.error('Create proof error:', error);
    res.status(500).json({ detail: 'Failed to create proof' });
  }
};
