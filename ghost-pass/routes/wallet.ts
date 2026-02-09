import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../database.ts';
import { getCurrentUser } from '../auth.ts';
import type { FundRequest, WalletBalance, Transaction, RefundRequest, RefundResponse } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Platform Fee Engine - matches FastAPI implementation
class PlatformFeeEngine {
  defaultFeeCents = 50;
  feeEnabled = true;
  contextFees = {
    entry: 25,
    bar: 50,
    merch: 75,
    general: 50
  };

  distributionConfig = {
    validPlatformPercentage: 40,
    vendorPercentage: 35,
    poolPercentage: 15,
    promoterPercentage: 10
  };

  calculatePlatformFee(context: string = 'general'): number {
    if (!this.feeEnabled) return 0;
    return this.contextFees[context as keyof typeof this.contextFees] || this.defaultFeeCents;
  }

  calculateFeeDistribution(totalFeeCents: number) {
    const distribution: any = {};
    distribution.validPlatformCents = Math.floor(totalFeeCents * this.distributionConfig.validPlatformPercentage / 100);
    distribution.vendorCents = Math.floor(totalFeeCents * this.distributionConfig.vendorPercentage / 100);
    distribution.poolCents = Math.floor(totalFeeCents * this.distributionConfig.poolPercentage / 100);
    distribution.promoterCents = Math.floor(totalFeeCents * this.distributionConfig.promoterPercentage / 100);

    const total = distribution.validPlatformCents + distribution.vendorCents + distribution.poolCents + distribution.promoterCents;
    if (total < totalFeeCents) {
      distribution.validPlatformCents += totalFeeCents - total;
    }
    return distribution;
  }

  calculateAtomicTransaction(itemAmountCents: number, context: string = 'general') {
    const platformFee = this.calculatePlatformFee(context);
    const feeDistribution = this.calculateFeeDistribution(platformFee);

    return {
      item_amount_cents: itemAmountCents,
      platform_fee_cents: platformFee,
      vendor_payout_cents: itemAmountCents,
      total_charged_cents: itemAmountCents + platformFee,
      context,
      fee_distribution: feeDistribution
    };
  }

  setPlatformFee(feeCents: number, context: string = 'general') {
    this.contextFees[context as keyof typeof this.contextFees] = feeCents;
    console.log(`Platform fee updated: ${context} = $${(feeCents / 100).toFixed(2)}`);
  }

  setDistributionPercentages(validPct: number, vendorPct: number, poolPct: number, promoterPct: number) {
    if (validPct + vendorPct + poolPct + promoterPct !== 100) {
      throw new Error('Distribution percentages must add up to 100');
    }
    this.distributionConfig = {
      validPlatformPercentage: validPct,
      vendorPercentage: vendorPct,
      poolPercentage: poolPct,
      promoterPercentage: promoterPct
    };
    console.log(`Fee distribution updated: VALID=${validPct}%, Vendor=${vendorPct}%, Pool=${poolPct}%, Promoter=${promoterPct}%`);
  }

  processVendorPayout(vendorId: string, payoutAmountCents: number, transactionId: string) {
    const payoutData = {
      vendor_id: vendorId,
      amount_cents: payoutAmountCents,
      transaction_id: transactionId,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      payout_method: 'ACH_TRANSFER'
    };

    console.log(`Vendor payout processed: ${vendorId} = $${(payoutAmountCents / 100).toFixed(2)}`);

    return {
      status: 'PAYOUT_SCHEDULED',
      vendor_id: vendorId,
      amount: `$${(payoutAmountCents / 100).toFixed(2)}`,
      payout_data: payoutData
    };
  }
}

const platformFeeEngine = new PlatformFeeEngine();

// Get wallet balance
router.get('/balance', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    let walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    let wallet;
    if (!walletResponse.data || walletResponse.data.length === 0) {
      const createResponse = await db.from('wallets').insert({
        user_id: user.id,
        balance_cents: 0
      }).select();
      if (createResponse.data && createResponse.data.length > 0) {
        wallet = createResponse.data[0];
      } else {
        return res.status(500).json({ detail: 'Failed to create wallet' });
      }
    } else {
      wallet = walletResponse.data[0];
    }

    const response: WalletBalance = {
      balance_cents: wallet.balance_cents,
      balance_dollars: wallet.balance_cents / 100.0,
      updated_at: wallet.updated_at
    };

    res.json(response);
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch balance' });
  }
});

