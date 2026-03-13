import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield,
  CheckCircle, 
  AlertTriangle,
  ShoppingCart,
  Wallet as WalletIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';
import WalletRecoveryCode from './WalletRecoveryCode';
import { MenuBasedVendorPurchase } from './MenuBasedVendorPurchase';
import TrustCenter from './TrustCenter';

interface GhostPassWalletManagerProps {
  balance: number; // in cents
  onBalanceUpdate?: () => void;
}

interface DeviceBinding {
  wallet_binding_id: string;
  ghost_pass_token: string;
  device_bound: boolean;
  created_at: string;
}

const GhostPassWalletManager: React.FC<GhostPassWalletManagerProps> = ({
  balance,
  onBalanceUpdate
}) => {
  const { t } = useTranslation();
  
  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [deviceBinding, setDeviceBinding] = useState<DeviceBinding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{ wallet_binding_id: string; recovery_code: string } | null>(null);
  const [showVendorPurchase, setShowVendorPurchase] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallet' | 'topup'>('wallet');

  useEffect(() => {
    initializeWallet();
  }, []);

  // Check for recovery code in localStorage
  useEffect(() => {
    const recoveryCodeData = localStorage.getItem('wallet_recovery_code');
    if (recoveryCodeData) {
      try {
        const data = JSON.parse(recoveryCodeData);
        if (import.meta.env.DEV) {
          console.log('✅ [GhostPassWallet] Recovery code found:', data);
        }
        setRecoveryData(data);
        setShowRecoveryCode(true);
      } catch (error) {
        console.error('Failed to parse recovery code:', error);
      }
    }
  }, []);

  const initializeWallet = async () => {
    try {
      setLoading(true);
      await checkDeviceBinding();
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      setError(t('ghostPass.manager.failedToInitialize'));
    } finally {
      setLoading(false);
    }
  };

  const checkDeviceBinding = async () => {
    try {
      // Check if wallet exists in localStorage first
      const walletBindingId = localStorage.getItem('wallet_binding_id');
      
      if (!walletBindingId) {
        // No wallet created yet
        setDeviceBinding(null);
        return;
      }
      
      // Check if device is already bound
      const deviceFingerprint = localStorage.getItem('device_fingerprint');
      const biometricHash = localStorage.getItem('biometric_hash');
      
      if (deviceFingerprint && biometricHash) {
        const result = await walletApi.verifyDeviceBinding(deviceFingerprint, biometricHash);
        if (result.verified) {
          setDeviceBinding({
            wallet_binding_id: result.wallet_binding_id,
            ghost_pass_token: result.ghost_pass_token,
            device_bound: true,
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Device binding check failed:', error);
      // If verification fails, wallet doesn't exist yet
      setDeviceBinding(null);
    }
  };

  const bindDevice = async () => {
    try {
      setIsProcessing(true);
      
      // Generate device fingerprint and biometric hash
      const deviceFingerprint = 'device_' + Array.from({length: 20}, () => 
        Math.random().toString(36)[2] || '0'
      ).join('');
      
      const biometricHash = 'bio_' + Array.from({length: 32}, () => 
        Math.random().toString(36)[2] || '0'
      ).join('');

      const result = await walletApi.bindDevice(deviceFingerprint, biometricHash);
      
      // Store for future verification
      localStorage.setItem('device_fingerprint', deviceFingerprint);
      localStorage.setItem('biometric_hash', biometricHash);
      localStorage.setItem('wallet_binding_id', result.wallet_binding_id);
      
      setDeviceBinding({
        wallet_binding_id: result.wallet_binding_id,
        ghost_pass_token: result.ghost_pass_token,
        device_bound: result.device_bound,
        created_at: result.created_at
      });
      
    } catch (error) {
      console.error('Device binding failed:', error);
      setError(t('ghostPass.manager.failedToBindDevice'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">{t('ghostPass.manager.initializingWallet')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">{t('ghostPass.walletTitle')}</h1>
        <p className="text-cyan-400 text-sm">{t('ghostPass.walletSubtitle')}</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* No Wallet - Show Create Button */}
      {!deviceBinding && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 py-12"
        >
          <div className="w-20 h-20 mx-auto bg-cyan-500/20 rounded-full flex items-center justify-center border-2 border-cyan-500/50">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">{t('ghostPass.manager.noWalletFound')}</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              {t('ghostPass.manager.createWalletDescription')}
            </p>
          </div>

          <button
            onClick={bindDevice}
            disabled={isProcessing}
            className="px-8 py-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all transform hover:scale-105 disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('ghostPass.manager.creatingWallet')}</span>
              </div>
            ) : (
              t('ghostPass.manager.createWalletButton')
            )}
          </button>

          <div className="text-xs text-slate-500 max-w-sm mx-auto">
            <p>{t('ghostPass.manager.walletFeatures')}</p>
            <ul className="mt-2 space-y-1 text-left">
              <li>• {t('ghostPass.manager.boundToDevice')}</li>
              <li>• {t('ghostPass.manager.protectedWithProofs')}</li>
              <li>• {t('ghostPass.manager.recoverable')}</li>
              <li>• {t('ghostPass.manager.zeroCustody')}</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Wallet Exists - Show Full Interface */}
      {deviceBinding && (
        <>
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

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </motion.div>
          )}

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg"
          >
            <button
              onClick={() => setActiveTab('wallet')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === 'wallet'
                  ? "bg-cyan-600 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <WalletIcon className="w-4 h-4" />
              Wallet
            </button>
            <button
              onClick={() => setActiveTab('topup')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === 'topup'
                  ? "bg-cyan-600 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <ShoppingCart className="w-4 h-4" />
              Funding
            </button>
          </motion.div>

          {/* Wallet Tab Content */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {/* Device Binding Status */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-lg border bg-green-900/20 border-green-500/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <h3 className="font-semibold text-white">{t('ghostPass.manager.deviceBoundStatus')}</h3>
                      <p className="text-sm text-gray-400">
                        {t('ghostPass.manager.walletSecureMessage')}
                      </p>
                    </div>
                  </div>
                </div>
                
                {deviceBinding.wallet_binding_id && (
                  <div className="mt-3 p-2 bg-black/20 rounded text-xs font-mono text-cyan-400">
                    {t('ghostPass.bindingId')}: {deviceBinding.wallet_binding_id.slice(0, 16)}...
                  </div>
                )}
              </motion.div>

              {/* Balance Display */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700"
              >
                <div className="text-3xl font-bold text-white mb-2">
                  ${(balance / 100).toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">{t('ghostPass.availableBalance')}</div>
                
                {/* Vendor Purchase Button */}
                {balance > 0 && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => setShowVendorPurchase(true)}
                    className="mt-4 flex items-center justify-center gap-2 px-4 py-2 mx-auto bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500 hover:border-cyan-400 rounded-lg text-cyan-400 hover:text-cyan-300 transition-all text-sm font-medium"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Make Purchase
                  </motion.button>
                )}
              </motion.div>
            </div>
          )}

          {/* TopUp Tab Content */}
          {activeTab === 'topup' && (
            <TrustCenter />
          )}
        </>
      )}

      {/* Vendor Purchase Modal */}
      {showVendorPurchase && (
        <MenuBasedVendorPurchase
          venueId={undefined}
          eventId={undefined}
          onClose={() => setShowVendorPurchase(false)}
          onSuccess={() => {
            if (onBalanceUpdate) {
              onBalanceUpdate();
            }
          }}
        />
      )}
    </div>
  );
};

export default GhostPassWalletManager;