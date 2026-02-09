/**
 * Push Notification Subscription Endpoint
 * 
 * Allows users to subscribe to push notifications for entry confirmations.
 * Uses Web Push API standard.
 * 
 * POST /api/notifications/subscribe
 * 
 * Request Body:
 * - subscription: PushSubscription object from browser
 * - wallet_binding_id: string
 * 
 * Response:
 * - status: 'SUCCESS' | 'ERROR'
 * - subscription_id: string
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { subscription, wallet_binding_id } = req.body;

    if (!subscription || !wallet_binding_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: subscription, wallet_binding_id' 
      });
    }

    // Validate subscription object
    if (!subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ 
        error: 'Invalid subscription object' 
      });
    }

    const subscriptionId = uuidv4();

    // Store push subscription in database
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        subscription_id: subscriptionId,
        user_id: user.id,
        wallet_binding_id,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        created_at: new Date().toISOString(),
        is_active: true
      });

    if (insertError) {
      throw insertError;
    }

    res.status(200).json({
      status: 'SUCCESS',
      subscription_id: subscriptionId,
      message: 'Push notification subscription created successfully'
    });

  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to create push subscription',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
