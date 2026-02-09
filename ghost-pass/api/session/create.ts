import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { v4 as uuidv4 } from 'uuid';

const sessionDurations: Record<string, number> = {
  '30_seconds': 30,
  '3_minutes': 180,
  '10_minutes': 600
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { session_type } = req.body;

    if (!sessionDurations[session_type]) {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    const sessionId = uuidv4();
    const durationSeconds = sessionDurations[session_type];
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

    res.status(200).json({
      session: {
        session_id: sessionId,
        session_type,
        duration_seconds: durationSeconds,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ detail: 'Failed to create session' });
  }
};
