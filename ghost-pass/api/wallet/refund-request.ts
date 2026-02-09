import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { amount_cents, funding_transaction_id } = req.body;

    if (!amount_cents || !funding_transaction_id) {
      return res.status(400).json({ error: 'amount_cents and funding_transaction_id required' });
    }

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletData[0];

    // Verify funding transaction
    const { data: fundingTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', funding_transaction_id)
      .eq('wallet_id', wallet.id)
      .single();

    if (!fundingTx) {
      return res.status(404).json({ detail: 'Funding transaction not found' });
    }

    if (amount_cents > fundingTx.amount_cents) {
      return res.status(400).json({
        detail: `Refund amount cannot exceed original funding amount of $${(fundingTx.amount_cents / 100).toFixed(2)}`
      });
    }

    const refundId = uuidv4();
    const { data: refundData } = await supabase
      .from('refunds')
      .insert({
        id: refundId,
        wallet_id: wallet.id,
        funding_transaction_id,
        amount_cents,
        status: 'PENDING',
        reason: 'User requested refund'
      })
      .select();

    if (!refundData) {
      return res.status(500).json({ detail: 'Failed to create refund request' });
    }

    res.status(200).json({
      refund_id: refundId,
      status: 'PENDING',
      amount_cents,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Refund request error:', error);
    res.status(500).json({ detail: 'Refund request failed' });
  }
};
