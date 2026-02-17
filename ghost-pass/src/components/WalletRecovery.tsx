/**
 * Wallet Recovery Component
 * 
 * Allows users to recover their wallet on a new device using:
 * - Wallet ID
 * - Recovery Code
 * 
 * Also provides access to Operator Portal for venue/event administrators
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Loader2, CheckCircle, AlertTriangle, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface WalletRecoveryProps {
  onRecoverySuccess: () => void;
  onCancel: () => void;
  onOperatorPortal?: () => void;
}

const WalletRecovery: React.FC<WalletRecoveryProps> = ({ onRecoverySuccess, onCancel, onOperatorPortal }) => {
  const { t } = useTranslation();
  const [walletId, setWalletId] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRecover = async () => {
    if (!walletId.trim() || !recoveryCode.trim()) {
      setError(t('walletRecovery.enterBothFields'));
      return;
    }

    setIsRecovering(true);
    setError('');

    try {
      // Call recovery API endpoint
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/wallet/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': localStorage.getItem('device_fingerprint') || '',
        },
        body: JSON.stringify({
          wallet_binding_id: walletId.trim(),
          recovery_code: recoveryCode.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('walletRecovery.recoveryFailed'));
      }

      await response.json();

      // Store the recovered wallet session
      const newDeviceFingerprint = localStorage.getItem('device_fingerprint');
      const walletSession = {
        session_id: `session_${Date.now()}`,
        wallet_binding_id: walletId.trim(),
        device_fingerprint: newDeviceFingerprint,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        fast_entry: false,
        recovered: true,
        recovered_at: new Date().toISOString(),
      };

      localStorage.setItem('ghost_pass_wallet_session', JSON.stringify(walletSession));

      setSuccess(true);
      setTimeout(() => {
        onRecoverySuccess();
      }, 1500);
    } catch (error) {
      console.error('Recovery error:', error);
      setError(error instanceof Error ? error.message : t('walletRecovery.checkCredentials'));
    } finally {
      setIsRecovering(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/95 backdrop-blur-xl border border-green-500/30 rounded-xl p-8 max-w-md w-full"
      >
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto"
          >
            <CheckCircle className="w-8 h-8 text-green-400" />
          </motion.div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{t('walletRecovery.walletRecovered')}</h3>
            <p className="text-slate-300">{t('walletRecovery.walletRestoredSuccessfully')}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-8 max-w-md w-full"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-cyan-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('walletRecovery.recoverWallet')}</h2>
        <p className="text-slate-400">{t('walletRecovery.enterCredentials')}</p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Wallet ID Input */}
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium">{t('walletRecovery.walletId')}</label>
          <input
            type="text"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            placeholder="wallet_xxxxxxxxxxxxx"
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all font-mono text-sm"
            disabled={isRecovering}
          />
        </div>

        {/* Recovery Code Input */}
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium">{t('walletRecovery.recoveryCode')}</label>
          <input
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder={t('walletRecovery.enterCredentials')}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all font-mono text-sm"
            disabled={isRecovering}
          />
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
          >
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Info */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
          <p className="text-cyan-400 text-xs">
            💡 {t('walletRecovery.importantDescription')}
          </p>
        </div>

        {/* Operator Portal Access */}
        {onOperatorPortal && (
          <div className="border-t border-slate-700 pt-4 mt-2">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3">
              <p className="text-amber-400 text-xs font-medium mb-1">
                {t('walletRecovery.venueAdministrator')}
              </p>
              <p className="text-amber-300/80 text-xs">
                {t('walletRecovery.accessOperatorPortal')}
              </p>
            </div>
            <button
              onClick={onOperatorPortal}
              className="w-full px-4 py-3 bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded-lg font-medium hover:bg-amber-500/30 transition-all flex items-center justify-center space-x-2"
            >
              <Building2 className="w-4 h-4" />
              <span>{t('walletRecovery.openOperatorPortal')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isRecovering}
            className="px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 disabled:bg-slate-800/50 disabled:cursor-not-allowed border border-slate-600 rounded-lg text-slate-300 font-medium transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleRecover}
            disabled={isRecovering || !walletId.trim() || !recoveryCode.trim()}
            className={cn(
              "px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2",
              isRecovering || !walletId.trim() || !recoveryCode.trim()
                ? "bg-slate-700/50 border border-slate-600 text-slate-500 cursor-not-allowed"
                : "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
            )}
          >
            {isRecovering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('walletRecovery.recovering')}</span>
              </>
            ) : (
              <>
                <span>{t('walletRecovery.recover')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default WalletRecovery;
