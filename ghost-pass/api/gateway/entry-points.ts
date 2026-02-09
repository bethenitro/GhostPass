import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    try {
      await requireAuth(req, res);

      const { data: points } = await supabase
        .from('gateway_points')
        .select('*')
        .eq('type', 'ENTRY_POINT')
        .order('created_at', { ascending: false });

      res.status(200).json(points || []);
    } catch (error) {
      console.error('Get entry points error:', error);
      res.status(500).json({ detail: 'Failed to fetch entry points' });
    }
  } else if (req.method === 'POST') {
    try {
      await requireAuth(req, res);

      const { name, status, employee_name, employee_id, visual_identifier } = req.body;

      const { data: point } = await supabase
        .from('gateway_points')
        .insert({
          type: 'ENTRY_POINT',
          name,
          status,
          employee_name,
          employee_id,
          visual_identifier
        })
        .select();

      res.status(201).json(point?.[0]);
    } catch (error) {
      console.error('Create entry point error:', error);
      res.status(500).json({ detail: 'Failed to create entry point' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
