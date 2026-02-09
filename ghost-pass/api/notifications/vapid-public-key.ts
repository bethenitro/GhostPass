/**
 * VAPID Public Key Endpoint
 * 
 * Returns the VAPID public key for push notification subscription.
 * This is needed by the client to subscribe to push notifications.
 * 
 * GET /api/notifications/vapid-public-key
 * 
 * Response:
 * - public_key: string
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';

    if (!publicKey) {
      return res.status(500).json({ 
        error: 'VAPID public key not configured' 
      });
    }

    res.status(200).json({
      public_key: publicKey
    });

  } catch (error) {
    console.error('VAPID key fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch VAPID public key',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
