/**
 * Check Entry Permission Endpoint
 * 
 * Checks if a user is allowed to enter a venue and calculates fees.
 * Called before processing the actual scan.
 * 
 * POST /api/entry/check-permission
 * 
 * Request Body:
 * - wallet_binding_id: string
 * - venue_id: string
 * 
 * Response:
 * - allowed: boolean
 * - entry_type: 'initial' | 're_entry'
 * - entry_number: number
 * - fees: EntryFees object
 * - message: string
 * - reason?: string
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireDeviceAuth } from '../_lib/device-auth';
import { supabase } from '../_lib/supabase';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const deviceAuth = await requireDeviceAuth(req, res);
    if (!deviceAuth) return;

    const { wallet_binding_id, venue_id } = req.body;

    if (!wallet_binding_id || !venue_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: wallet_binding_id, venue_id' 
      });
    }

    // Get venue info
    const { data: venue } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venue_id)
      .single();

    if (!venue) {
      return res.status(404).json({ 
        error: 'Venue not found' 
      });
    }

    // Check previous entries
    const { data: previousEntries } = await supabase
      .from('entry_logs')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('venue_id', venue_id)
      .order('entry_timestamp', { ascending: false });

    const isInitialEntry = !previousEntries || previousEntries.length === 0;
    const entryNumber = (previousEntries?.length || 0) + 1;

    // Calculate fees
    const fees = {
      initial_entry_fee_cents: isInitialEntry ? (venue.initial_entry_fee_cents || 500) : 0,
      venue_reentry_fee_cents: !isInitialEntry ? (venue.reentry_fee_cents || 200) : 0,
      valid_reentry_scan_fee_cents: !isInitialEntry ? 25 : 0,
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
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (!wallet || wallet.balance_cents < fees.total_fees_cents) {
      return res.status(200).json({
        allowed: false,
        entry_type: isInitialEntry ? 'initial' : 're_entry',
        entry_number: entryNumber,
        message: 'Insufficient wallet balance',
        reason: 'insufficient_balance',
        required_balance_cents: fees.total_fees_cents,
        current_balance_cents: wallet?.balance_cents || 0
      });
    }

    res.status(200).json({
      allowed: true,
      entry_type: isInitialEntry ? 'initial' : 're_entry',
      entry_number: entryNumber,
      fees,
      message: `${isInitialEntry ? 'Initial entry' : 'Re-entry'} allowed`,
      current_balance_cents: wallet.balance_cents
    });

  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ 
      error: 'Failed to check entry permission',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
