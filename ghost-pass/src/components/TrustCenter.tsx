import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Smartphone, Zap, ArrowRight, Wallet, DollarSign, Bitcoin, Check, X, ArrowLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi } from '../lib/api';

interface SourceAmount {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  amount: string;
}

const TrustCenter: React.FC = () => {
  const [selectedSources, setSelectedSources] = useState<Map<string, SourceAmount>>(new Map());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const queryClient = useQueryClient();

  // Mock funding sources data - in real app this would come from API
  const fundingSources = [
    { id: 'stripe', name: 'Stripe', type: 'stripe', enabled: true },
    { id: 'apple-pay', name: 'Apple Pay', type: 'apple-pay', enabled: false },
    { id: 'google-pay', name: 'Google Pay', type: 'google-pay', enabled: false },
    { id: 'paypal', name: 'PayPal', type: 'paypal', enabled: false },
    { id: 'venmo', name: 'Venmo', type: 'venmo', enabled: false },
    { id: 'cash-app', name: 'Cash App', type: 'cash-app', enabled: false },
    { id: 'zelle', name: 'Zelle', type: 'zelle', enabled: false },
    { id: 'coinbase', name: 'Coinbase', type: 'coinbase', enabled: false },
  ];

  const fundMutation = useMutation({
    mutationFn: (sources: Array<{ source: string; amount: number }>) =>
      walletApi.fund(sources),
    onMutate: () => setIsProcessing(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      setSelectedSources(new Map());
      setShowConfirmation(false);
      setIsProcessing(false);
    },
    onError: () => setIsProcessing(false),
  });

  const toggleSource = (source: typeof fundingSources[0]) => {
    const newSources = new Map(selectedSources);
    if (newSources.has(source.id)) {
      newSources.delete(source.id);
    } else {
      newSources.set(source.id, {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        amount: ''
      });
    }
    setSelectedSources(newSources);
  };

  const updateSourceAmount = (sourceId: string, amount: string) => {
    const newSources = new Map(selectedSources);
    const source = newSources.get(sourceId);
    if (source) {
      source.amount = amount;
      newSources.set(sourceId, source);
      setSelectedSources(newSources);
    }
  };

  const getTotalAmount = () => {
    return Array.from(selectedSources.values()).reduce((sum, source) => {
      const amount = parseFloat(source.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const isValidForConfirmation = () => {
    if (selectedSources.size === 0) return false;
    const total = getTotalAmount();
    if (total <= 0) return false;
    // Check that all selected sources have valid amounts
    return Array.from(selectedSources.values()).every(s => parseFloat(s.amount) > 0);
  };

  const handleShowConfirmation = () => {
    if (isValidForConfirmation()) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmFund = async () => {
    // Check if Stripe is selected
    const stripeSource = Array.from(selectedSources.values()).find(s => s.sourceType === 'stripe');
    
    if (stripeSource) {
      // Use Stripe Checkout for Stripe payments
      try {
        const amount = parseFloat(stripeSource.amount);
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        
        const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': localStorage.getItem('device_fingerprint') || '',
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100), // Convert to cents
            wallet_binding_id: localStorage.getItem('wallet_binding_id'),
            device_fingerprint: localStorage.getItem('device_fingerprint'),
            success_url: `${window.location.origin}/#/wallet?payment=success`,
            cancel_url: `${window.location.origin}/#/trust?payment=cancelled`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Stripe checkout failed:', errorData);
          throw new Error('Payment setup failed');
        }

        const data = await response.json();
        
        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('Payment setup failed');
        }
      } catch (error) {
        console.error('Stripe checkout error:', error);
        alert('Payment setup failed. Please try again or contact support.');
        setIsProcessing(false);
      }
    } else {
      // Use existing payment method for non-Stripe sources
      const sources = Array.from(selectedSources.values()).map(s => ({
        source: s.sourceType,
        amount: parseFloat(s.amount)
      }));
      fundMutation.mutate(sources);
    }
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

      <AnimatePresence mode="wait">
        {!showConfirmation ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Funding Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-6"
            >
              {/* Funding Source Selection */}
              <div className="space-y-2 sm:space-y-3">
                <label className="block text-white font-medium text-sm sm:text-base">
                  Select Funding Sources (Multiple Allowed)
                </label>
                <div className="grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-7">
                  {fundingSources?.map((source) => {
                    const Icon = getSourceIcon(source.type);
                    const isSelected = selectedSources.has(source.id);
                    return (
                      <button
                        key={source.id}
                        onClick={() => toggleSource(source)}
                        disabled={!source.enabled}
                        className={`p-2 sm:p-3 lg:p-4 rounded-lg border transition-all duration-300 flex flex-col items-center space-y-1 sm:space-y-2 text-center min-h-[60px] sm:min-h-[80px] lg:min-h-[90px] relative ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-lg'
                            : source.enabled
                            ? 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-500 hover:bg-slate-700/50'
                            : 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed'
                        }`}
                        style={
                          isSelected
                            ? { filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }
                            : {}
                        }
                      >
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-slate-900" />
                          </div>
                        )}
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

              {/* Amount Inputs for Selected Sources */}
              {selectedSources.size > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  <label className="block text-white font-medium text-sm sm:text-base">
                    Enter Amount for Each Source
                  </label>
                  <div className="space-y-2 sm:space-y-3">
                    {Array.from(selectedSources.values()).map((source) => (
                      <div key={source.sourceId} className="flex items-center gap-2 sm:gap-3">
                        <div className="flex-shrink-0 w-20 sm:w-24 text-slate-300 text-xs sm:text-sm font-medium truncate">
                          {source.sourceName}
                        </div>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 font-mono text-sm sm:text-base">
                            $
                          </span>
                          <input
                            type="number"
                            value={source.amount}
                            onChange={(e) => updateSourceAmount(source.sourceId, e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-6 sm:pl-7 pr-3 py-2 sm:py-2.5 text-sm sm:text-base bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-200 font-mono"
                            min="0.01"
                            step="0.01"
                          />
                        </div>
                        <button
                          onClick={() => toggleSource(fundingSources.find(s => s.id === source.sourceId)!)}
                          className="flex-shrink-0 p-2 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Amount Display */}
              {selectedSources.size > 0 && (
                <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-3 sm:p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium text-sm sm:text-base">Total Amount:</span>
                    <span className="text-cyan-400 font-bold text-lg sm:text-xl font-mono">
                      ${getTotalAmount().toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-400 mt-1">
                    From {selectedSources.size} source{selectedSources.size !== 1 ? 's' : ''}
                  </div>
                </div>
              )}

              {/* Continue Button */}
              <motion.button
                onClick={handleShowConfirmation}
                disabled={!isValidForConfirmation()}
                className={`w-full py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all duration-300 flex items-center justify-center space-x-2 min-h-[48px] ${
                  !isValidForConfirmation()
                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600'
                    : 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400'
                }`}
                whileTap={{ scale: 0.98 }}
                style={
                  !isValidForConfirmation()
                    ? {}
                    : { filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }
                }
              >
                <span>CONTINUE TO CONFIRMATION</span>
                <ArrowRight size={18} className="sm:w-5 sm:h-5" />
              </motion.button>

              {/* Security Notice */}
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                  <div className="text-xs sm:text-sm text-slate-300">
                    <p className="font-medium text-cyan-400 mb-0.5 sm:mb-1">No Limits</p>
                    <p className="sm:hidden">Enter any amount. Multiple sources supported.</p>
                    <p className="hidden sm:block">Enter any amount you need. You can combine multiple funding sources with different amounts for each.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Confirmation Screen */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-6"
            >
              <div className="text-center">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Confirm Transfer</h2>
                <p className="text-slate-400 text-sm">Review your funding details</p>
              </div>

              {/* Source Breakdown */}
              <div className="space-y-2 sm:space-y-3">
                <label className="block text-white font-medium text-sm sm:text-base">Funding Breakdown</label>
                <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-3 sm:p-4 space-y-2">
                  {Array.from(selectedSources.values()).map((source) => {
                    const Icon = getSourceIcon(source.sourceType);
                    return (
                      <div key={source.sourceId} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Icon size={16} className="text-cyan-400 sm:w-5 sm:h-5" />
                          <span className="text-slate-300 text-sm sm:text-base">{source.sourceName}</span>
                        </div>
                        <span className="text-white font-mono font-medium text-sm sm:text-base">
                          ${parseFloat(source.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 sm:p-5">
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold text-base sm:text-lg">Total Transfer:</span>
                  <span className="text-cyan-400 font-bold text-xl sm:text-2xl font-mono">
                    ${getTotalAmount().toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <motion.button
                  onClick={() => setShowConfirmation(false)}
                  disabled={isProcessing}
                  className="py-3 sm:py-4 rounded-lg font-bold text-sm sm:text-base border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white transition-all duration-300 flex items-center justify-center space-x-2"
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowLeft size={16} className="sm:w-5 sm:h-5" />
                  <span>BACK</span>
                </motion.button>

                <motion.button
                  onClick={handleConfirmFund}
                  disabled={isProcessing}
                  className={`py-3 sm:py-4 rounded-lg font-bold text-sm sm:text-base transition-all duration-300 flex items-center justify-center space-x-2 ${
                    isProcessing
                      ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600'
                      : 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400'
                  }`}
                  whileTap={{ scale: 0.98 }}
                  style={
                    isProcessing
                      ? {}
                      : { filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }
                  }
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>PROCESSING</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} className="sm:w-5 sm:h-5" />
                      <span>CONFIRM</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Warning */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 sm:p-4">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                  <div className="text-xs sm:text-sm text-slate-300">
                    <p className="font-medium text-amber-400 mb-0.5 sm:mb-1">Confirm Before Proceeding</p>
                    <p>This action will initiate transfers from all selected sources. Please verify the amounts are correct.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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