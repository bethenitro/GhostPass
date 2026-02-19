import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';
import crypto from 'crypto';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      wallet_binding_id,
      venue_id,
      event_id,
      station_id,
      employee_id,
      verification_tier,
      age_verified
    } = req.body;

    if (!wallet_binding_id || !venue_id || !event_id || !station_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Get event configuration
    const { data: event } = await supabase
      .from('events')
      .select('*, revenue_profiles(*), tax_profiles(*)')
      .eq('event_id', event_id)
      .single();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check previous entries for this event
    const { data: previousEntries, count: entryCount } = await supabase
      .from('entry_tracking')
      .select('*', { count: 'exact' })
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('event_id', event_id);

    const isInitialEntry = !entryCount || entryCount === 0;
    const entry_number = (entryCount || 0) + 1;

    // Calculate fees
    const entry_fee_cents = isInitialEntry ? event.entry_fee_cents : 0;
    const re_entry_fee_cents = !isInitialEntry ? event.re_entry_fee_cents : 0;
    const platform_fee_cents = event.platform_fee_cents || 25;

    const total_fees = entry_fee_cents + re_entry_fee_cents + platform_fee_cents;

    // Calculate tax BEFORE split
    let tax_cents = 0;
    const tax_breakdown: any = {};

    if (event.tax_profiles) {
      const taxProfile = event.tax_profiles;
      const state_tax = Math.floor(total_fees * (taxProfile.state_tax_percentage / 100));
      const local_tax = Math.floor(total_fees * (taxProfile.local_tax_percentage / 100));
      
      tax_breakdown.state_tax_cents = state_tax;
      tax_breakdown.local_tax_cents = local_tax;
      tax_cents = state_tax + local_tax;
    }

    const total_with_tax = total_fees + tax_cents;

    // Calculate revenue split
    const split_breakdown: any = {};
    if (event.revenue_profiles) {
      const profile = event.revenue_profiles;
      split_breakdown.valid_cents = Math.floor(platform_fee_cents * (profile.valid_percentage / 100));
      split_breakdown.vendor_cents = Math.floor(platform_fee_cents * (profile.vendor_percentage / 100));
      split_breakdown.pool_cents = Math.floor(platform_fee_cents * (profile.pool_percentage / 100));
      split_breakdown.promoter_cents = Math.floor(platform_fee_cents * (profile.promoter_percentage / 100));
      split_breakdown.executive_cents = Math.floor(platform_fee_cents * (profile.executive_percentage / 100));
    }

    // Check balance
    if (wallet.balance_cents < total_with_tax) {
      return res.status(402).json({
        error: 'Insufficient balance',
        required_cents: total_with_tax,
        current_balance_cents: wallet.balance_cents
      });
    }

    // Atomic transaction
    const pre_balance = wallet.balance_cents;
    const post_balance = pre_balance - total_with_tax;

    // Update wallet
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_cents: post_balance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Create transaction hash
    const transaction_hash = crypto
      .createHash('sha256')
      .update(`${wallet_binding_id}-${event_id}-${Date.now()}-${Math.random()}`)
      .digest('hex');

    // Insert into ledger
    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('venue_transaction_ledger')
      .insert({
        transaction_hash,
        venue_id,
        event_id,
        station_id,
        employee_id,
        wallet_binding_id,
        transaction_type: isInitialEntry ? 'ENTRY' : 'RE_ENTRY',
        item_amount_cents: entry_fee_cents + re_entry_fee_cents,
        tax_cents,
        tax_breakdown,
        platform_fee_cents,
        revenue_profile_id: event.revenue_profile_id,
        split_breakdown,
        pre_balance_cents: pre_balance,
        post_balance_cents: post_balance,
        status: 'completed'
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // Insert entry tracking
    const { data: entryTracking, error: entryError } = await supabase
      .from('entry_tracking')
      .insert({
        wallet_binding_id,
        venue_id,
        event_id,
        station_id,
        employee_id,
        entry_number,
        entry_type: isInitialEntry ? 'INITIAL' : 'RE_ENTRY',
        entry_fee_cents,
        re_entry_fee_cents,
        platform_fee_cents,
        verification_tier: verification_tier || 1,
        age_verified: age_verified || false,
        transaction_id: ledgerEntry.id
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Log ID verification (NO raw ID data)
    if (verification_tier) {
      await supabase.from('id_verification_logs').insert({
        entry_id: entryTracking.id,
        station_id,
        employee_id: employee_id || 'SYSTEM',
        verification_tier,
        age_flag_verified: age_verified || false
      });
    }

    res.status(200).json({
      success: true,
      entry_type: isInitialEntry ? 'INITIAL' : 'RE_ENTRY',
      entry_number,
      transaction: ledgerEntry,
      entry_tracking: entryTracking,
      new_balance_cents: post_balance
    });
  } catch (error: any) {
    console.error('Process entry with verification error:', error);
    res.status(500).json({ error: 'Entry processing failed', detail: error.message });
  }
};
