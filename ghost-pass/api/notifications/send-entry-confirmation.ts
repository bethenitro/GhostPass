/**
 * Send Entry Confirmation Push Notification
 * 
 * Sends a push notification to the user after successful entry.
 * Called automatically by the entry processing system.
 * 
 * POST /api/notifications/send-entry-confirmation
 * 
 * Request Body:
 * - wallet_binding_id: string
 * - entry_type: 'initial' | 're_entry'
 * - venue_name: string
 * - gateway_name: string
 * - total_fee_cents: number
 * - entry_timestamp: string
 * 
 * Response:
 * - status: 'SUCCESS' | 'NO_SUBSCRIPTION' | 'ERROR'
 * - notifications_sent: number
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';
import webpush from 'web-push';

// Configure web-push with VAPID keys
// In production, these should be environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@ghostpass.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const {
      wallet_binding_id,
      entry_type,
      venue_name,
      gateway_name,
      total_fee_cents,
      entry_timestamp
    } = req.body;

    if (!wallet_binding_id || !entry_type || !venue_name) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Get active push subscriptions for this wallet
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('wallet_binding_id', wallet_binding_id)
      .eq('is_active', true);

    if (fetchError) {
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        status: 'NO_SUBSCRIPTION',
        message: 'No active push subscriptions found',
        notifications_sent: 0
      });
    }

    // Prepare notification payload
    const entryTypeLabel = entry_type === 'initial' ? 'Entry Confirmed' : 'Re-Entry Confirmed';
    const feeLabel = total_fee_cents > 0 ? `$${(total_fee_cents / 100).toFixed(2)}` : 'Free';
    
    const notificationPayload = {
      title: `🎫 ${entryTypeLabel}`,
      body: `${venue_name} - ${gateway_name}\nFee: ${feeLabel}`,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: 'entry-confirmation',
      requireInteraction: false,
      data: {
        entry_type,
        venue_name,
        gateway_name,
        total_fee_cents,
        entry_timestamp,
        url: '/?tab=wallet'
      },
      actions: [
        {
          action: 'view-wallet',
          title: 'View Wallet'
        },
        {
          action: 'view-history',
          title: 'View History'
        }
      ]
    };

    // Send push notifications to all active subscriptions
    let notificationsSent = 0;
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        };

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notificationPayload)
        );

        notificationsSent++;

        // Log successful notification
        await supabase
          .from('notification_logs')
          .insert({
            subscription_id: sub.subscription_id,
            user_id: user.id,
            notification_type: 'entry_confirmation',
            payload: notificationPayload,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

      } catch (error) {
        console.error('Failed to send push notification:', error);
        
        // If subscription is invalid (410 Gone), deactivate it
        if (error instanceof Error && error.message.includes('410')) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('subscription_id', sub.subscription_id);
        }

        // Log failed notification
        await supabase
          .from('notification_logs')
          .insert({
            subscription_id: sub.subscription_id,
            user_id: user.id,
            notification_type: 'entry_confirmation',
            payload: notificationPayload,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            sent_at: new Date().toISOString()
          });
      }
    });

    await Promise.all(sendPromises);

    res.status(200).json({
      status: 'SUCCESS',
      notifications_sent: notificationsSent,
      total_subscriptions: subscriptions.length,
      message: `Sent ${notificationsSent} entry confirmation notifications`
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ 
      error: 'Failed to send entry confirmation',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
