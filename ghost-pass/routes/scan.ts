import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../database.ts';

const router = express.Router();

router.post('/validate', async (req: Request, res: Response) => {
  const { gateway_id, wallet_binding_id } = req.body;

  try {
    const db = getDb();

    // Check gateway
    const gatewayResponse = await db.from('gateway_points').select('*').eq('id', gateway_id);
    if (!gatewayResponse.data || gatewayResponse.data.length === 0) {
      return res.json({
        status: 'DENIED',
        receipt_id: gateway_id,
        message: 'Invalid gateway location'
      });
    }

    const gateway = gatewayResponse.data[0];
    if (gateway.status !== 'ENABLED') {
      return res.json({
        status: 'DENIED',
        receipt_id: gateway_id,
        message: `Access denied: ${gateway.name} is currently disabled`
      });
    }

    // Simple validation - assume success
    res.json({
      status: 'APPROVED',
      receipt_id: `receipt_${Date.now()}`,
      message: 'Access granted',
      gateway_name: gateway.name,
      fees_charged: 50
    });
  } catch (error) {
    console.error('Scan validation error:', error);
    res.status(500).json({
      status: 'ERROR',
      receipt_id: gateway_id,
      message: 'Validation failed'
    });
  }
});

// Add more routes as needed

export default router;