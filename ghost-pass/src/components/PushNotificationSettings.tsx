/**
 * Push Notification Settings Component
 * 
 * Allows users to enable/disable push notifications for entry confirmations.
 * Shows current subscription status and provides toggle controls.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushNotificationSubscribed,
  showTestNotification
} from '@/lib/pushNotifications';

interface PushNotificationSettingsProps {
  walletBindingId: string;
  className?: string;
}

const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({
  walletBindingId,
  className
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    setIsLoading(true);
    try {
      const supported = isPushNotificationSupported();
      setIsSupported(supported);

      if (supported) {
        const currentPermission = getNotificationPermission();
        setPermission(currentPermission);

        const subscribed = await isPushNotificationSubscribed();
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const result = await unsubscribeFromPushNotifications(walletBindingId);
        if (result.success) {
          setIsSubscribed(false);
          setStatusMessage({
            type: 'success',
            message: 'Push notifications disabled'
          });
        } else {
          setStatusMessage({
            type: 'error',
            message: result.error || 'Failed to disable notifications'
          });
        }
      } else {
        // Subscribe
        const result = await subscribeToPushNotifications(walletBindingId);
        if (result.success) {
          setIsSubscribed(true);
          setPermission('granted');
          setStatusMessage({
            type: 'success',
            message: 'Push notifications enabled! You\'ll receive entry confirmations.'
          });
        } else {
          setStatusMessage({
            type: 'error',
            message: result.error || 'Failed to enable notifications'
          });
        }
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
      
      // Clear status message after 5 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    }
  };

  const handleTestNotification = async () => {
    try {
      await showTestNotification();
      setStatusMessage({
        type: 'success',
        message: 'Test notification sent!'
      });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: 'Failed to send test notification'
      });
    }

    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  if (!isSupported) {
    return (
      <div className={cn("p-4 bg-gray-800/30 border border-gray-700 rounded-lg", className)}>
        <div className="flex items-center space-x-3 text-gray-400">
          <BellOff className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium">Push Notifications Not Supported</p>
            <p className="text-xs">Your browser doesn't support push notifications</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Toggle Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-cyan-400" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <p className="text-white font-medium">Entry Confirmations</p>
              <p className="text-xs text-gray-400">
                {isSubscribed 
                  ? 'Receive notifications when you enter venues'
                  : 'Enable notifications for entry confirmations'
                }
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleNotifications}
            disabled={isLoading || permission === 'denied'}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              isSubscribed ? "bg-cyan-600" : "bg-gray-600",
              isLoading && "opacity-50 cursor-not-allowed",
              permission === 'denied' && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin mx-auto" />
            ) : (
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isSubscribed ? "translate-x-6" : "translate-x-1"
                )}
              />
            )}
          </button>
        </div>

        {/* Permission Denied Warning */}
        {permission === 'denied' && (
          <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Notifications Blocked</p>
                <p className="mt-1">
                  You've blocked notifications. Please enable them in your browser settings.
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Status Message */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "p-3 rounded-lg border",
            statusMessage.type === 'success' && "bg-green-900/20 border-green-500/30",
            statusMessage.type === 'error' && "bg-red-900/20 border-red-500/30",
            statusMessage.type === 'info' && "bg-blue-900/20 border-blue-500/30"
          )}
        >
          <div className="flex items-start space-x-2">
            {statusMessage.type === 'success' && (
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            )}
            {statusMessage.type === 'error' && (
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <p className={cn(
              "text-sm",
              statusMessage.type === 'success' && "text-green-400",
              statusMessage.type === 'error' && "text-red-400",
              statusMessage.type === 'info' && "text-blue-400"
            )}>
              {statusMessage.message}
            </p>
          </div>
        </motion.div>
      )}

      {/* Test Notification Button */}
      {isSubscribed && (
        <button
          onClick={handleTestNotification}
          className="w-full p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-sm font-medium transition-colors"
        >
          Send Test Notification
        </button>
      )}

      {/* Info Section */}
      <div className="p-3 bg-gray-800/20 border border-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">What you'll receive:</span>
          <br />
          • Entry confirmation with venue name
          <br />
          • Fee breakdown for each entry
          <br />
          • Quick access to wallet and history
        </p>
      </div>
    </div>
  );
};

export default PushNotificationSettings;
