import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap, ArrowLeftRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { walletApi, ghostPassApi } from '../lib/api';
import type { PassPurchaseOption } from '../types';
import { cn } from '@/lib/utils';
import RefundModal from './RefundModal';

interface WalletDashboardProps {
  onPurchase: (duration: number) => void;
  isPurchasing?: boolean;
  purchasingDuration?: number;
}

const WalletDashboard: React.FC<WalletDashboardProps> = ({ onPurchase, isPurchasing = false, purchasingDuration }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRefundModal, setShowRefundModal] = useState(false);
  const queryClient = useQueryClient();

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

  const purchaseOptions: PassPurchaseOption[] = [
    { duration: 1, price: 10, label: '1 Day' },
    { duration: 3, price: 20, label: '3 Days' },
    { duration: 7, price: 50, label: '7 Days' },
  ];

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
  const isExpiringSoon = timeRemaining && timeRemaining.total < 3600000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">GHOSTPASS WALLET</h1>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto"></div>
      </motion.div>

      {/* Wallet Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 sm:p-6 lg:p-8 text-center"
      >
        <div className="text-xs uppercase tracking-widest text-slate-400 font-medium mb-4">Current Balance</div>
        <motion.div
          key={balance?.balance_dollars}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-cyan-400 font-mono"
        >
          ${balance?.balance_dollars?.toFixed(2) || '0.00'}
        </motion.div>

        {/* Refund Button */}
        {balance && balance.balance_cents > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => setShowRefundModal(true)}
            className="mt-8 mx-auto w-fit flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 hover:border-slate-500 rounded-lg text-slate-300 hover:text-white transition-all text-sm font-medium"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Request Refund
          </motion.button>
        )}
      </motion.div>

      {/* Ghost Pass Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className={cn(
          "bg-slate-800/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6",
          isExpiringSoon ? "border-red-500/50" : "border-slate-700"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Zap className="text-cyan-400" size={20} />
              <span className="text-base sm:text-lg font-semibold text-white">GHOST PASS</span>
            </div>
            <div className={cn(
              "px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border",
              ghostPass?.status === 'ACTIVE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            )}>
              {ghostPass?.status === 'ACTIVE' ? 'ACTIVE' : 'EXPIRED'}
            </div>
          </div>

          {ghostPass?.status === 'ACTIVE' && timeRemaining && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Clock size={14} className="text-slate-400" />
                <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Time Remaining</span>
              </div>
              <motion.div
                key={`${timeRemaining.hours}:${timeRemaining.minutes}:${timeRemaining.seconds}`}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className={cn(
                  "text-2xl sm:text-3xl font-bold font-mono",
                  isExpiringSoon ? 'text-red-400' : 'text-cyan-400'
                )}
              >
                {String(timeRemaining.hours).padStart(2, '0')}:
                {String(timeRemaining.minutes).padStart(2, '0')}:
                {String(timeRemaining.seconds).padStart(2, '0')}
              </motion.div>
              {ghostPass.venue_name && (
                <p className="text-slate-400 text-sm">
                  Active at: <span className="text-cyan-400">{ghostPass.venue_name}</span>
                </p>
              )}
            </div>
          )}

          {ghostPass?.status !== 'ACTIVE' && (
            <p className="text-slate-400 text-center">No active pass</p>
          )}
        </div>
      </motion.div>

      {/* Purchase Options - Holographic Tickets */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-white text-center">Purchase Ghost Pass</h2>
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          {purchaseOptions.map((option, index) => (
            <motion.div
              key={option.duration}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={cn(
                "bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 sm:p-6 cursor-pointer transition-all duration-300 hover:bg-cyan-500/10 hover:border-cyan-500/50",
                isPurchasing && purchasingDuration === option.duration && "bg-cyan-500/20 border-cyan-400"
              )}
              onClick={() => !isPurchasing && onPurchase(option.duration)}
            >
              <div className="flex items-center justify-between sm:flex-col sm:items-center sm:text-center sm:space-y-4 lg:flex-col lg:items-center lg:text-center lg:space-y-4">
                <div className="flex-1 sm:flex-none lg:flex-none">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                    {option.label}
                  </h3>
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">Full venue access</p>
                </div>

                <div className="flex items-center space-x-4 sm:flex-col sm:space-x-0 sm:space-y-2 lg:flex-col lg:space-x-0 lg:space-y-2">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono">
                      ${option.price}
                    </div>
                    <div className="text-slate-400 text-sm font-mono">
                      ${(option.price / option.duration).toFixed(2)}/day
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    disabled={isPurchasing || (balance?.balance_dollars || 0) < option.price}
                    className={cn(
                      "py-2 px-4 sm:w-full sm:py-3 lg:w-full lg:py-3 rounded-lg font-semibold transition-all duration-300 text-sm sm:text-base min-h-[44px]",
                      isPurchasing && purchasingDuration === option.duration
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 opacity-75 cursor-not-allowed'
                        : (balance?.balance_dollars || 0) < option.price
                          ? 'bg-slate-700/50 border border-slate-600 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30'
                    )}
                  >
                    {isPurchasing && purchasingDuration === option.duration ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">PROCESSING...</span>
                        <span className="sm:hidden">...</span>
                      </div>
                    ) : (balance?.balance_dollars || 0) < option.price ? (
                      <>
                        <span className="hidden sm:inline lg:inline">INSUFFICIENT BALANCE</span>
                        <span className="sm:hidden lg:hidden">LOW BALANCE</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline lg:inline">PURCHASE PASS</span>
                        <span className="sm:hidden lg:hidden">BUY</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}        </div>
      </div>

      {/* Refund Modal */}
      <RefundModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        currentBalance={balance?.balance_cents || 0}
        onRefundSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        }}
      />
    </div>
  );
};

export default WalletDashboard;
