import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get device fingerprint from header (no auth required)
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
    
    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const { sources } = req.body;
    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({ error: 'sources array required' });
    }

    const totalAmount = sources.reduce((sum: number, s: any) => sum + s.amount, 0);
    const totalAmountCents = Math.floor(totalAmount * 100);

    if (totalAmountCents <= 0) {
      return res.status(400).json({ detail: 'Total amount must be positive' });
    }

    // Get or create wallet based on device fingerprint
    let { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint);

    let wallet;
    if (!walletData || walletData.length === 0) {
      // Create new anonymous wallet
      const walletBindingId = `wallet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { data: newWallet } = await supabase
        .from('wallets')
        .insert({ 
          device_fingerprint: deviceFingerprint,
          wallet_binding_id: walletBindingId,
          balance_cents: totalAmountCents,
          device_bound: true,
          wallet_surfaced: false,
          entry_count: 0
        })
        .select();
      wallet = newWallet?.[0];
    } else {
      wallet = walletData[0];
      const { data: updated } = await supabase
        .from('wallets')
        .update({ balance_cents: wallet.balance_cents + totalAmountCents })
        .eq('id', wallet.id)
        .select();
      wallet = updated?.[0];
    }

    // Log transaction
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'FUND',
      amount_cents: totalAmountCents,
      balance_before_cents: wallet.balance_cents - totalAmountCents,
      balance_after_cents: wallet.balance_cents,
      vendor_name: 'Wallet Funding',
      metadata: { sources }
    });

    res.status(200).json({
      status: 'success',
      amount_funded_cents: totalAmountCents,
      new_balance_cents: wallet.balance_cents,
      wallet_binding_id: wallet.wallet_binding_id
    });
  } catch (error) {
    console.error('Fund error:', error);
    res.status(500).json({ detail: 'Funding failed' });
  }
};
