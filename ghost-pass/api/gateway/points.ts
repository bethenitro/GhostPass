import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      await requireAuth(req, res);

      const updates = req.body;

      const { data: point } = await supabase
        .from('gateway_points')
        .update(updates)
        .eq('id', id)
        .select();

      res.status(200).json(point?.[0]);
    } catch (error) {
      console.error('Update point error:', error);
      res.status(500).json({ detail: 'Failed to update point' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await requireAuth(req, res);

      await supabase
        .from('gateway_points')
        .delete()
        .eq('id', id);

      res.status(200).json({ message: 'Point deleted' });
    } catch (error) {
      console.error('Delete point error:', error);
      res.status(500).json({ detail: 'Failed to delete point' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
