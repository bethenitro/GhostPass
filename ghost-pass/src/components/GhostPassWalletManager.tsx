import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  Key, 
  Eye, 
  EyeOff,
  CheckCircle, 
  AlertTriangle,
  ShoppingCart
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';
import GhostPassInteractionSimulator from './GhostPassInteractionSimulator';
import WalletRecoveryCode from './WalletRecoveryCode';
import { MenuBasedVendorPurchase } from './MenuBasedVendorPurchase';

interface GhostPassWalletManagerProps {
  balance: number; // in cents
  onBalanceUpdate?: () => void;
}

interface CryptographicProof {
  proof_id: string;
  proof_type: 'age_verified' | 'medical_credential' | 'access_class';
  verified?: boolean;
  credential_present?: boolean;
  access_class?: 'GA' | 'VIP' | 'STAFF';
  created_at: string;
  is_verified: boolean;
}

interface DeviceBinding {
  wallet_binding_id: string;
  ghost_pass_token: string;
  device_bound: boolean;
  created_at: string;
}

interface InteractionResult {
  method: 'NFC' | 'QR';
  timestamp: string;
  platformFee: string;
  status: 'APPROVED' | 'DENIED';
  gateway: string;
  context: string;
  receipt?: any;
}

const GhostPassWalletManager: React.FC<GhostPassWalletManagerProps> = ({
  balance,
  onBalanceUpdate
}) => {
  const { t } = useTranslation();
  
  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [deviceBinding, setDeviceBinding] = useState<DeviceBinding | null>(null);
  const [proofs, setProofs] = useState<CryptographicProof[]>([]);
  const [platformFeeConfig, setPlatformFeeConfig] = useState<any>(null);
  const [lastInteraction, setLastInteraction] = useState<InteractionResult | null>(null);
  const [biometricChallenge, setBiometricChallenge] = useState<string | null>(null);
  const [showProofs, setShowProofs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{ wallet_binding_id: string; recovery_code: string } | null>(null);
  const [showVendorPurchase, setShowVendorPurchase] = useState(false);

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
      await Promise.all([
        fetchPlatformFeeConfig(),
        checkDeviceBinding(),
        fetchUserProofs()
      ]);
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      setError(t('ghostPass.manager.failedToInitialize'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformFeeConfig = async () => {
    try {
      const config = await walletApi.getPlatformFeeConfig();
      setPlatformFeeConfig(config);
    } catch (error) {
      console.error('Failed to fetch platform fee config:', error);
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

  const fetchUserProofs = async () => {
    try {
      if (deviceBinding) {
        const data = await walletApi.getUserProofs();
        setProofs(data.proofs || []);
      }
    } catch (error) {
      console.error('Failed to fetch proofs:', error);
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
      
      setDeviceBinding({
        wallet_binding_id: result.wallet_binding_id,
        ghost_pass_token: result.ghost_pass_token,
        device_bound: result.device_bound,
        created_at: result.created_at
      });

      // Fetch proofs after binding
      await fetchUserProofs();
      
    } catch (error) {
      console.error('Device binding failed:', error);
      setError(t('ghostPass.manager.failedToBindDevice'));
    } finally {
      setIsProcessing(false);
    }
  };

  const generateBiometricChallenge = async () => {
    try {
      const result = await walletApi.generateBiometricChallenge();
      if (result.status === 'SUCCESS') {
        setBiometricChallenge(result.challenge);
      }
    } catch (error) {
      console.error('Failed to generate biometric challenge:', error);
    }
  };

  const createProof = async (proofType: string, proofData: any) => {
    try {
      setIsProcessing(true);
      const result = await walletApi.createProof(proofType, proofData);
      
      if (result.status === 'SUCCESS') {
        await fetchUserProofs(); // Refresh proofs
        return result;
      }
    } catch (error) {
      console.error('Failed to create proof:', error);
      setError(t('ghostPass.manager.failedToCreateProof'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getProofIcon = (proofType: string) => {
    switch (proofType) {
      case 'age_verified': return <CheckCircle className="w-4 h-4" />;
      case 'medical_credential': return <Shield className="w-4 h-4" />;
      case 'access_class': return <Key className="w-4 h-4" />;
      default: return <Lock className="w-4 h-4" />;
    }
  };

  const getProofLabel = (proof: CryptographicProof) => {
    switch (proof.proof_type) {
      case 'age_verified': 
        return `${t('ghostPass.ageVerified')}: ${proof.verified ? t('ghostPass.yes') : t('ghostPass.no')}`;
      case 'medical_credential': 
        return `${t('ghostPass.medicalCredential')}: ${proof.credential_present ? t('ghostPass.present') : t('ghostPass.notPresent')}`;
      case 'access_class': 
        return `${t('ghostPass.accessClass')}: ${proof.access_class || t('ghostPass.ga')}`;
      default: 
        return t('ghostPass.unknownProof');
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
        
        {/* Platform Fee Info */}
        {platformFeeConfig && (
          <div className="mt-3 text-xs text-slate-400">
            {t('ghostPass.manager.platformFees')}: {t('ghostPass.entry')} ${((platformFeeConfig.context_fees?.entry || 25) / 100).toFixed(2)} • 
            {t('ghostPass.bar')} ${((platformFeeConfig.context_fees?.bar || 50) / 100).toFixed(2)} • 
            {t('ghostPass.merch')} ${((platformFeeConfig.context_fees?.merch || 75) / 100).toFixed(2)}
          </div>
        )}
      </motion.div>

      {/* Cryptographic Proofs Section */}
      {deviceBinding?.device_bound && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              {t('ghostPass.cryptographicProofs')}
            </h3>
            <button
              onClick={() => setShowProofs(!showProofs)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {showProofs ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence>
            {showProofs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {proofs.length === 0 ? (
                  <div className="p-4 bg-gray-800/50 rounded-lg text-center text-gray-400">
                    {t('ghostPass.noProofsFound')}
                  </div>
                ) : (
                  proofs.map((proof) => (
                    <div
                      key={proof.proof_id}
                      className="p-3 bg-gray-800/30 rounded-lg border border-gray-700 flex items-center gap-3"
                    >
                      <div className="text-cyan-400">
                        {getProofIcon(proof.proof_type)}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">
                          {getProofLabel(proof)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {t('ghostPass.created')}: {new Date(proof.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        proof.is_verified ? "bg-green-400" : "bg-red-400"
                      )} />
                    </div>
                  ))
                )}

                {/* Quick Proof Creation Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button
                    onClick={() => createProof('age_verified', { verified: true })}
                    disabled={isProcessing}
                    className="p-2 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                  >
                    {t('ghostPass.addAgeProof')}
                  </button>
                  <button
                    onClick={() => createProof('medical_credential', { credential_present: true })}
                    disabled={isProcessing}
                    className="p-2 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                  >
                    {t('ghostPass.addMedical')}
                  </button>
                  <button
                    onClick={() => createProof('access_class', { access_class: 'VIP' })}
                    disabled={isProcessing}
                    className="p-2 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                  >
                    {t('ghostPass.addVIPAccess')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Interaction Methods */}
      {deviceBinding?.device_bound && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">{t('ghostPass.manager.ghostPassInteractions')}</h3>
          
          <GhostPassInteractionSimulator
            deviceBound={deviceBinding.device_bound}
            walletBalance={balance}
            onInteractionComplete={(result) => {
              setLastInteraction(result);
              if (onBalanceUpdate) {
                onBalanceUpdate();
              }
            }}
          />
        </motion.div>
      )}

      {/* Last Interaction */}
      {lastInteraction && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-medium">{t('ghostPass.lastInteraction')}</span>
          </div>
          <div className="text-sm text-gray-300 space-y-1">
            <div>{t('ghostPass.method')}: {lastInteraction.method}</div>
            <div>{t('ghostPass.gateway')}: {lastInteraction.gateway}</div>
            <div>{t('ghostPass.platformFee')}: {lastInteraction.platformFee}</div>
            <div>{t('ghostPass.status')}: {lastInteraction.status}</div>
            <div className="text-xs text-gray-400">
              {new Date(lastInteraction.timestamp).toLocaleString()}
            </div>
          </div>
        </motion.div>
      )}

      {/* Biometric Challenge Section */}
      {deviceBinding?.device_bound && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            {t('ghostPass.biometricVerification')}
          </h3>
          
          <button
            onClick={generateBiometricChallenge}
            disabled={isProcessing}
            className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-gray-300 hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {t('ghostPass.generateChallenge')}
          </button>

          {biometricChallenge && (
            <div className="p-3 bg-black/20 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">{t('ghostPass.challenge')}:</div>
              <div className="text-xs font-mono text-cyan-400 break-all">
                {biometricChallenge}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Security Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">{t('ghostPass.manager.securityFeatures')}</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">{t('ghostPass.manager.noRawIdData')}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">{t('ghostPass.manager.noMedicalDocs')}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">{t('ghostPass.manager.noCreditCards')}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">{t('ghostPass.manager.cryptographicProofsOnly')}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">{t('ghostPass.manager.realTimeRevocation')}</span>
          </div>
        </div>
      </motion.div>

      {/* Audit Trail Note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="text-center text-xs text-slate-400"
      >
        {t('ghostPass.manager.auditTrailNote')}
      </motion.div>
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