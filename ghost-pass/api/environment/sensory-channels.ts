import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req, res);

    res.status(200).json({
      channels: {
        qr_scan: { status: 'ACTIVE', enabled: true },
        nfc_scan: { status: 'ACTIVE', enabled: true },
        biometric: { status: 'ACTIVE', enabled: true },
        device_binding: { status: 'ACTIVE', enabled: true }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get sensory channels error:', error);
    res.status(500).json({ detail: 'Failed to fetch sensory channels' });
  }
};
