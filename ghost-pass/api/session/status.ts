import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return; // requireAuth already sent the error response

    return res.status(200).json({
      session: {
        session_id: 'current_session',
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    if (res.headersSent) return;
    console.error('Session status error:', error);
    return res.status(500).json({ detail: 'Failed to get session status' });
  }
};
