/**
 * Check Context Mode API
 * 
 * Determines which mode applies for a given context/venue:
 * - Mode A (Pay-per-scan): No pass required, charge per scan
 * - Mode B (Event/Festival): Pass purchase required before entry
 * 
 * Based on backend/routes/ghost_pass_modes.py implementation
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

// Context mode configuration
const CONTEXT_MODES: Record<string, any> = {
  default: {
    pass_required: false,
    per_scan_fee_cents: 25,
    pass_options: [],
  },
  club: {
    pass_required: false,
    per_scan_fee_cents: 50,
    pass_options: [],
  },
  bar: {
    pass_required: false,
    per_scan_fee_cents: 25,
    pass_options: [],
  },
  event: {
    pass_required: true,
    per_scan_fee_cents: 0,
    pass_options: [
      {
        id: '1day',
        name: '1-Day Pass',
        price_cents: 2500,
        duration_hours: 24,
        includes: ['entry', 'vendors'],
      },
      {
        id: '3day',
        name: '3-Day Pass',
        price_cents: 6000,
        duration_hours: 72,
        includes: ['entry', 'vendors', 'vip_areas'],
      },
      {
        id: 'weekend',
        name: 'Weekend Pass',
        price_cents: 4500,
        duration_hours: 48,
        includes: ['entry', 'vendors'],
      },
    ],
  },
  festival: {
    pass_required: true,
    per_scan_fee_cents: 0,
    pass_options: [
      {
        id: 'single_day',
        name: 'Single Day',
        price_cents: 7500,
        duration_hours: 16,
        includes: ['entry', 'vendors', 'stages'],
      },
      {
        id: 'full_festival',
        name: 'Full Festival Pass',
        price_cents: 20000,
        duration_hours: 96,
        includes: ['entry', 'vendors', 'stages', 'vip_areas', 'camping'],
      },
    ],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { context, wallet_binding_id, ghost_pass_token } = req.body;

    if (!context || !wallet_binding_id) {
      return res.status(400).json({
        error: 'Missing required fields: context, wallet_binding_id',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get context configuration
    const modeConfig = CONTEXT_MODES[context] || CONTEXT_MODES.default;
    const mode = modeConfig.pass_required ? 'event' : 'pay_per_scan';

    // Check if pass required
    if (!modeConfig.pass_required) {
      // Mode A: Pay-per-scan - always allowed, just charge per scan
      return res.status(200).json({
        context,
        mode: 'pay_per_scan',
        access_granted: true,
        requires_payment: true,
        requires_pass_purchase: false,
        payment_amount_cents: modeConfig.per_scan_fee_cents,
        payment_description: `Per-scan fee for ${context}`,
        pass_options: [],
        context_info: {
          context,
          pass_required: false,
          per_scan_fee_cents: modeConfig.per_scan_fee_cents,
          pass_options: [],
          mode: 'pay_per_scan',
        },
      });
    }

    // Mode B: Event mode - check for valid pass
    if (!ghost_pass_token) {
      return res.status(200).json({
        context,
        mode: 'event',
        access_granted: false,
        requires_payment: false,
        requires_pass_purchase: true,
        pass_options: modeConfig.pass_options,
        message: 'Ghost Pass required for this venue',
        context_info: {
          context,
          pass_required: true,
          per_scan_fee_cents: 0,
          pass_options: modeConfig.pass_options,
          mode: 'event',
        },
      });
    }

    // Validate Ghost Pass token
    const { data: ghostPass, error: passError } = await supabase
      .from('ghost_passes')
      .select('*')
      .eq('id', ghost_pass_token)
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (passError || !ghostPass) {
      return res.status(200).json({
        context,
        mode: 'event',
        access_granted: false,
        requires_payment: false,
        requires_pass_purchase: true,
        pass_options: modeConfig.pass_options,
        message: 'Invalid or expired Ghost Pass',
        context_info: {
          context,
          pass_required: true,
          per_scan_fee_cents: 0,
          pass_options: modeConfig.pass_options,
          mode: 'event',
        },
      });
    }

    // Check if pass is active and not expired
    if (ghostPass.status !== 'ACTIVE') {
      return res.status(200).json({
        context,
        mode: 'event',
        access_granted: false,
        requires_payment: false,
        requires_pass_purchase: true,
        pass_options: modeConfig.pass_options,
        message: `Ghost Pass is ${ghostPass.status}`,
        context_info: {
          context,
          pass_required: true,
          per_scan_fee_cents: 0,
          pass_options: modeConfig.pass_options,
          mode: 'event',
        },
      });
    }

    const now = new Date();
    const expiresAt = new Date(ghostPass.expires_at);

    if (now > expiresAt) {
      return res.status(200).json({
        context,
        mode: 'event',
        access_granted: false,
        requires_payment: false,
        requires_pass_purchase: true,
        pass_options: modeConfig.pass_options,
        message: 'Ghost Pass has expired',
        context_info: {
          context,
          pass_required: true,
          per_scan_fee_cents: 0,
          pass_options: modeConfig.pass_options,
          mode: 'event',
        },
      });
    }

    // Pass is valid - grant access
    return res.status(200).json({
      context,
      mode: 'event',
      access_granted: true,
      requires_payment: false,
      requires_pass_purchase: false,
      pass_info: {
        token: ghostPass.id,
        type: 'event_pass',
        expires_at: ghostPass.expires_at,
        duration_days: ghostPass.duration_days,
        wallet_binding_id: ghostPass.wallet_binding_id,
      },
      context_info: {
        context,
        pass_required: true,
        per_scan_fee_cents: 0,
        pass_options: modeConfig.pass_options,
        mode: 'event',
      },
    });
  } catch (error) {
    console.error('Context check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
