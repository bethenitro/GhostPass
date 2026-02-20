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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pass_id, gateway_id, venue_id } = req.body;

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
        timestamp: new Date().toISOString()
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
      
      // All checks passed
      return res.status(200).json({
        status: 'APPROVED',
        message: 'Entry approved',
        receipt_id: venue_id || 'unknown',
        pass_id,
        gateway_id,
        timestamp: new Date().toISOString()
      });
    }

    // Check if session has expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return res.status(200).json({
        status: 'DENIED',
        message: 'Pass has expired',
        receipt_id: venue_id || 'unknown'
      });
    }

    // All checks passed
    return res.status(200).json({
      status: 'APPROVED',
      message: 'Entry approved',
      receipt_id: venue_id || 'unknown',
      pass_id,
      gateway_id,
      timestamp: new Date().toISOString()
    });

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
