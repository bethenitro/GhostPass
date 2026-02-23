import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

/**
 * Validate Footprint onboarding session and store fp_id
 * POST /api/footprint/validate-session
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) {
      return; // Response already sent by requireAuth
    }

    const { validation_token } = req.body;

    if (!validation_token) {
      return res.status(400).json({ error: 'Validation token required' });
    }

    // Get Footprint API key from environment
    const footprintApiKey = process.env.FOOTPRINT_SECRET_KEY;
    if (!footprintApiKey) {
      return res.status(500).json({ error: 'Footprint API key not configured' });
    }

    // Validate the token with Footprint API
    const response = await fetch('https://api.onefootprint.com/onboarding/session/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(footprintApiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        validation_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Footprint validation error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to validate Footprint session',
        details: errorData 
      });
    }

    const validationData = await response.json() as {
      user?: {
        fp_id: string;
        status: string;
        requires_manual_review: boolean;
        onboarding_id: string;
      };
    };

    // Extract fp_id and verification status
    const fp_id = validationData.user?.fp_id;
    const status = validationData.user?.status;
    const requires_manual_review = validationData.user?.requires_manual_review;
    const onboarding_id = validationData.user?.onboarding_id;

    if (!fp_id) {
      return res.status(400).json({ error: 'No fp_id returned from Footprint' });
    }

    // Update user record with fp_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ fp_id })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user with fp_id:', updateError);
      return res.status(500).json({ error: 'Failed to store verification data' });
    }

    return res.status(200).json({
      success: true,
      fp_id,
      status,
      requires_manual_review,
      onboarding_id,
      verified: status === 'pass' && !requires_manual_review,
    });
  } catch (error: any) {
    console.error('Error validating Footprint session:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
