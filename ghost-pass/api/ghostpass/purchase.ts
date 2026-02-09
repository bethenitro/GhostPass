import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_PRICES: Record<number, number> = {
  1: 1000,
  3: 2000,
  5: 3500,
  7: 5000,
  10: 6500,
  14: 8500,
  30: 10000
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { duration } = req.body;

    if (!duration || !DEFAULT_PRICES[duration]) {
      return res.status(400).json({
        detail: `Invalid duration. Must be one of: ${Object.keys(DEFAULT_PRICES).join(', ')}`
      });
    }

    const price_cents = DEFAULT_PRICES[duration];

    // Ensure user exists
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email
    }, { onConflict: 'id' });

    // Get wallet
    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(404).json({ detail: 'No wallet found. Please fund your wallet first.' });
    }

    const wallet = walletData[0];

    if (wallet.balance_cents < price_cents) {
      return res.status(400).json({
        detail: `Insufficient balance. Required: $${(price_cents / 100).toFixed(2)}, Available: $${(wallet.balance_cents / 100).toFixed(2)}`
      });
    }

    // Create pass
    const pass_id = uuidv4();
    const expires_at = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

    // Deduct from wallet
    const newBalance = wallet.balance_cents - price_cents;
    await supabase
      .from('wallets')
      .update({ balance_cents: newBalance })
      .eq('id', wallet.id);

    // Create ghost pass
    await supabase.from('ghost_passes').insert({
      id: pass_id,
      user_id: user.id,
      status: 'ACTIVE',
      expires_at,
      duration_days: duration,
      price_cents
    });

    // Log transaction
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'SPEND',
      amount_cents: -price_cents,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      vendor_name: 'GhostPass System',
      metadata: {
        pass_id,
        duration_days: duration,
        expires_at
      }
    });

    res.status(200).json({
      pass_id,
      expires_at,
      amount_charged_cents: price_cents,
      status: 'success'
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ detail: 'Purchase failed' });
  }
};
