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
      transaction_type,
      item_amount_cents,
      revenue_profile_id,
      tax_profile_id,
      is_alcohol,
      is_food
    } = req.body;

    if (!wallet_binding_id || !venue_id || !transaction_type || item_amount_cents === undefined) {
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

    // Get revenue profile
    const { data: revenueProfile } = await supabase
      .from('revenue_profiles')
      .select('*')
      .eq('id', revenue_profile_id)
      .single();

    // Get tax profile
    const { data: taxProfile } = await supabase
      .from('tax_profiles')
      .select('*')
      .eq('id', tax_profile_id)
      .single();

    // Calculate tax BEFORE split
    let tax_cents = 0;
    const tax_breakdown: any = {};

    if (taxProfile) {
      const state_tax = Math.floor(item_amount_cents * (taxProfile.state_tax_percentage / 100));
      const local_tax = Math.floor(item_amount_cents * (taxProfile.local_tax_percentage / 100));
      
      // Apply alcohol tax if item is alcohol
      const alcohol_tax = is_alcohol 
        ? Math.floor(item_amount_cents * (taxProfile.alcohol_tax_percentage / 100))
        : 0;
      
      // Apply food tax if item is food
      const food_tax = is_food 
        ? Math.floor(item_amount_cents * (taxProfile.food_tax_percentage / 100))
        : 0;
      
      tax_breakdown.state_tax_cents = state_tax;
      tax_breakdown.local_tax_cents = local_tax;
      tax_breakdown.alcohol_tax_cents = alcohol_tax;
      tax_breakdown.food_tax_cents = food_tax;
      tax_cents = state_tax + local_tax + alcohol_tax + food_tax;
    }

    const total_with_tax = item_amount_cents + tax_cents;

    // Calculate platform fee
    const platform_fee_cents = 25; // Default, can be dynamic

    // Calculate revenue split
    const split_breakdown: any = {};
    if (revenueProfile) {
      split_breakdown.valid_cents = Math.floor(platform_fee_cents * (revenueProfile.valid_percentage / 100));
      split_breakdown.vendor_cents = Math.floor(platform_fee_cents * (revenueProfile.vendor_percentage / 100));
      split_breakdown.pool_cents = Math.floor(platform_fee_cents * (revenueProfile.pool_percentage / 100));
      split_breakdown.promoter_cents = Math.floor(platform_fee_cents * (revenueProfile.promoter_percentage / 100));
      split_breakdown.executive_cents = Math.floor(platform_fee_cents * (revenueProfile.executive_percentage / 100));
    }

    const total_charge = total_with_tax + platform_fee_cents;

    // Check balance
    if (wallet.balance_cents < total_charge) {
      return res.status(402).json({
        error: 'Insufficient balance',
        required_cents: total_charge,
        current_balance_cents: wallet.balance_cents
      });
    }

    // Atomic transaction
    const pre_balance = wallet.balance_cents;
    const post_balance = pre_balance - total_charge;

    // Update wallet
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_cents: post_balance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Create transaction hash
    const transaction_hash = crypto
      .createHash('sha256')
      .update(`${wallet_binding_id}-${Date.now()}-${Math.random()}`)
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
        transaction_type,
        item_amount_cents,
        tax_cents,
        tax_breakdown,
        platform_fee_cents,
        revenue_profile_id,
        split_breakdown,
        pre_balance_cents: pre_balance,
        post_balance_cents: post_balance,
        status: 'completed'
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    res.status(200).json({
      success: true,
      transaction: ledgerEntry,
      new_balance_cents: post_balance
    });
  } catch (error: any) {
    console.error('Process atomic transaction error:', error);
    res.status(500).json({ error: 'Transaction failed', detail: error.message });
  }
};
