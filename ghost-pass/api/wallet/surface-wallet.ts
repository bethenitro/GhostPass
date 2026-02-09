/**
 * Wallet Surface Endpoint
 * 
 * Handles automatic wallet surfacing after first successful scan.
 * Implements "boarding pass mode" for instant wallet access.
 * 
 * POST /api/wallet/surface-wallet
 * 
 * Request Body:
 * - wallet_binding_id: string
 * - device_fingerprint: string
 * - event_id?: string
 * - venue_id?: string
 * - event_name?: string
 * - venue_name?: string
 * 
 * Response:
 * - status: 'FIRST_SCAN_SUCCESS' | 'RETURNING_ACCESS'
 * - wallet_access: WalletSession object
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface WalletSession {
  session_id: string;
  wallet_binding_id: string;
  force_surface: boolean;
  expires_at: string;
  pwa_manifest: any;
  install_prompt: {
    show: boolean;
    title: string;
    message: string;
    install_button_text: string;
    skip_button_text: string;
  };
  brightness_control: {
    enabled: boolean;
    qr_brightness_level: number;
    restore_on_close: boolean;
  };
  wallet_url: string;
  boarding_pass_mode: boolean;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const {
      wallet_binding_id,
      device_fingerprint,
      event_id,
      venue_id,
      event_name = 'Event',
      venue_name = 'Venue'
    } = req.body;

    if (!wallet_binding_id || !device_fingerprint) {
      return res.status(400).json({ 
        error: 'Missing required fields: wallet_binding_id, device_fingerprint' 
      });
    }

    // Check if this is a first-time scan or returning user
    const { data: existingSessions } = await supabase
      .from('wallet_sessions')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const isFirstScan = !existingSessions || existingSessions.length === 0;
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Create wallet session
    const walletSession: WalletSession = {
      session_id: sessionId,
      wallet_binding_id,
      force_surface: isFirstScan, // Force surface only on first scan
      expires_at: expiresAt,
      pwa_manifest: {
        name: `${event_name} - Ghost Pass`,
        short_name: event_name,
        description: `Your ${event_name} wallet at ${venue_name}`,
        start_url: '/',
        display: 'standalone',
        theme_color: '#06b6d4',
        background_color: '#0f172a'
      },
      install_prompt: {
        show: isFirstScan, // Only show install prompt on first scan
        title: `${event_name} - Ghost Pass Wallet`,
        message: `Keep your ${event_name} wallet instantly accessible throughout the event`,
        install_button_text: 'Add to Home Screen',
        skip_button_text: 'Not Now'
      },
      brightness_control: {
        enabled: true,
        qr_brightness_level: 150,
        restore_on_close: true
      },
      wallet_url: process.env.WALLET_URL || 'https://ghostpass.app',
      boarding_pass_mode: true
    };

    // Store session in database
    await supabase
      .from('wallet_sessions')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        wallet_binding_id,
        device_fingerprint,
        event_id,
        venue_id,
        event_name,
        venue_name,
        expires_at: expiresAt,
        is_first_scan: isFirstScan,
        boarding_pass_mode: true,
        created_at: new Date().toISOString()
      });

    // Log wallet surface event
    await supabase
      .from('wallet_surface_logs')
      .insert({
        user_id: user.id,
        wallet_binding_id,
        device_fingerprint,
        event_id,
        venue_id,
        is_first_scan: isFirstScan,
        session_id: sessionId,
        surfaced_at: new Date().toISOString()
      });

    res.status(200).json({
      status: isFirstScan ? 'FIRST_SCAN_SUCCESS' : 'RETURNING_ACCESS',
      wallet_access: walletSession,
      message: isFirstScan 
        ? 'Wallet surfaced successfully - boarding pass mode activated'
        : 'Welcome back! Your wallet is ready'
    });

  } catch (error) {
    console.error('Wallet surface error:', error);
    res.status(500).json({ 
      error: 'Failed to surface wallet',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
