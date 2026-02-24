import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

/**
 * Create a Footprint onboarding session token
 * POST /api/footprint/create-session
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_external_id, playbook_key, wallet_binding_id, device_fingerprint } = req.body;

    // For anonymous users, use wallet_binding_id or device_fingerprint as external ID
    const externalId = user_external_id || wallet_binding_id || device_fingerprint || `anon_${Date.now()}`;

    // Get Footprint API key from environment
    const footprintApiKey = process.env.FOOTPRINT_SECRET_KEY;
    if (!footprintApiKey) {
      return res.status(500).json({ error: 'Footprint API key not configured' });
    }

    // Use default playbook key if not provided
    const playbookKey = playbook_key || process.env.FOOTPRINT_PLAYBOOK_KEY;
    if (!playbookKey) {
      return res.status(400).json({ error: 'Playbook key required' });
    }

    // Create onboarding session token via Footprint API
    const response = await fetch('https://api.onefootprint.com/onboarding/session', {
      method: 'POST',
      headers: {
        'X-Footprint-Secret-Key': footprintApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'onboard',
        key: playbookKey,
        user_external_id: externalId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Footprint API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to create Footprint session',
        details: errorData 
      });
    }

    const sessionData = await response.json() as {
      token: string;
      link: string;
      expires_at: string;
    };

    return res.status(200).json({
      success: true,
      token: sessionData.token,
      link: sessionData.link,
      expires_at: sessionData.expires_at,
    });
  } catch (error: any) {
    console.error('Error creating Footprint session:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
