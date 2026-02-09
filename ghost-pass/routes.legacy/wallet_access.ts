import express from 'express';
import type { Request, Response } from 'express';
import { getCurrentUser } from '../auth.ts';

const router = express.Router();

router.post('/surface-wallet', getCurrentUser, async (req: Request, res: Response) => {
  const { wallet_binding_id, device_fingerprint } = req.body;

  res.json({
    status: 'success',
    message: 'Wallet surfaced',
    wallet_access: {
      wallet_binding_id,
      device_fingerprint
    },
    force_surface: true,
    pwa_manifest_url: '/manifest.json',
    instructions: {
      action: 'open_wallet',
      timeout: 300
    }
  });
});

router.post('/access-session', getCurrentUser, async (req: Request, res: Response) => {
  const { session_id } = req.body;

  res.json({
    status: 'success',
    message: 'Session accessed',
    wallet_access: {
      session_id
    }
  });
});

router.post('/cleanup-sessions', getCurrentUser, async (req: Request, res: Response) => {
  res.json({
    cleaned_up: true,
    message: 'Sessions cleaned up'
  });
});

router.post('/session/:session_id/deactivate', getCurrentUser, async (req: Request, res: Response) => {
  const { session_id } = req.params;

  res.json({
    deactivated: true,
    session_id,
    message: 'Session deactivated'
  });
});

// Add more routes as needed

export default router;