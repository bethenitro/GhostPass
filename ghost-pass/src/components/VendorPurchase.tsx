import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Percent, Check, X, Loader2 } from 'lucide-react';
import { useToast } from './ui/toast';

interface VendorPurchaseProps {
  itemAmount: number;
  itemName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TIP_PRESETS = [
  { label: '10%', value: 10 },
  { label: '15%', value: 15 },
  { label: '20%', value: 20 },
  { label: '25%', value: 25 },
];

export const VendorPurchase: React.FC<VendorPurchaseProps> = ({
  itemAmount,
  itemName,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [selectedTipPercent, setSelectedTipPercent] = useState<number>(15);
  const [customTipPercent, setCustomTipPercent] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const tipPercent = isCustom ? parseFloat(customTipPercent) || 0 : selectedTipPercent;
  const tipAmount = (itemAmount * tipPercent) / 100;
  const finalTotal = itemAmount + tipAmount;

  const handleTipSelect = (percent: number) => {
    setSelectedTipPercent(percent);
    setIsCustom(false);
    setCustomTipPercent('');
  };

  const handleCustomTip = (value: string) => {
    // Only allow numbers and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomTipPercent(value);
      setIsCustom(true);
    }
  };

  const handlePurchase = async (method: 'QR' | 'NFC') => {
    setIsProcessing(true);
    try {
      const walletBindingId = localStorage.getItem('wallet_binding_id');
      const deviceFingerprint = localStorage.getItem('device_fingerprint');

      if (!walletBindingId || !deviceFingerprint) {
        showToast('Wallet not found. Please refresh the page.', 'error');
        return;
      }

      const response = await fetch('/api/vendor/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': deviceFingerprint,
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          item_id: 'manual_entry', // For manual entry
          gateway_id: 'pos_terminal_01',
          quantity: 1,
          item_amount_cents: Math.round(itemAmount * 100),
          tip_amount_cents: Math.round(tipAmount * 100),
          tip_percent: tipPercent,
          interaction_method: method,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        showToast(data.error || 'Purchase failed', 'error');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      showToast('Purchase failed. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <div className="bg-slate-900 border border-emerald-500 rounded-2xl p-8 max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center"
          >
            <Check className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
          <p className="text-slate-400 mb-4">Receipt recorded</p>
          <div className="text-3xl font-bold text-emerald-400">
            ${finalTotal.toFixed(2)}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Complete Purchase</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Item Details */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400">{itemName}</span>
              <span className="text-white font-semibold">${itemAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Tip Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Add Tip
            </label>
            
            {/* Preset Tips */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {TIP_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleTipSelect(preset.value)}
                  className={`py-3 px-2 rounded-lg border-2 transition-all ${
                    !isCustom && selectedTipPercent === preset.value
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Tip */}
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={customTipPercent}
                onChange={(e) => handleCustomTip(e.target.value)}
                onFocus={() => setIsCustom(true)}
                placeholder="Custom %"
                className={`w-full px-4 py-3 bg-slate-800/50 border-2 rounded-lg text-white placeholder-slate-500 focus:outline-none transition-all ${
                  isCustom
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700'
                }`}
              />
              <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Total Breakdown */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>${itemAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tip ({tipPercent.toFixed(1)}%)</span>
              <span>${tipAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="flex justify-between text-white font-bold text-lg">
                <span>Total</span>
                <span className="text-cyan-400">${finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handlePurchase('QR')}
              disabled={isProcessing}
              className="w-full py-4 bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  <span>QR Scan to Pay</span>
                </>
              )}
            </button>

            <button
              onClick={() => handlePurchase('NFC')}
              disabled={isProcessing}
              className="w-full py-4 bg-purple-500/20 border-2 border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  <span>NFC Tap to Pay</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
