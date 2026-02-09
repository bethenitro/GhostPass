/**
 * Process Entry Scan Endpoint
 * 
 * Processes QR code scan for venue entry with automatic:
 * - Fee calculation (initial entry + re-entry fees)
 * - Entry logging
 * - Push notification sending
 * - Wallet balance deduction
 * 
 * POST /api/entry/process-scan
 * 
 * Request Body:
 * - wallet_binding_id: string
 * - venue_id: string
 * - gateway_id: string
 * - pass_id: string (from QR code)
 * - interaction_method: 'NFC' | 'QR'
 * 
 * Response:
 * - status: 'APPROVED' | 'DENIED'
 * - entry_info: EntryInfo object
 * - receipt_id: string
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';

interface EntryFees {
  initial_entry_fee_cents: number;
  venue_reentry_fee_cents: number;
  valid_reentry_scan_fee_cents: number;
  total_fees_cents: number;
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
      venue_id,
      gateway_id,
      pass_id,
      interaction_method = 'QR'
    } = req.body;

    if (!wallet_binding_id || !venue_id || !gateway_id || !pass_id) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Get venue and gateway info
    const { data: venue } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venue_id)
      .single();

    const { data: gateway } = await supabase
      .from('gateways')
      .select('*')
      .eq('gateway_id', gateway_id)
      .single();

    if (!venue || !gateway) {
      return res.status(404).json({ 
        error: 'Venue or gateway not found' 
      });
    }

    // Check if this is initial entry or re-entry
    const { data: previousEntries } = await supabase
      .from('entry_logs')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('venue_id', venue_id)
      .order('entry_timestamp', { ascending: false });

    const isInitialEntry = !previousEntries || previousEntries.length === 0;
    const entryNumber = (previousEntries?.length || 0) + 1;

    // Calculate fees
    const fees: EntryFees = {
      initial_entry_fee_cents: isInitialEntry ? (venue.initial_entry_fee_cents || 500) : 0,
      venue_reentry_fee_cents: !isInitialEntry ? (venue.reentry_fee_cents || 200) : 0,
      valid_reentry_scan_fee_cents: !isInitialEntry ? 25 : 0, // Platform fee for re-entry
      total_fees_cents: 0
    };

    fees.total_fees_cents = 
      fees.initial_entry_fee_cents + 
      fees.venue_reentry_fee_cents + 
      fees.valid_reentry_scan_fee_cents;

    // Check wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet || wallet.balance_cents < fees.total_fees_cents) {
      return res.status(402).json({
        status: 'DENIED',
        message: 'Insufficient wallet balance',
        required_balance_cents: fees.total_fees_cents,
        current_balance_cents: wallet?.balance_cents || 0
      });
    }

    // Deduct fees from wallet
    const { error: deductError } = await supabase
      .from('wallets')
      .update({ 
        balance_cents: wallet.balance_cents - fees.total_fees_cents,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (deductError) {
      throw deductError;
    }

    // Log entry
    const receiptId = uuidv4();
    const entryTimestamp = new Date().toISOString();

    await supabase
      .from('entry_logs')
      .insert({
        receipt_id: receiptId,
        user_id: user.id,
        wallet_binding_id,
        venue_id,
        gateway_id,
        pass_id,
        entry_type: isInitialEntry ? 'initial' : 're_entry',
        entry_number: entryNumber,
        interaction_method,
        initial_entry_fee_cents: fees.initial_entry_fee_cents,
        venue_reentry_fee_cents: fees.venue_reentry_fee_cents,
        valid_reentry_scan_fee_cents: fees.valid_reentry_scan_fee_cents,
        total_fee_cents: fees.total_fees_cents,
        entry_timestamp: entryTimestamp,
        status: 'APPROVED'
      });

    // Log transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        amount_cents: -fees.total_fees_cents,
        transaction_type: isInitialEntry ? 'entry_fee' : 'reentry_fee',
        description: `${isInitialEntry ? 'Entry' : 'Re-entry'} at ${venue.venue_name} - ${gateway.gateway_name}`,
        venue_id,
        gateway_id,
        receipt_id: receiptId,
        created_at: entryTimestamp
      });

    // Send push notification (async - don't wait for it)
    try {
      await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/notifications/send-entry-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        body: JSON.stringify({
          wallet_binding_id,
          entry_type: isInitialEntry ? 'initial' : 're_entry',
          venue_name: venue.venue_name,
          gateway_name: gateway.gateway_name,
          total_fee_cents: fees.total_fees_cents,
          entry_timestamp: entryTimestamp
        })
      });
    } catch (notificationError) {
      // Log but don't fail the entry if notification fails
      console.error('Failed to send entry notification:', notificationError);
    }

    res.status(200).json({
      status: 'APPROVED',
      message: `${isInitialEntry ? 'Entry' : 'Re-entry'} approved`,
      receipt_id: receiptId,
      entry_info: {
        entry_type: isInitialEntry ? 'initial' : 're_entry',
        entry_number: entryNumber,
        fees,
        venue_name: venue.venue_name,
        gateway_name: gateway.gateway_name,
        entry_timestamp: entryTimestamp,
        new_balance_cents: wallet.balance_cents - fees.total_fees_cents
      }
    });

  } catch (error) {
    console.error('Entry processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process entry',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
