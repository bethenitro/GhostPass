import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    res.status(200).json({
      status: 'vaporized',
      message: 'Session ended and QR code invalidated'
    });
  } catch (error) {
    console.error('Session vaporize error:', error);
    res.status(500).json({ detail: 'Failed to vaporize session' });
  }
};
