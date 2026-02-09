import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../database.ts';
import { getCurrentUser } from '../auth.ts';
import type { PurchaseRequest, PurchaseResponse } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Default pricing in cents
const DEFAULT_PRICES: Record<number, number> = {
  1: 1000,   // $10.00
  3: 2000,   // $20.00
  5: 3500,   // $35.00
  7: 5000,   // $50.00
  10: 6500,  // $65.00
  14: 8500,  // $85.00
  30: 10000  // $100.00
};

const getPricing = async (db: any) => {
  try {
    const config = await db.from('system_configs').select('config_value').eq('config_key', 'ghostpass_pricing');
    if (config.data && config.data[0]?.config_value) {
      const pricing = config.data[0].config_value;
      return Object.fromEntries(
        Object.entries(pricing).map(([k, v]) => [parseInt(k), parseInt(v as string)])
      );
    }
  } catch (error) {
    console.warn('Failed to fetch pricing config:', error);
  }
  return DEFAULT_PRICES;
};

// Get pricing (public endpoint)
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const pricing = await getPricing(db);
    res.json({
      pricing,
      currency: 'USD'
    });
  } catch (error) {
    console.error('Pricing fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch pricing' });
  }
});

// Purchase ghost pass
router.post('/purchase', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { duration }: PurchaseRequest = req.body;

  try {
    const db = getDb();
    const PRICES = await getPricing(db);

    if (!PRICES[duration]) {
      return res.status(400).json({ detail: `Invalid duration. Must be one of: ${Object.keys(PRICES).join(', ')}` });
    }

    const price_cents = PRICES[duration];

    console.log(`Attempting to purchase pass for user ${user.id}, duration: ${duration} days, price: ${price_cents} cents`);

    // Ensure user exists
    await db.from('users').upsert({
      id: user.id,
      email: user.email
    }, { onConflict: 'id' });

    // Check wallet
    const walletResponse = await db.from('wallets').select('*').eq('user_id', user.id);
    if (!walletResponse.data || walletResponse.data.length === 0) {
      return res.status(404).json({ detail: 'No wallet found. Please fund your wallet first.' });
    }

    const wallet = walletResponse.data[0];
    if (wallet.balance_cents < price_cents) {
      return res.status(400).json({
        detail: `Insufficient balance. Required: $${(price_cents / 100).toFixed(2)}, Available: $${(wallet.balance_cents / 100).toFixed(2)}`
      });
    }

    // Generate pass ID
    const pass_id = uuidv4();
    const expires_at = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

    // Deduct from wallet
    const newBalance = wallet.balance_cents - price_cents;
    await db.from('wallets').update({
      balance_cents: newBalance
    }).eq('id', wallet.id);

    // Create ghost pass
    const passInsert = await db.from('ghost_passes').insert({
      id: pass_id,
      user_id: user.id,
      status: 'ACTIVE',
      expires_at,
      duration_days: duration,
      price_cents
    }).select();

    if (!passInsert.data) {
      return res.status(500).json({ detail: 'Failed to create ghost pass' });
    }

    // Log transaction
    await db.from('transactions').insert({
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

    const response: PurchaseResponse = {
      pass_id,
      expires_at,
      amount_charged_cents: price_cents,
      status: 'success'
    };

    res.json(response);
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ detail: 'Purchase failed' });
  }
});

// Get pass status
router.get('/status', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const db = getDb();
    const passResponse = await db
      .from('ghost_passes')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (!passResponse.data || passResponse.data.length === 0) {
      return res.status(404).json({ detail: 'No active pass found' });
    }

    res.json(passResponse.data[0]);
  } catch (error) {
    console.error('Pass status error:', error);
    res.status(500).json({ detail: 'Failed to fetch pass status' });
  }
});

// Get all passes for user
router.get('/passes', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { active_only } = req.query;

  try {
    const db = getDb();
    let query = db.from('ghost_passes').select('*').eq('user_id', user.id);

    if (active_only === 'true') {
      query = query.eq('status', 'ACTIVE').gte('expires_at', new Date().toISOString());
    }

    const passesResponse = await query.order('created_at', { ascending: false });

    res.json(passesResponse.data || []);
  } catch (error) {
    console.error('Passes fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch passes' });
  }
});

// Get specific pass details
router.get('/passes/:pass_id', getCurrentUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { pass_id } = req.params;

  try {
    const db = getDb();
    const passResponse = await db
      .from('ghost_passes')
      .select('*')
      .eq('id', pass_id)
      .eq('user_id', user.id)
      .single();

    if (!passResponse.data) {
      return res.status(404).json({ detail: 'Pass not found' });
    }

    res.json(passResponse.data);
  } catch (error) {
    console.error('Pass details error:', error);
    res.status(500).json({ detail: 'Failed to fetch pass details' });
  }
});

// Ghost Pass Modes routes
router.get('/contexts', (req: Request, res: Response) => {
  res.json({
    contexts: {
      'default': {
        name: 'Default Context',
        modes: ['standard'],
        pricing: { 1: 1000, 3: 2000, 7: 5000 },
        description: 'Standard GhostPass access'
      }
    },
    timestamp: new Date().toISOString()
  });
});

router.post('/check-context', (req: Request, res: Response) => {
  const { context_name } = req.body;
  res.json({
    context_name,
    valid: true,
    modes_available: ['standard'],
    message: 'Context is valid'
  });
});

router.post('/interact', getCurrentUser, (req: Request, res: Response) => {
  res.json({
    success: true,
    interaction_type: 'access',
    message: 'Interaction successful'
  });
});

export default router;