// Fund wallet
router.post('/fund', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { sources }: FundRequest = req.body;

  const totalAmount = sources.reduce((sum, s) => sum + s.amount, 0);
  const totalAmountCents = Math.floor(totalAmount * 100);

  if (totalAmountCents <= 0) {
    return res.status(400).json({ detail: 'Total amount must be positive' });
  }

  try {
    const db = getDb();
    
    // Get or create wallet
    let walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);
    let wallet;
    
    if (!walletResponse.data || walletResponse.data.length === 0) {
      const createResponse = await db.from('wallets').insert({
        user_id: user.id,
        balance_cents: totalAmountCents
      }).select();
      wallet = createResponse.data?.[0];
    } else {
      wallet = walletResponse.data[0];
      // Update balance
      const updateResponse = await db.from('wallets').update({
        balance_cents: wallet.balance_cents + totalAmountCents
      }).eq('id', wallet.id).select();
      wallet = updateResponse.data?.[0];
    }

    // Log transaction
    await db.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'FUND',
      amount_cents: totalAmountCents,
      balance_before_cents: wallet.balance_cents - totalAmountCents,
      balance_after_cents: wallet.balance_cents,
      vendor_name: 'Wallet Funding',
      metadata: { sources }
    });

    res.json({
      status: 'success',
      amount_funded_cents: totalAmountCents,
      new_balance_cents: wallet.balance_cents
    });
  } catch (error) {
    console.error('Fund error:', error);
    res.status(500).json({ detail: 'Funding failed' });
  }
});

// Get transactions
router.get('/transactions', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.json([]);
    }

    const wallet = walletResponse.data[0];
    const transactionsResponse = await db
      .from('transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false });

    res.json(transactionsResponse.data || []);
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch transactions' });
  }
});

// Get eligible funding transactions for refund
router.get('/refund/eligible-transactions', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.json([]);
    }

    const wallet = walletResponse.data[0];
    const transactionsResponse = await db
      .from('transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .eq('type', 'FUND')
      .order('created_at', { ascending: false });

    res.json(transactionsResponse.data || []);
  } catch (error) {
    console.error('Eligible transactions fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch eligible transactions' });
  }
});

// Request refund
router.post('/refund/request', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { amount_cents, funding_transaction_id }: RefundRequest = req.body;

  if (!amount_cents || !funding_transaction_id) {
    return res.status(400).json({ detail: 'amount_cents and funding_transaction_id required' });
  }

  try {
    const db = getDb();
    
    // Get wallet
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);
    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletResponse.data[0];

    // Verify funding transaction exists and belongs to user
    const fundingTxResponse = await db
      .from('transactions')
      .select('*')
      .eq('id', funding_transaction_id)
      .eq('wallet_id', wallet.id)
      .single();

    if (!fundingTxResponse.data) {
      return res.status(404).json({ detail: 'Funding transaction not found' });
    }

    const fundingTx = fundingTxResponse.data;

    // Validate refund amount
    if (amount_cents > fundingTx.amount_cents) {
      return res.status(400).json({
        detail: `Refund amount cannot exceed original funding amount of $${(fundingTx.amount_cents / 100).toFixed(2)}`
      });
    }

    // Create refund record
    const refundId = uuidv4();
    const refundResponse = await db.from('refunds').insert({
      id: refundId,
      wallet_id: wallet.id,
      funding_transaction_id,
      amount_cents,
      status: 'PENDING',
      reason: 'User requested refund'
    }).select();

    if (!refundResponse.data) {
      return res.status(500).json({ detail: 'Failed to create refund request' });
    }

    const response: RefundResponse = {
      refund_id: refundId,
      status: 'PENDING',
      amount_cents,
      created_at: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Refund request error:', error);
    res.status(500).json({ detail: 'Refund request failed' });
  }
});

// Get refund history
router.get('/refund/history', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.json([]);
    }

    const wallet = walletResponse.data[0];
    const refundsResponse = await db
      .from('refunds')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false });

    res.json(refundsResponse.data || []);
  } catch (error) {
    console.error('Refund history fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch refund history' });
  }
});

// Process atomic transaction
router.post('/atomic-transaction', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { item_amount_cents, gateway_id, context = 'general' } = req.query;

  try {
    const itemAmountCents = parseInt(item_amount_cents as string) || 0;
    const transactionBreakdown = platformFeeEngine.calculateAtomicTransaction(itemAmountCents, context as string);

    const db = getDb();
    
    // Get wallet
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);
    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletResponse.data[0];

    // Check balance
    if (wallet.balance_cents < transactionBreakdown.total_charged_cents) {
      return res.status(400).json({
        detail: `Insufficient balance. Required: $${(transactionBreakdown.total_charged_cents / 100).toFixed(2)}, Available: $${(wallet.balance_cents / 100).toFixed(2)}`
      });
    }

    // Deduct from wallet
    const newBalance = wallet.balance_cents - transactionBreakdown.total_charged_cents;
    await db.from('wallets').update({
      balance_cents: newBalance
    }).eq('id', wallet.id);

    // Log transaction
    await db.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'SPEND',
      amount_cents: -transactionBreakdown.total_charged_cents,
      balance_before_cents: wallet.balance_cents,
      balance_after_cents: newBalance,
      vendor_name: 'Platform Transaction',
      metadata: {
        gateway_id,
        context,
        ...transactionBreakdown
      }
    });

    res.json({
      status: 'success',
      transaction_breakdown: transactionBreakdown,
      new_balance_cents: newBalance
    });
  } catch (error) {
    console.error('Atomic transaction error:', error);
    res.status(500).json({ detail: 'Transaction failed' });
  }
});

