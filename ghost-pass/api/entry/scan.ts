/**
 * Entry Scan Endpoint (Device Fingerprint Auth)
 * 
 * Processes venue entry/re-entry with device fingerprint authentication.
 * Automatically tracks entry count and applies appropriate fees:
 * - Initial entry: venue initial_entry_fee_cents
 * - Re-entry: venue_reentry_fee_cents + valid_reentry_scan_fee_cents (25 cents)
 * 
 * POST /api/entry/scan
 * 
 * Request Body:
 * - wallet_binding_id: string
 * - venue_id: string
 * - gateway_id: string (UUID)
 * - interaction_method: 'QR' | 'NFC' (default: 'QR')
 * 
 * Response:
 * - success: boolean
 * - entry_type: 'initial' | 're_entry'
 * - entry_number: number
 * - fees: { initial_entry_fee_cents, venue_reentry_fee_cents, valid_reentry_scan_fee_cents, total_fees_cents }
 * - balance_after_cents: number
 * - receipt_id: string
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

interface EntryFees {
  initial_entry_fee_cents: number;
  venue_reentry_fee_cents: number;
  valid_reentry_scan_fee_cents: number;
  total_fees_cents: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      wallet_binding_id,
      venue_id,
      gateway_id,
      interaction_method = 'QR',
    } = req.body;

    // Get device fingerprint from header
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

    if (!wallet_binding_id || !venue_id || !gateway_id) {
      return res.status(400).json({
        error: 'Missing required fields: wallet_binding_id, venue_id, gateway_id',
      });
    }

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Get venue entry configuration
    const { data: venueConfig } = await supabase
      .from('venue_entry_configs')
      .select('*')
      .eq('venue_id', venue_id)
      .maybeSingle();

    // Get gateway info
    const { data: gateway } = await supabase
      .from('gateway_points')
      .select('*')
      .eq('id', gateway_id)
      .single();

    if (!gateway) {
      return res.status(404).json({ error: 'Gateway not found' });
    }

    // Check previous entries for this wallet at this venue
    const { data: previousEntries } = await supabase
      .from('entry_events')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('venue_id', venue_id)
      .order('timestamp', { ascending: false });

    const isInitialEntry = !previousEntries || previousEntries.length === 0;
    const entryNumber = (previousEntries?.length || 0) + 1;

    // Calculate fees based on entry type
    const fees: EntryFees = {
      initial_entry_fee_cents: 0,
      venue_reentry_fee_cents: 0,
      valid_reentry_scan_fee_cents: 0,
      total_fees_cents: 0,
    };

    if (isInitialEntry) {
      // Initial entry
      fees.initial_entry_fee_cents = venueConfig?.initial_entry_fee_cents || 2500; // Default $25
    } else {
      // Re-entry
      fees.venue_reentry_fee_cents = venueConfig?.venue_reentry_fee_cents || 0;
      fees.valid_reentry_scan_fee_cents = venueConfig?.valid_reentry_scan_fee_cents || 25; // Default 25 cents
    }

    fees.total_fees_cents =
      fees.initial_entry_fee_cents +
      fees.venue_reentry_fee_cents +
      fees.valid_reentry_scan_fee_cents;

    // Check if re-entry is allowed
    if (!isInitialEntry && venueConfig && !venueConfig.re_entry_allowed) {
      return res.status(403).json({
        success: false,
        error: 'Re-entry not allowed at this venue',
        entry_type: 're_entry',
        entry_number: entryNumber,
      });
    }

    // Check wallet balance
    if (wallet.balance_cents < fees.total_fees_cents) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient balance',
        entry_type: isInitialEntry ? 'initial' : 're_entry',
        entry_number: entryNumber,
        required_cents: fees.total_fees_cents,
        current_balance_cents: wallet.balance_cents,
      });
    }

    // Deduct fees from wallet
    const newBalance = wallet.balance_cents - fees.total_fees_cents;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance_cents: newBalance,
        last_entry_at: new Date().toISOString(),
        entry_count: wallet.entry_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_binding_id', wallet_binding_id);

    if (updateError) {
      console.error('Wallet update error:', updateError);
      return res.status(500).json({
        error: 'Failed to update wallet balance',
        details: updateError.message,
      });
    }

    // Create entry event
    const receiptId = uuidv4();
    const entryId = `entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const { error: entryError } = await supabase.from('entry_events').insert({
      id: entryId,
      wallet_id: wallet.id,
      wallet_binding_id,
      venue_id,
      gateway_id,
      gateway_name: gateway.name,
      entry_number: entryNumber,
      entry_type: isInitialEntry ? 'initial' : 're_entry',
      initial_entry_fee_cents: fees.initial_entry_fee_cents,
      venue_reentry_fee_cents: fees.venue_reentry_fee_cents,
      valid_reentry_scan_fee_cents: fees.valid_reentry_scan_fee_cents,
      total_fees_cents: fees.total_fees_cents,
      device_fingerprint: deviceFingerprint,
      interaction_method,
      receipt_id: receiptId,
      status: 'APPROVED',
      timestamp: new Date().toISOString(),
    });

    if (entryError) {
      console.error('Entry event insert error:', entryError);
      // Don't fail the whole request if entry logging fails
    }

    // Record transaction
    const { error: txError } = await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'SPEND',
      amount_cents: fees.total_fees_cents,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      gateway_id,
      venue_id,
      gateway_name: gateway.name,
      gateway_type: gateway.type,
      interaction_method,
      entry_number: entryNumber,
      entry_type: isInitialEntry ? 'initial' : 're_entry',
      venue_reentry_fee_cents: fees.venue_reentry_fee_cents,
      valid_reentry_scan_fee_cents: fees.valid_reentry_scan_fee_cents,
      metadata: {
        entry_id: entryId,
        receipt_id: receiptId,
        entry_type: isInitialEntry ? 'initial' : 're_entry',
        entry_number: entryNumber,
      },
    });

    if (txError) {
      console.error('Transaction insert error:', txError);
      // Don't fail the whole request if transaction logging fails
    }

    // Return success response
    res.status(200).json({
      success: true,
      entry_type: isInitialEntry ? 'initial' : 're_entry',
      entry_number: entryNumber,
      fees,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      receipt_id: receiptId,
      gateway_name: gateway.name,
      message: `${isInitialEntry ? 'Entry' : 'Re-entry'} approved`,
    });
  } catch (error) {
    console.error('Entry scan error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
