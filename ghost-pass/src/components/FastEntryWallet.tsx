/**
 * Fast Entry Wallet Component
 * 
 * Streamlined wallet for fast entry flow without account setup wall.
 * User scans QR → Wallet opens → Fund wallet → Entry processed
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Zap, CheckCircle, AlertCircle, Loader2, QrCode, ShoppingCart } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';
import PushNotificationSettings from './PushNotificationSettings';
import WalletRecoveryCode from './WalletRecoveryCode';
import { useToast } from './ui/toast';
import { MenuBasedVendorPurchase } from './MenuBasedVendorPurchase';

interface FastEntryWalletProps {
  walletBindingId?: string;
  venueId?: string;
  eventId?: string;
  venueName?: string;
  eventName?: string;
  entryFee?: number; // in cents
}

const FastEntryWallet: React.FC<FastEntryWalletProps> = ({
  walletBindingId: walletBindingIdProp = '',
  venueId,
  eventId,
  venueName = 'Venue',
  eventName = 'Event',
  entryFee = 500 // Default $5.00
}) => {
  const [fundAmount, setFundAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{ wallet_binding_id: string; recovery_code: string } | null>(null);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [showVendorPurchase, setShowVendorPurchase] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useTranslation();
  
  // Get wallet binding ID from prop or localStorage
  const walletBindingId = walletBindingIdProp || localStorage.getItem('wallet_binding_id') || '';
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('💳 [FastEntryWallet] Props received:', {
        walletBindingId,
        venueId,
        eventId,
        venueName,
        eventName,
        entryFee
      });
      console.log('💳 [FastEntryWallet] Wallet binding ID from localStorage:', localStorage.getItem('wallet_binding_id'));
    }
  }, [walletBindingId, venueId, eventId]);

  const { data: balance } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: walletApi.getBalance,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Check for recovery code in localStorage
  useEffect(() => {
    const recoveryCodeData = localStorage.getItem('wallet_recovery_code');
    if (recoveryCodeData) {
      try {
        const data = JSON.parse(recoveryCodeData);
        if (import.meta.env.DEV) {
          console.log('✅ [FastEntryWallet] Recovery code found:', data);
        }
        setRecoveryData(data);
        setShowRecoveryCode(true);
      } catch (error) {
        console.error('Failed to parse recovery code:', error);
      }
    }
  }, []);

  const fundMutation = useMutation({
    mutationFn: (amount: number) => walletApi.fund([{ source: selectedPaymentMethod, amount }]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      setShowSuccess(true);
      setFundAmount('');
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const paymentMethods = [
    { id: 'stripe', name: 'Stripe', icon: CreditCard, enabled: true },
    { id: 'apple-pay', name: 'Apple Pay', icon: CreditCard, enabled: false },
    { id: 'google-pay', name: 'Google Pay', icon: CreditCard, enabled: false },
  ];

  const currentBalance = balance?.balance_cents || 0;
  const hasEnoughBalance = currentBalance >= entryFee;
  const suggestedAmount = Math.max(entryFee - currentBalance, 0);

  const handleQuickFund = (amount: number) => {
    if (!selectedPaymentMethod) {
      // Auto-select first payment method
      setSelectedPaymentMethod(paymentMethods[0].id);
    }
    setFundAmount(amount.toFixed(2));
    setSelectedQuickAmount(amount);
  };

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (amount <= 0 || !selectedPaymentMethod) {
      return;
    }

    // For Stripe payment method, create checkout session
    if (selectedPaymentMethod === 'stripe') {
      try {
        // Check if wallet is set up
        if (!walletBindingId && !localStorage.getItem('wallet_binding_id')) {
          console.warn('Wallet not set up - no wallet_binding_id found');
          showToast(t('fastEntry.errors.walletNotSetup'), 'warning', 6000);
          return;
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        
        console.log('Creating Stripe checkout session with:', {
          amount: Math.round(amount * 100),
          wallet_binding_id: walletBindingId || localStorage.getItem('wallet_binding_id'),
          has_device_fingerprint: !!localStorage.getItem('device_fingerprint')
        });
        
        const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': localStorage.getItem('device_fingerprint') || '',
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100), // Convert to cents
            wallet_binding_id: walletBindingId || localStorage.getItem('wallet_binding_id'),
            device_fingerprint: localStorage.getItem('device_fingerprint'),
            success_url: `${window.location.origin}/#/wallet?payment=success`,
            cancel_url: `${window.location.origin}/#/wallet?payment=cancelled`,
          }),
        });

        console.log('Stripe API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Stripe checkout failed with status', response.status, ':', errorData);
          
          // Show specific error messages based on the actual error
          if (errorData.error) {
            if (errorData.error.includes('wallet_binding_id')) {
              showToast(t('fastEntry.errors.walletIdMissing'), 'warning', 6000);
            } else if (errorData.error.includes('Amount')) {
              showToast(t('fastEntry.errors.invalidAmount', { error: errorData.error }), 'error');
            } else if (errorData.error.includes('Stripe is not configured')) {
              showToast(t('fastEntry.errors.stripeNotConfigured'), 'error');
            } else if (errorData.error.includes('STRIPE_SECRET_KEY')) {
              showToast(t('fastEntry.errors.paymentConfigError'), 'error');
            } else {
              // Show the actual error message from the API
              showToast(t('fastEntry.errors.paymentError', { error: errorData.error }), 'error', 7000);
            }
          } else {
            showToast(t('fastEntry.errors.paymentSetupFailed', { status: response.status }), 'error');
          }
          return;
        }

        const data = await response.json();
        console.log('Stripe checkout session created:', data);
        
        // Redirect to Stripe Checkout
        if (data.url) {
          console.log('Redirecting to Stripe checkout:', data.url);
          window.location.href = data.url;
        } else {
          console.error('No checkout URL in response:', data);
          showToast(t('fastEntry.errors.noCheckoutUrl'), 'error');
        }
      } catch (error) {
        console.error('Stripe checkout error (caught exception):', error);
        if (error instanceof Error) {
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
          showToast(t('fastEntry.errors.paymentError', { error: error.message }), 'error', 7000);
        } else {
          showToast(t('fastEntry.errors.connectionError'), 'error');
        }
        return;
      }
    } else {
      // Use existing payment method
      fundMutation.mutate(amount);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">{t('fastEntry.title', { eventName })}</h1>
        <p className="text-cyan-400 text-sm">{t('fastEntry.venue', { venueName })}</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Recovery Code Display - Show after first wallet creation */}
      {showRecoveryCode && recoveryData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <WalletRecoveryCode
            walletBindingId={recoveryData.wallet_binding_id}
            recoveryCode={recoveryData.recovery_code}
            onDismiss={() => setShowRecoveryCode(false)}
            compact={true}
          />
        </motion.div>
      )}

      {/* Balance Status Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "p-6 rounded-xl border transition-all",
          hasEnoughBalance
            ? "bg-green-900/20 border-green-500/30"
            : "bg-slate-800/50 border-slate-700"
        )}
      >
        <div className="text-center space-y-3">
          {hasEnoughBalance ? (
            <>
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <div>
                <p className="text-green-400 font-semibold text-lg">{t('fastEntry.readyForEntry')}</p>
                <p className="text-slate-300 text-sm">{t('fastEntry.sufficientBalance')}</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-cyan-400 mx-auto" />
              <div>
                <p className="text-white font-semibold text-lg">{t('fastEntry.fundYourWallet')}</p>
                <p className="text-slate-300 text-sm">{t('fastEntry.addFundsToEnter')}</p>
              </div>
            </>
          )}
          
          <div className="pt-3 border-t border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400 text-sm">{t('fastEntry.currentBalance')}</span>
              <span className="text-white font-mono font-bold text-lg">
                ${(currentBalance / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">{t('fastEntry.entryFee')}</span>
              <span className="text-cyan-400 font-mono font-semibold">
                ${(entryFee / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Vendor Purchase Button - Always show, will prompt for funds if needed */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => setShowVendorPurchase(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500 hover:border-cyan-400 rounded-lg text-cyan-400 hover:text-cyan-300 transition-all text-sm font-medium"
          >
            <ShoppingCart className="w-4 h-4" />
            Make Purchase
          </motion.button>
        </div>
      </motion.div>

      {/* Quick Fund Buttons */}
      {!hasEnoughBalance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <p className="text-white font-medium text-center">{t('fastEntry.quickAdd')}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { amount: suggestedAmount / 100, label: 'Exact' },
              { amount: 20, label: '$20' },
              { amount: 50, label: '$50' },
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => handleQuickFund(option.amount)}
                className={cn(
                  "p-4 rounded-lg border transition-all font-semibold",
                  selectedQuickAmount === option.amount
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-400"
                    : "bg-slate-800/50 border-slate-700 text-white hover:border-cyan-400 hover:bg-cyan-500/10"
                )}
              >
                {option.label === 'Exact' ? `$${option.amount.toFixed(2)}` : option.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Payment Method Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <p className="text-white font-medium">{t('fastEntry.paymentMethod')}</p>
        <div className="grid grid-cols-3 gap-3">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.id}
                onClick={() => setSelectedPaymentMethod(method.id)}
                disabled={!method.enabled}
                className={cn(
                  "p-4 rounded-lg border transition-all flex flex-col items-center space-y-2",
                  selectedPaymentMethod === method.id
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-400"
                    : "border-slate-700 bg-slate-800/50 text-white hover:border-slate-500"
                )}
                title={!method.enabled ? t('fastEntry.comingSoon') : ''}
              >
                <Icon size={24} />
                <span className="text-sm font-medium">{t(`fastEntry.payment.${method.id}`)}</span>
                {!method.enabled && (
                  <span className="text-xs text-slate-400">{t('fastEntry.comingSoon')}</span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Custom Amount Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <p className="text-white font-medium">{t('fastEntry.customAmount')}</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-cyan-400 font-mono text-lg">
            $
          </span>
          <input
            type="number"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            placeholder={t('fastEntry.amountPlaceholder')}
            className="w-full pl-8 pr-4 py-4 text-lg bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all font-mono"
            min="0.01"
            step="0.01"
          />
        </div>
      </motion.div>

      {/* Fund Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleFund}
        disabled={!fundAmount || parseFloat(fundAmount) <= 0 || !selectedPaymentMethod || fundMutation.isPending}
        className={cn(
          "w-full py-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center space-x-2",
          !fundAmount || parseFloat(fundAmount) <= 0 || !selectedPaymentMethod
            ? "bg-slate-700/50 border border-slate-600 text-slate-500 cursor-not-allowed"
            : fundMutation.isPending
            ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 cursor-wait"
            : "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/20"
        )}
      >
        {fundMutation.isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t('fastEntry.processing')}</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>{t('fastEntry.addFunds')}</span>
          </>
        )}
      </motion.button>

      {/* Success Message */}
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-semibold">{t('fastEntry.fundsAdded')}</p>
              <p className="text-slate-300 text-sm">{t('fastEntry.walletUpdated')}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Push Notifications */}
      {walletBindingId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <PushNotificationSettings walletBindingId={walletBindingId} />
        </motion.div>
      )}

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg"
      >
        <div className="flex items-start space-x-3">
          <QrCode className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-300">
            <p className="font-medium text-cyan-400 mb-1">{t('fastEntry.fastEntryTitle')}</p>
            <p>{t('fastEntry.infoDescription')}</p>
          </div>
        </div>
      </motion.div>

      {/* Vendor Purchase Modal */}
      {showVendorPurchase && (
        <MenuBasedVendorPurchase
          venueId={venueId}
          eventId={eventId}
          onClose={() => setShowVendorPurchase(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
          }}
        />
      )}
    </div>
  );
};

export default FastEntryWallet;
