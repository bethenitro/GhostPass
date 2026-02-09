/**
 * Push Notifications Manager
 * 
 * Handles Web Push API integration for entry confirmations.
 * Manages subscription, unsubscription, and notification permissions.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface PushSubscriptionData {
  subscription: PushSubscription;
  wallet_binding_id: string;
}

/**
 * Check if push notifications are supported
 */
export const isPushNotificationSupported = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Get VAPID public key from server
 */
const getVapidPublicKey = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/vapid-public-key`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch VAPID public key');
    }

    const data = await response.json();
    return data.public_key;
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    throw error;
  }
};

/**
 * Convert VAPID key from base64 to Uint8Array
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPushNotifications = async (
  walletBindingId: string
): Promise<{ success: boolean; subscription_id?: string; error?: string }> => {
  try {
    // Check if push notifications are supported
    if (!isPushNotificationSupported()) {
      return {
        success: false,
        error: 'Push notifications not supported'
      };
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Notification permission denied'
      };
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Send subscription to server
    const response = await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        wallet_binding_id: walletBindingId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save push subscription');
    }

    const data = await response.json();

    // Store subscription ID locally
    localStorage.setItem('push_subscription_id', data.subscription_id);

    return {
      success: true,
      subscription_id: data.subscription_id
    };

  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPushNotifications = async (
  walletBindingId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get current subscription
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from push manager
      await subscription.unsubscribe();
    }

    // Notify server
    const subscriptionId = localStorage.getItem('push_subscription_id');
    await fetch(`${API_BASE_URL}/api/notifications/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({
        subscription_id: subscriptionId,
        wallet_binding_id: walletBindingId
      })
    });

    // Clear local storage
    localStorage.removeItem('push_subscription_id');

    return { success: true };

  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Check if user is currently subscribed to push notifications
 */
export const isPushNotificationSubscribed = async (): Promise<boolean> => {
  try {
    if (!isPushNotificationSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
};

/**
 * Show a test notification (for debugging)
 */
export const showTestNotification = async (): Promise<void> => {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  
  await registration.showNotification('🎫 Ghost Pass Test', {
    body: 'Push notifications are working!',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'test-notification',
    requireInteraction: false
  });
};