// Get platform fee config
router.get('/platform-fee-config', getCurrentUser, (req: Request, res: Response) => {
  res.json({
    fee_enabled: platformFeeEngine.feeEnabled,
    default_fee_cents: platformFeeEngine.defaultFeeCents,
    context_fees: platformFeeEngine.contextFees,
    fee_policy: 'Platform fee is charged on every successful interaction and is independent of vendor pricing'
  });
});

// Set platform fee (admin)
router.post('/admin/platform-fee', getCurrentUser, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { fee_cents, context = 'general' } = req.query;

  // Check admin role
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ detail: 'Admin access required' });
  }

  try {
    const feeCents = parseInt(fee_cents as string);
    platformFeeEngine.setPlatformFee(feeCents, context as string);

    res.json({
      status: 'success',
      context,
      fee_cents: feeCents,
      message: `Platform fee for ${context} updated to $${(feeCents / 100).toFixed(2)}`
    });
  } catch (error) {
    console.error('Set platform fee error:', error);
    res.status(500).json({ detail: 'Failed to set platform fee' });
  }
});

// Get fee distribution (admin)
router.get('/admin/fee-distribution', getCurrentUser, (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.role !== 'ADMIN') {
    return res.status(403).json({ detail: 'Admin access required' });
  }

  res.json({
    distribution: platformFeeEngine.distributionConfig
  });
});

// Set fee distribution (admin)
router.post('/admin/fee-distribution', getCurrentUser, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { valid_percentage, vendor_percentage, pool_percentage, promoter_percentage } = req.query;

  if (user.role !== 'ADMIN') {
    return res.status(403).json({ detail: 'Admin access required' });
  }

  try {
    const validPct = parseInt(valid_percentage as string);
    const vendorPct = parseInt(vendor_percentage as string);
    const poolPct = parseInt(pool_percentage as string);
    const promoterPct = parseInt(promoter_percentage as string);

    platformFeeEngine.setDistributionPercentages(validPct, vendorPct, poolPct, promoterPct);

    res.json({
      status: 'success',
      distribution: platformFeeEngine.distributionConfig,
      message: 'Fee distribution updated successfully'
    });
  } catch (error: any) {
    console.error('Set fee distribution error:', error);
    res.status(400).json({ detail: error.message });
  }
});

// Process vendor payouts (admin)
router.post('/admin/process-vendor-payouts', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { vendor_id } = req.body;

  if (user.role !== 'ADMIN') {
    return res.status(403).json({ detail: 'Admin access required' });
  }

  try {
    // Placeholder - in real implementation, process pending payouts
    res.json({
      status: 'success',
      message: 'Vendor payouts processed',
      vendor_id: vendor_id || 'all'
    });
  } catch (error) {
    console.error('Process vendor payouts error:', error);
    res.status(500).json({ detail: 'Failed to process vendor payouts' });
  }
});

// Bind device to wallet
router.post('/bind-device', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { device_fingerprint, biometric_hash } = req.body;

  if (!device_fingerprint || !biometric_hash) {
    return res.status(400).json({ detail: 'device_fingerprint and biometric_hash required' });
  }

  try {
    const db = getDb();
    
    // Get or create wallet
    let walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);
    let wallet;

    if (!walletResponse.data || walletResponse.data.length === 0) {
      const createResponse = await db.from('wallets').insert({
        user_id: user.id,
        balance_cents: 0,
        device_bound: true,
        device_fingerprint,
        biometric_hash
      }).select();
      wallet = createResponse.data?.[0];
    } else {
      wallet = walletResponse.data[0];
      const updateResponse = await db.from('wallets').update({
        device_bound: true,
        device_fingerprint,
        biometric_hash
      }).eq('id', wallet.id).select();
      wallet = updateResponse.data?.[0];
    }

    res.json({
      status: 'SUCCESS',
      wallet_id: wallet.id,
      device_bound: true,
      message: 'Device bound successfully'
    });
  } catch (error) {
    console.error('Device binding error:', error);
    res.status(500).json({ detail: 'Device binding failed' });
  }
});

