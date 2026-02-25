/**
 * Vendor Item Purchase Endpoint
 * 
 * Handles concession/vendor item purchases with:
 * - Atomic wallet debit
 * - Platform fee calculation (2.5%)
 * - Revenue split tracking
 * - Transaction logging
 * 
 * POST /api/vendor/purchase
 * 
 * Request Body:
 * - wallet_binding_id: string
 * - item_id: string (vendor_items.id)
 * - gateway_id: string (terminal/concession point)
 * - quantity: number (default: 1)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

// Platform fee configuration
const PLATFORM_FEE_PERCENTAGE = 2.5; // 2.5% platform fee

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
      item_id,
      gateway_id,
      quantity = 1,
      item_amount_cents,
      tip_amount_cents = 0,
      tip_percent = 0,
      interaction_method = 'QR',
      cart_items = [],
    } = req.body;

    // Get device fingerprint from header
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

    if (!wallet_binding_id || !item_id || !gateway_id) {
      return res.status(400).json({
        error: 'Missing required fields: wallet_binding_id, item_id, gateway_id',
      });
    }

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle manual entry (no item lookup needed)
    let item = null;
    let itemTotal = 0;
    let venue_id = null;

    if (item_id === 'manual_entry' || item_id === 'multi_item_purchase') {
      // Manual entry or multi-item purchase - use provided amount
      if (!item_amount_cents) {
        return res.status(400).json({ error: 'item_amount_cents required for manual entry' });
      }
      itemTotal = item_amount_cents * quantity;
      // For manual entry, we'll need to get venue_id from gateway or use a default
      venue_id = 'manual_entry_venue';
    } else {
      // Get vendor item from database
      const { data: itemData, error: itemError } = await supabase
        .from('vendor_items')
        .select('*')
        .eq('id', item_id)
        .single();

      if (itemError || !itemData) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (!itemData.available) {
        return res.status(400).json({ error: 'Item not available' });
      }

      item = itemData;
      itemTotal = item.price_cents * quantity;
      venue_id = item.venue_id;
    }

    // Calculate costs with tip
    const platformFee = Math.floor(itemTotal * (PLATFORM_FEE_PERCENTAGE / 100));
    const vendorPayout = itemTotal - platformFee;
    const totalCharged = itemTotal + tip_amount_cents;

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

    // Check balance
    if (wallet.balance_cents < totalCharged) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient balance',
        required_cents: totalCharged,
        current_balance_cents: wallet.balance_cents,
      });
    }

    // Deduct from wallet (atomic operation)
    const newBalance = wallet.balance_cents - totalCharged;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance_cents: newBalance,
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

    // Record transaction
    const { error: txError } = await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'SPEND',
      amount_cents: totalCharged,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      gateway_id,
      venue_id,
      vendor_name: item?.name || (cart_items.length > 0 ? 'Multi-Item Purchase' : 'Manual Entry'),
      platform_fee_cents: platformFee,
      vendor_payout_cents: vendorPayout,
      interaction_method,
      metadata: {
        item_id,
        item_name: item?.name || (cart_items.length > 0 ? 'Multi-Item Purchase' : 'Manual Entry'),
        item_category: item?.category || 'multi_item',
        quantity,
        unit_price_cents: item?.price_cents || item_amount_cents,
        purchase_type: cart_items.length > 0 ? 'multi_item_vendor_purchase' : 'vendor_item',
        tip_amount_cents,
        tip_percent,
        subtotal_cents: itemTotal,
        cart_items: cart_items.length > 0 ? cart_items : undefined,
      },
    });

    if (txError) {
      console.error('Transaction insert error:', txError);
      // Don't fail the whole request if transaction logging fails
    }

    // Log audit entry
    await supabase.from('audit_logs').insert({
      user_id: wallet.user_id,
      action: 'VENDOR_PURCHASE',
      resource_type: 'transaction',
      resource_id: wallet.id,
      details: {
        item_id,
        item_name: item?.name || (cart_items.length > 0 ? 'Multi-Item Purchase' : 'Manual Entry'),
        quantity,
        subtotal_cents: itemTotal,
        tip_amount_cents,
        tip_percent,
        total_charged_cents: totalCharged,
        platform_fee_cents: platformFee,
        vendor_payout_cents: vendorPayout,
        gateway_id,
        venue_id,
        interaction_method,
        cart_items: cart_items.length > 0 ? cart_items : undefined,
        item_count: cart_items.length || 1,
      },
      ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'] as string,
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Purchase successful',
      transaction: {
        item_name: item?.name || (cart_items.length > 0 ? 'Multi-Item Purchase' : 'Manual Entry'),
        quantity,
        item_total_cents: itemTotal,
        tip_amount_cents,
        tip_percent,
        platform_fee_cents: platformFee,
        vendor_payout_cents: vendorPayout,
        total_charged_cents: totalCharged,
        cart_items: cart_items.length > 0 ? cart_items : undefined,
      },
      wallet: {
        balance_before_cents: wallet.balance_cents,
        balance_after_cents: newBalance,
        wallet_binding_id,
      },
    });
  } catch (error) {
    console.error('Vendor purchase error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
