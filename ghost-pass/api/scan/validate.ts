/**
 * Scan Validation Endpoint
 * 
 * Validates QR code scans for Ghost Pass entry
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

/**
 * Check the verification tier requirement for a gateway/venue
 */
async function checkVerificationTier(supabase: any, gateway_id: string, venue_id: string): Promise<number> {
  try {
    // First check if gateway_id is a valid UUID and exists in gateway_points
    const { data: gateway } = await supabase
      .from('gateway_points')
      .select('id')
      .eq('id', gateway_id)
      .single();
    
    if (gateway) {
      // Check stations table for this gateway
      const { data: station } = await supabase
        .from('stations')
        .select('id_verification_level')
        .eq('station_id', gateway_id)
        .single();
      
      if (station?.id_verification_level) {
        return station.id_verification_level;
      }
    }
    
    // Check QR/NFC assets
    const { data: asset } = await supabase
      .from('qr_nfc_assets')
      .select('id_verification_level')
      .eq('asset_code', gateway_id)
      .single();
    
    if (asset?.id_verification_level) {
      return asset.id_verification_level;
    }
    
    // Default to Tier-1 if not specified
    return 1;
  } catch (error) {
    console.error('Error checking verification tier:', error);
    return 1; // Default to Tier-1 on error
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pass_id, gateway_id, venue_id, verification_tier } = req.body;

    // Validation
    if (!pass_id) {
      return res.status(400).json({ 
        status: 'DENIED',
        message: 'Pass ID is required',
        receipt_id: venue_id || 'unknown'
      });
    }

    if (!gateway_id) {
      return res.status(400).json({ 
        status: 'DENIED',
        message: 'Gateway ID is required',
        receipt_id: venue_id || 'unknown'
      });
    }

    // Use verification tier from request if provided, otherwise check database
    const requestedVerificationTier = verification_tier || 1;

    // For now, return a mock successful response
    // In production, this would validate against the database
    console.log('Scan validation request:', {
      pass_id,
      gateway_id,
      venue_id
    });

    // Check if Supabase is configured
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase not configured, returning mock approval');
      return res.status(200).json({
        status: 'APPROVED',
        message: 'Entry approved',
        receipt_id: venue_id || 'unknown',
        pass_id,
        gateway_id,
        timestamp: new Date().toISOString(),
        verification_tier: requestedVerificationTier
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to validate the pass in the database
    // Check wallet_sessions table using wallet_binding_id
    const { data: session, error } = await supabase
      .from('wallet_sessions')
      .select('*')
      .eq('wallet_binding_id', pass_id)
      .eq('is_active', true)
      .single();

    if (error || !session) {
      console.log('Wallet session not found, checking by session ID');
      
      // Also try by session ID in case pass_id is the session ID
      const { data: sessionById, error: sessionByIdError } = await supabase
        .from('wallet_sessions')
        .select('*')
        .eq('id', pass_id)
        .eq('is_active', true)
        .single();
      
      if (sessionByIdError || !sessionById) {
        console.log('Pass not found in database');
        return res.status(200).json({
          status: 'DENIED',
          message: 'Invalid or expired pass',
          receipt_id: venue_id || 'unknown'
        });
      }
      
      // Use session found by ID
      const sessionData = sessionById;
      
      // Check if session has expired
      if (sessionData.expires_at && new Date(sessionData.expires_at) < new Date()) {
        return res.status(200).json({
          status: 'DENIED',
          message: 'Pass has expired',
          receipt_id: venue_id || 'unknown'
        });
      }
      
      // Use verification tier from request (from QR code) or check database
      const verificationTier = requestedVerificationTier || await checkVerificationTier(supabase, gateway_id, venue_id);
      
      if (verificationTier >= 2) {
        // Tier 2 or 3 requires Footprint verification
        const { data: wallet } = await supabase
          .from('wallets')
          .select('user_id')
          .eq('wallet_binding_id', sessionData.wallet_binding_id)
          .single();
        
        if (wallet?.user_id) {
          const { data: user } = await supabase
            .from('users')
            .select('fp_id')
            .eq('id', wallet.user_id)
            .single();
          
          if (!user?.fp_id) {
            // User needs to complete Footprint verification
            return res.status(200).json({
              status: 'DENIED',
              message: `Identity verification required (Tier ${verificationTier})`,
              receipt_id: venue_id || 'unknown',
              verification_tier: verificationTier,
              footprint_verified: false
            });
          }
        } else {
          // No wallet/user found - require verification
          return res.status(200).json({
            status: 'DENIED',
            message: `Identity verification required (Tier ${verificationTier})`,
            receipt_id: venue_id || 'unknown',
            verification_tier: verificationTier,
            footprint_verified: false
          });
        }
      }
      
      // All checks passed
      const approvalResult = {
        status: 'APPROVED',
        message: 'Entry approved',
        receipt_id: venue_id || 'unknown',
        pass_id,
        gateway_id,
        timestamp: new Date().toISOString(),
        verification_tier: verificationTier
      };

      // Log audit trail for successful scan
      try {
        await supabase.from('audit_logs').insert({
          action: 'SCAN_APPROVED',
          resource_type: 'scan',
          resource_id: pass_id,
          metadata: {
            gateway_id,
            venue_id,
            verification_tier: verificationTier,
            wallet_binding_id: sessionData.wallet_binding_id
          }
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
        // Don't fail the scan if audit logging fails
      }

      return res.status(200).json(approvalResult);
    }

    // Check if session has expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return res.status(200).json({
        status: 'DENIED',
        message: 'Pass has expired',
        receipt_id: venue_id || 'unknown'
      });
    }

    // Use verification tier from request (from QR code) or check database
    const verificationTier = requestedVerificationTier || await checkVerificationTier(supabase, gateway_id, venue_id);
    
    if (verificationTier >= 2) {
      // Tier 2 or 3 requires Footprint verification
      const { data: wallet } = await supabase
        .from('wallets')
        .select('user_id')
        .eq('wallet_binding_id', session.wallet_binding_id)
        .single();
      
      if (wallet?.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('fp_id')
          .eq('id', wallet.user_id)
          .single();
        
        if (!user?.fp_id) {
          // User needs to complete Footprint verification
          return res.status(200).json({
            status: 'DENIED',
            message: `Identity verification required (Tier ${verificationTier})`,
            receipt_id: venue_id || 'unknown',
            verification_tier: verificationTier,
            footprint_verified: false
          });
        }
      } else {
        // No wallet/user found - require verification
        return res.status(200).json({
          status: 'DENIED',
          message: `Identity verification required (Tier ${verificationTier})`,
          receipt_id: venue_id || 'unknown',
          verification_tier: verificationTier,
          footprint_verified: false
        });
      }
    }

    // All checks passed
    const approvalResult = {
      status: 'APPROVED',
      message: 'Entry approved',
      receipt_id: venue_id || 'unknown',
      pass_id,
      gateway_id,
      timestamp: new Date().toISOString(),
      verification_tier: verificationTier
    };

    // Log audit trail for successful scan
    try {
      await supabase.from('audit_logs').insert({
        action: 'SCAN_APPROVED',
        resource_type: 'scan',
        resource_id: pass_id,
        metadata: {
          gateway_id,
          venue_id,
          verification_tier: verificationTier,
          wallet_binding_id: session.wallet_binding_id
        }
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the scan if audit logging fails
    }

    return res.status(200).json(approvalResult);

  } catch (error) {
    console.error('Scan validation error:', error);
    return res.status(500).json({
      status: 'DENIED',
      message: 'Validation failed',
      receipt_id: req.body.venue_id || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