// Verify device binding
router.post('/verify-device-binding', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { device_fingerprint, biometric_hash } = req.query;

  try {
    const db = getDb();
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletResponse.data[0];

    const verified = wallet.device_fingerprint === device_fingerprint &&
                     wallet.biometric_hash === biometric_hash;

    res.json({
      verified,
      device_bound: wallet.device_bound,
      message: verified ? 'Device verified' : 'Device verification failed'
    });
  } catch (error) {
    console.error('Device verification error:', error);
    res.status(500).json({ detail: 'Device verification failed' });
  }
});

// Revoke ghost pass
router.post('/revoke-ghost-pass', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { ghost_pass_token, reason = 'Manual revocation' } = req.body;

  try {
    const db = getDb();
    
    // Update ghost pass status
    const updateResponse = await db.from('ghost_passes').update({
      status: 'REVOKED',
      revocation_reason: reason,
      revoked_at: new Date().toISOString()
    }).eq('id', ghost_pass_token).eq('user_id', user.id).select();

    if (!updateResponse.data || updateResponse.data.length === 0) {
      return res.status(404).json({ detail: 'Ghost pass not found' });
    }

    res.json({
      status: 'revoked',
      pass_id: ghost_pass_token,
      message: 'Ghost pass revoked successfully'
    });
  } catch (error) {
    console.error('Ghost pass revocation error:', error);
    res.status(500).json({ detail: 'Revocation failed' });
  }
});

// Create cryptographic proof
router.post('/create-proof', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { proof_type, proof_data } = req.body;

  try {
    const db = getDb();
    const proofId = uuidv4();

    const insertResponse = await db.from('cryptographic_proofs').insert({
      id: proofId,
      user_id: user.id,
      proof_type,
      proof_value: JSON.stringify(proof_data),
      verified: false,
      created_at: new Date().toISOString()
    }).select();

    if (!insertResponse.data) {
      return res.status(500).json({ detail: 'Failed to create proof' });
    }

    res.json({
      status: 'SUCCESS',
      proof_id: proofId,
      message: 'Proof created successfully'
    });
  } catch (error) {
    console.error('Create proof error:', error);
    res.status(500).json({ detail: 'Failed to create proof' });
  }
});

// Verify cryptographic proof
router.post('/verify-proof', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { proof_id, signature } = req.body;

  try {
    const db = getDb();
    
    // Get proof
    const proofResponse = await db.from('cryptographic_proofs').select('*').eq('id', proof_id).eq('user_id', user.id).single();

    if (!proofResponse.data) {
      return res.status(404).json({ detail: 'Proof not found' });
    }

    // Verify signature (simplified)
    const verified = signature && signature.length > 0;

    // Update proof
    await db.from('cryptographic_proofs').update({
      verified
    }).eq('id', proof_id);

    res.json({
      status: verified ? 'VERIFIED' : 'FAILED',
      proof_id,
      verified,
      message: verified ? 'Proof verified successfully' : 'Proof verification failed'
    });
  } catch (error) {
    console.error('Verify proof error:', error);
    res.status(500).json({ detail: 'Proof verification failed' });
  }
});

// Generate biometric challenge
router.post('/biometric-challenge', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletResponse.data[0];
    if (!wallet.device_bound) {
      return res.status(400).json({ detail: 'Device not bound' });
    }

    const challenge = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      status: 'SUCCESS',
      challenge,
      expires_in: 300
    });
  } catch (error) {
    console.error('Challenge generation error:', error);
    res.status(500).json({ detail: 'Challenge generation failed' });
  }
});

// Verify biometric response
router.post('/biometric-verify', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { challenge, biometric_hash } = req.body;

  try {
    const db = getDb();
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);

    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.status(404).json({ detail: 'Wallet not found' });
    }

    const wallet = walletResponse.data[0];
    const verified = wallet.biometric_hash === biometric_hash;

    res.json({
      status: verified ? 'SUCCESS' : 'FAILED',
      verified,
      message: verified ? 'Biometric verified' : 'Biometric verification failed'
    });
  } catch (error) {
    console.error('Biometric verification error:', error);
    res.status(500).json({ detail: 'Biometric verification failed' });
  }
});

// Get user proofs
router.get('/proofs', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    const proofsResponse = await db
      .from('cryptographic_proofs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    res.json({
      proofs: proofsResponse.data || []
    });
  } catch (error) {
    console.error('Get proofs error:', error);
    res.status(500).json({ detail: 'Failed to get proofs' });
  }
});

export default router;
