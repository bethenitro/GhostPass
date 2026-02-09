/**
 * Push Notification Unsubscribe Endpoint
 * 
 * Allows users to unsubscribe from push notifications.
 * 
 * POST /api/notifications/unsubscribe
 * 
 * Request Body:
 * - subscription_id?: string (optional - if not provided, unsubscribes all)
 * - wallet_binding_id: string
 * 
 * Response:
 * - status: 'SUCCESS' | 'ERROR'
 * - unsubscribed_count: number
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { subscription_id, wallet_binding_id } = req.body;

    if (!wallet_binding_id) {
      return res.status(400).json({ 
        error: 'Missing required field: wallet_binding_id' 
      });
    }

    let query = supabase
      .from('push_subscriptions')
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('wallet_binding_id', wallet_binding_id);

    // If specific subscription_id provided, only unsubscribe that one
    if (subscription_id) {
      query = query.eq('subscription_id', subscription_id);
    }

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    res.status(200).json({
      status: 'SUCCESS',
      unsubscribed_count: data?.length || 0,
      message: subscription_id 
        ? 'Unsubscribed from push notifications'
        : 'Unsubscribed all devices from push notifications'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ 
      error: 'Failed to unsubscribe',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
