import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { walletApi, ghostPassApi } from '../lib/api';
import RefundModal from './RefundModal';
import GhostPassWalletManager from './GhostPassWalletManager';
import WalletRecoveryCode from './WalletRecoveryCode';
import { MenuBasedVendorPurchase } from './MenuBasedVendorPurchase';
import WalletRecovery from './WalletRecovery';
import { useToast } from './ui/toast';

interface WalletDashboardProps {
  onPurchase: (duration: number) => void;
  isPurchasing?: boolean;
  purchasingDuration?: number;
}

const WalletDashboard: React.FC<WalletDashboardProps> = ({ onPurchase: _onPurchase, isPurchasing: _isPurchasing = false, purchasingDuration: _purchasingDuration }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRefundModal, setShowRefundModal] = useState(false);

  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{ wallet_binding_id: string; recovery_code: string } | null>(null);
  const [showVendorPurchase, setShowVendorPurchase] = useState(false);
  const [showWalletRecovery, setShowWalletRecovery] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: balance } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: walletApi.getBalance,
    refetchInterval: 30000,
  });

  const { data: ghostPass, refetch } = useQuery({
    queryKey: ['ghostpass-status'],
    queryFn: ghostPassApi.getStatus,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Check for recovery code in localStorage (shown only once after wallet creation)
  useEffect(() => {
    const recoveryCodeData = localStorage.getItem('wallet_recovery_code');
    if (recoveryCodeData) {
      try {
        const data = JSON.parse(recoveryCodeData);
        if (import.meta.env.DEV) {
          console.log('✅ [WalletDashboard] Recovery code found:', data);
        }
        setRecoveryData(data);
        setShowRecoveryCode(true);
      } catch (error) {
        console.error('Failed to parse recovery code:', error);
      }
    }
  }, []);

  // Detect Stripe payment success return
  useEffect(() => {
    const hash = window.location.hash; // e.g. #/wallet?payment=success&session_id=cs_xxx
    const queryString = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
    const params = new URLSearchParams(queryString);

    if (params.get('payment') === 'success') {
      const sessionId = params.get('session_id');
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      // Clean up URL immediately
      window.history.replaceState(null, '', window.location.pathname + '#/wallet');

      const verifyAndCredit = async () => {
        try {
          if (sessionId) {
            // Verify session server-side and credit wallet if not already done
            const response = await fetch(`${API_BASE_URL}/stripe/verify-session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId }),
            });
            const data = await response.json();

            if (data.status === 'credited' || data.status === 'already_credited') {
              // Refetch balance then show toast with actual amount
              await queryClient.refetchQueries({ queryKey: ['wallet-balance'] });
              const cached = queryClient.getQueryData<{ balance_cents: number; balance_dollars: number }>(['wallet-balance']);
              const amount = cached?.balance_dollars?.toFixed(2) ?? data.balance_dollars?.toFixed(2) ?? '0.00';
              showToast(`Deposit Available $${amount} for use`, 'success', 6000);
              return;
            }
          }

          // Fallback: just refresh balance
          await queryClient.refetchQueries({ queryKey: ['wallet-balance'] });
          const cached = queryClient.getQueryData<{ balance_cents: number; balance_dollars: number }>(['wallet-balance']);
          const amount = cached?.balance_dollars?.toFixed(2) ?? '0.00';
          showToast(`Deposit Available $${amount} for use`, 'success', 6000);
        } catch (err) {
          console.error('Failed to verify Stripe session:', err);
          queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        }
      };

      verifyAndCredit();
    }
  }, [queryClient, showToast]);

  const getTimeRemaining = (expiresAt: string) => {
    const now = currentTime.getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, total: diff };
  };

  const timeRemaining = ghostPass?.expires_at ? getTimeRemaining(ghostPass.expires_at) : null;
  void timeRemaining;

  return (
    <div className="space-y-6">
      {/* Recovery Code Display - Show once after wallet creation */}
      {showRecoveryCode && recoveryData && (
        <>
          {console.log('🎫 Rendering recovery code component')}
          <WalletRecoveryCode
            walletBindingId={recoveryData.wallet_binding_id}
            recoveryCode={recoveryData.recovery_code}
            onDismiss={() => setShowRecoveryCode(false)}
            compact={false}
          />
        </>
      )}

      {showWalletRecovery && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <WalletRecovery
            onRecoverySuccess={() => {
              setShowWalletRecovery(false);
              queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
              queryClient.refetchQueries({ queryKey: ['wallet-balance'] });
            }}
            onCancel={() => setShowWalletRecovery(false)}
          />
        </div>
      )}

      {/* Ghost Pass Wallet View */}
      <GhostPassWalletManager
        balance={balance?.balance_cents || 0}
        onBalanceUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        }}
      />

      {/* Event Multi-Day WALLET View */}
      {/* Refund Modal */}
      <RefundModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        currentBalance={balance?.balance_cents || 0}
        onRefundSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        }}
      />

      {/* Vendor Purchase Modal */}
      {showVendorPurchase && (
        <MenuBasedVendorPurchase
          venueId={undefined}
          eventId={undefined}
          onClose={() => setShowVendorPurchase(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
            queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
          }}
        />
      )}
    </div>
  );
};

export default WalletDashboard;