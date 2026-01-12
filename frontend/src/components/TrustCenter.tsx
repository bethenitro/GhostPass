import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Smartphone, Zap, ArrowRight, Wallet, DollarSign, Bitcoin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi } from '../lib/api';

const TrustCenter: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const queryClient = useQueryClient();

  // Mock funding sources data - in real app this would come from API
  const fundingSources = [
    { id: 'apple-pay', name: 'Apple Pay', type: 'apple-pay', enabled: true },
    { id: 'google-pay', name: 'Google Pay', type: 'google-pay', enabled: true },
    { id: 'credit-card', name: 'Credit Card', type: 'credit-card', enabled: true },
    { id: 'paypal', name: 'PayPal', type: 'paypal', enabled: true },
    { id: 'venmo', name: 'Venmo', type: 'venmo', enabled: true },
    { id: 'cash-app', name: 'Cash App', type: 'cash-app', enabled: true },
    { id: 'coinbase', name: 'Coinbase', type: 'coinbase', enabled: true },
  ];

  const fundMutation = useMutation({
    mutationFn: ({ amount, source }: { amount: number; source: string }) =>
      walletApi.fund(amount, source),
    onMutate: () => setIsProcessing(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      setAmount('');
      setSelectedSource('');
      setIsProcessing(false);
    },
    onError: () => setIsProcessing(false),
  });

  const handleFund = () => {
    if (!selectedSource || !amount || parseFloat(amount) <= 0) return;
    fundMutation.mutate({ amount: parseFloat(amount), source: selectedSource });
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'apple-pay':
        return Smartphone;
      case 'google-pay':
        return Smartphone;
      case 'credit-card':
        return CreditCard;
      case 'paypal':
        return Wallet;
      case 'venmo':
        return DollarSign;
      case 'cash-app':
        return DollarSign;
      case 'coinbase':
        return Bitcoin;
      case 'stripe':
        return CreditCard;
      case 'zelle':
        return Smartphone;
      default:
        return Zap;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">TopUp</h1>
        <p className="text-slate-400 text-sm sm:text-base">Secure funding for your wallet</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-3 sm:mt-4"></div>
      </div>

      {/* Funding Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-6"
      >
        {/* Funding Source Selection */}
        <div className="space-y-2 sm:space-y-3">
          <label className="block text-white font-medium text-sm sm:text-base">Select Funding Source</label>
          <div className="grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-7">
            {fundingSources?.map((source) => {
              const Icon = getSourceIcon(source.type);
              return (
                <button
                  key={source.id}
                  onClick={() => setSelectedSource(source.type)}
                  disabled={!source.enabled}
                  className={`p-2 sm:p-3 lg:p-4 rounded-lg border transition-all duration-300 flex flex-col items-center space-y-1 sm:space-y-2 text-center min-h-[60px] sm:min-h-[80px] lg:min-h-[90px] ${
                    selectedSource === source.type
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-lg'
                      : source.enabled
                      ? 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-500 hover:bg-slate-700/50'
                      : 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed'
                  }`}
                  style={
                    selectedSource === source.type
                      ? { filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }
                      : {}
                  }
                >
                  <Icon size={16} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  <span className="font-medium text-xs sm:text-sm leading-tight">{source.name}</span>
                  {!source.enabled && (
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-1 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount Input and Presets */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-end">
          {/* Amount Input */}
          <div className="space-y-2 sm:space-y-3">
            <label className="block text-white font-medium text-sm sm:text-base">Amount</label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-cyan-400 font-mono text-base sm:text-lg">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 sm:pl-8 pr-4 py-2.5 sm:py-3 text-base sm:text-lg bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-200 font-mono min-h-[44px] sm:min-h-[48px]"
                min="1"
                step="0.01"
              />
            </div>
          </div>
          
          {/* Preset Amounts */}
          <div className="space-y-2 sm:space-y-3">
            <label className="block text-white font-medium text-sm sm:text-base lg:opacity-0">Quick Select</label>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 100, 200].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className="text-xs sm:text-sm py-2 sm:py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600/50 hover:text-white transition-all duration-200 min-h-[36px] sm:min-h-[40px]"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fund Button */}
        <motion.button
          onClick={handleFund}
          disabled={!selectedSource || !amount || parseFloat(amount) <= 0 || isProcessing}
          className={`w-full py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all duration-300 flex items-center justify-center space-x-2 min-h-[48px] ${
            !selectedSource || !amount || parseFloat(amount) <= 0 || isProcessing
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600'
              : 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400'
          }`}
          whileTap={{ scale: 0.98 }}
          style={
            !selectedSource || !amount || parseFloat(amount) <= 0 || isProcessing
              ? {}
              : { filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }
          }
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="sm:hidden">PROCESSING</span>
              <span className="hidden sm:inline">PROCESSING...</span>
            </>
          ) : (
            <>
              <span className="sm:hidden">TRANSFER</span>
              <span className="hidden sm:inline">INITIATE TRANSFER</span>
              <ArrowRight size={18} className="sm:w-5 sm:h-5" />
            </>
          )}
        </motion.button>

        {/* Security Notice */}
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4">
          <div className="flex items-start space-x-2 sm:space-x-3">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
            <div className="text-xs sm:text-sm text-slate-300">
              <p className="font-medium text-cyan-400 mb-0.5 sm:mb-1">Secure Transfer</p>
              <p className="sm:hidden">Encrypted processing. Funds appear within 1-3 minutes.</p>
              <p className="hidden sm:block">All transactions are encrypted and processed through secure channels. Funds typically appear within 1-3 minutes.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recent Funding Activity */}
      {fundMutation.isSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
        >
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <div>
              <p className="text-emerald-400 font-medium">Transfer Initiated</p>
              <p className="text-slate-300 text-sm">Your wallet will be updated shortly</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TrustCenter;