/**
 * Anonymous Wallet Surface Endpoint
 * 
 * Creates or retrieves a wallet for anonymous users (fast entry flow)
 * No authentication required - wallet is bound to device fingerprint
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';
import crypto from 'crypto';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

// Generate a secure recovery code
function generateRecoveryCode(): string {
  // Generate 6 groups of 4 characters (24 chars total)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 5) code += '-';
  }
  return code;
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
    const {
      device_fingerprint,
      venue_id,
      event_name,
      venue_name,
      entry_fee_cents = 500
    } = req.body;

    if (!device_fingerprint) {
      return res.status(400).json({ error: 'device_fingerprint is required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if wallet already exists for this device
    const { data: existingWallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', device_fingerprint)
      .single();

    let wallet = existingWallet;
    let walletBindingId = existingWallet?.wallet_binding_id;

    // Create new wallet if doesn't exist
    if (!existingWallet || walletError) {
      // Use proper UUID for wallet binding ID so it's scanner-compatible
      walletBindingId = randomUUID();
      
      // Generate recovery code
      const recoveryCode = generateRecoveryCode();
      const recoveryCodeHash = crypto
        .createHash('sha256')
        .update(recoveryCode)
        .digest('hex');
      
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          device_fingerprint,
          wallet_binding_id: walletBindingId,
          balance_cents: 0,
          device_bound: true,
          wallet_surfaced: true,
          pwa_installed: false,
          entry_count: 0,
          recovery_code_hash: recoveryCodeHash,
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create wallet:', createError);
        return res.status(500).json({ error: 'Failed to create wallet' });
      }

      wallet = newWallet;
      
      // Create wallet session for new wallet - use UUID for session ID
      const sessionId = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

      await supabase
        .from('wallet_sessions')
        .insert({
          id: sessionId,
          wallet_binding_id: walletBindingId,
          device_fingerprint,
          created_at: new Date().toISOString(),
          last_accessed: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          event_id: event_name || 'default_event',
          venue_id: venue_id || 'default_venue',
          is_active: true,
          force_surface: true,
          session_data: {
            fast_entry: true,
            venue_name,
            event_name,
            entry_fee_cents
          }
        });

      const sessionData = {
        session_id: sessionId,
        wallet_binding_id: walletBindingId,
        device_fingerprint,
        expires_at: expiresAt.toISOString(),
        fast_entry: true,
        venue_id: venue_id || 'default_venue',
        venue_name,
        event_name,
        entry_fee: entry_fee_cents
      };
      
      // Return recovery code only on wallet creation
      return res.status(200).json({
        success: true,
        wallet: {
          id: wallet.id,
          wallet_binding_id: walletBindingId,
          balance_cents: wallet.balance_cents || 0,
          device_bound: true,
        },
        session: sessionData,
        recovery_code: recoveryCode, // IMPORTANT: Only returned once on creation
        message: 'Wallet created successfully. Save your recovery code!',
      });
    }

    // Create or update wallet session for existing wallet - use UUID for session ID
    const sessionId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

    const { error: sessionError } = await supabase
      .from('wallet_sessions')
      .upsert({
        id: sessionId,
        wallet_binding_id: walletBindingId,
        device_fingerprint,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        event_id: event_name || 'default_event',
        venue_id: venue_id || 'default_venue',
        is_active: true,
        force_surface: true,
        session_data: {
          fast_entry: true,
          venue_name,
          event_name,
          entry_fee_cents
        }
      }, {
        onConflict: 'wallet_binding_id,device_fingerprint'
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      // Continue anyway - wallet was created
    }

    // Store session in response for client-side persistence
    const sessionData = {
      session_id: sessionId,
      wallet_binding_id: walletBindingId,
      device_fingerprint,
      expires_at: expiresAt.toISOString(),
      fast_entry: true,
      venue_id: venue_id || 'default_venue',
      venue_name,
      event_name,
      entry_fee: entry_fee_cents
    };

    return res.status(200).json({
      success: true,
      wallet: {
        id: wallet.id,
        wallet_binding_id: walletBindingId,
        balance_cents: wallet.balance_cents || 0,
        device_bound: true
      },
      session: sessionData,
      message: 'Wallet surfaced successfully'
    });

  } catch (error) {
    console.error('Anonymous wallet surface error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
