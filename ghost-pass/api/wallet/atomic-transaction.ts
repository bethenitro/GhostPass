import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';

const platformFeeEngine = {
  contextFees: { entry: 25, bar: 50, merch: 75, general: 50 },
  distributionConfig: {
    validPlatformPercentage: 40,
    vendorPercentage: 35,
    poolPercentage: 15,
    promoterPercentage: 10
  },
  calculatePlatformFee(context: string = 'general') {
    return this.contextFees[context as keyof typeof this.contextFees] || 50;
  },
  calculateFeeDistribution(totalFeeCents: number) {
    const dist: any = {};
    dist.validPlatformCents = Math.floor(totalFeeCents * this.distributionConfig.validPlatformPercentage / 100);
    dist.vendorCents = Math.floor(totalFeeCents * this.distributionConfig.vendorPercentage / 100);
    dist.poolCents = Math.floor(totalFeeCents * this.distributionConfig.poolPercentage / 100);
    dist.promoterCents = Math.floor(totalFeeCents * this.distributionConfig.promoterPercentage / 100);
    const total = dist.validPlatformCents + dist.vendorCents + dist.poolCents + dist.promoterCents;
    if (total < totalFeeCents) dist.validPlatformCents += totalFeeCents - total;
    return dist;
  }
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const itemAmountCents = parseInt((req.query.item_amount_cents as string) || '0');
    const gatewayId = req.query.gateway_id as string;
    const context = (req.query.context as string) || 'general';

    const platformFee = platformFeeEngine.calculatePlatformFee(context);
    const feeDistribution = platformFeeEngine.calculateFeeDistribution(platformFee);
    const totalCharged = itemAmountCents + platformFee;

    // Get wallet
    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (!walletData || walletData.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletData[0];

    if (wallet.balance_cents < totalCharged) {
      return res.status(400).json({
        detail: `Insufficient balance. Required: $${(totalCharged / 100).toFixed(2)}, Available: $${(wallet.balance_cents / 100).toFixed(2)}`
      });
    }

    // Deduct from wallet
    const newBalance = wallet.balance_cents - totalCharged;
    await supabase
      .from('wallets')
      .update({ balance_cents: newBalance })
      .eq('id', wallet.id);

    // Log transaction
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'SPEND',
      amount_cents: -totalCharged,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      vendor_name: 'Platform Transaction',
      metadata: { gateway_id, context, ...feeDistribution }
    });

    res.status(200).json({
      status: 'success',
      transaction_breakdown: {
        item_amount_cents: itemAmountCents,
        platform_fee_cents: platformFee,
        vendor_payout_cents: itemAmountCents,
        total_charged_cents: totalCharged,
        context,
        fee_distribution: feeDistribution
      },
      new_balance_cents: newBalance
    });
  } catch (error) {
    console.error('Atomic transaction error:', error);
    res.status(500).json({ detail: 'Transaction failed' });
  }
};
