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
  Settings
} from 'lucide-react';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';
import GhostPassAdminPanel from './GhostPassAdminPanel';
import GhostPassInteractionSimulator from './GhostPassInteractionSimulator';

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
  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [deviceBinding, setDeviceBinding] = useState<DeviceBinding | null>(null);
  const [proofs, setProofs] = useState<CryptographicProof[]>([]);
  const [platformFeeConfig, setPlatformFeeConfig] = useState<any>(null);
  const [lastInteraction, setLastInteraction] = useState<InteractionResult | null>(null);
  const [biometricChallenge, setBiometricChallenge] = useState<string | null>(null);
  const [showProofs, setShowProofs] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeWallet();
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
      setError('Failed to initialize Ghost Pass wallet');
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
      setError('Failed to bind device. Please try again.');
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
      setError('Failed to create cryptographic proof');
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
        return `Age Verified: ${proof.verified ? 'Yes' : 'No'}`;
      case 'medical_credential': 
        return `Medical Credential: ${proof.credential_present ? 'Present' : 'Not Present'}`;
      case 'access_class': 
        return `Access Class: ${proof.access_class || 'GA'}`;
      default: 
        return 'Unknown Proof';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Initializing Ghost Pass Wallet...</p>
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
        <div className="flex items-center justify-center space-x-4 mb-2">
          <h1 className="text-2xl font-bold text-white">GHOST PASS WALLET</h1>
          <button
            onClick={() => setShowAdminPanel(true)}
            className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Admin Panel"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
        <p className="text-cyan-400 text-sm">Device-Bound • Zero Custody • Cryptographic Proofs</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

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
        className={cn(
          "p-4 rounded-lg border",
          deviceBinding?.device_bound 
            ? "bg-green-900/20 border-green-500/30" 
            : "bg-red-900/20 border-red-500/30"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {deviceBinding?.device_bound ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <h3 className="font-semibold text-white">
                {deviceBinding?.device_bound ? "Device Bound" : "Device Not Bound"}
              </h3>
              <p className="text-sm text-gray-400">
                {deviceBinding?.device_bound 
                  ? "Wallet is securely bound to this device" 
                  : "Bind your device to enable Ghost Pass features"
                }
              </p>
            </div>
          </div>
          
          {!deviceBinding?.device_bound && (
            <button
              onClick={bindDevice}
              disabled={isProcessing}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
            >
              {isProcessing ? 'Binding...' : 'Bind Device'}
            </button>
          )}
        </div>
        
        {deviceBinding?.device_bound && deviceBinding.wallet_binding_id && (
          <div className="mt-3 p-2 bg-black/20 rounded text-xs font-mono text-cyan-400">
            Binding ID: {deviceBinding.wallet_binding_id.slice(0, 16)}...
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
        <div className="text-sm text-gray-400">Available Balance</div>
        
        {/* Platform Fee Info */}
        {platformFeeConfig && (
          <div className="mt-3 text-xs text-slate-400">
            Platform fees: Entry ${((platformFeeConfig.context_fees?.entry || 25) / 100).toFixed(2)} • 
            Bar ${((platformFeeConfig.context_fees?.bar || 50) / 100).toFixed(2)} • 
            Merch ${((platformFeeConfig.context_fees?.merch || 75) / 100).toFixed(2)}
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
              Cryptographic Proofs
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
                    No cryptographic proofs found
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
                          Created: {new Date(proof.created_at).toLocaleDateString()}
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
                    Add Age Proof
                  </button>
                  <button
                    onClick={() => createProof('medical_credential', { credential_present: true })}
                    disabled={isProcessing}
                    className="p-2 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                  >
                    Add Medical
                  </button>
                  <button
                    onClick={() => createProof('access_class', { access_class: 'VIP' })}
                    disabled={isProcessing}
                    className="p-2 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                  >
                    Add VIP Access
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
          <h3 className="text-lg font-semibold text-white">Ghost Pass Interactions</h3>
          
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
            <span className="text-green-400 font-medium">Last Interaction</span>
          </div>
          <div className="text-sm text-gray-300 space-y-1">
            <div>Method: {lastInteraction.method}</div>
            <div>Gateway: {lastInteraction.gateway}</div>
            <div>Platform Fee: {lastInteraction.platformFee}</div>
            <div>Status: {lastInteraction.status}</div>
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
            Biometric Verification
          </h3>
          
          <button
            onClick={generateBiometricChallenge}
            disabled={isProcessing}
            className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-gray-300 hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            Generate Biometric Challenge
          </button>

          {biometricChallenge && (
            <div className="p-3 bg-black/20 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Challenge (expires in 5 minutes):</div>
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
        <h3 className="text-lg font-semibold text-white mb-4">Security Features</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">No raw ID data stored</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">No medical documents stored</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">No credit card numbers stored</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">Cryptographic proofs only</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-slate-300">Real-time revocation support</span>
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
        All interactions logged to audit trail • Platform fees itemized on receipts
      </motion.div>

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <GhostPassAdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
};

export default GhostPassWalletManager;