import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Wifi, Shield, AlertTriangle, CheckCircle, Zap, Lock, Key, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GhostPassWalletProps {
  balance: number; // in cents
  deviceBound: boolean;
  walletBindingId?: string;
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

const GhostPassWallet: React.FC<GhostPassWalletProps> = ({
  balance,
  deviceBound,
  walletBindingId
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'NFC' | 'QR'>('NFC');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInteraction, setLastInteraction] = useState<any>(null);
  const [platformFeeConfig, setPlatformFeeConfig] = useState<any>(null);
  const [proofs, setProofs] = useState<CryptographicProof[]>([]);
  const [showProofs, setShowProofs] = useState(false);
  const [biometricChallenge, setBiometricChallenge] = useState<string | null>(null);

  useEffect(() => {
    // Fetch platform fee configuration and proofs
    fetchPlatformFeeConfig();
    if (deviceBound) {
      fetchUserProofs();
    }
  }, [deviceBound]);

  const fetchPlatformFeeConfig = async () => {
    try {
      const response = await fetch('/api/wallet/platform-fee-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const config = await response.json();
      setPlatformFeeConfig(config);
    } catch (error) {
      console.error('Failed to fetch platform fee config:', error);
    }
  };

  const fetchUserProofs = async () => {
    try {
      const response = await fetch('/api/wallet/proofs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setProofs(data.proofs || []);
    } catch (error) {
      console.error('Failed to fetch proofs:', error);
    }
  };

  const generateBiometricChallenge = async () => {
    try {
      const response = await fetch('/api/wallet/biometric-challenge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.status === 'SUCCESS') {
        setBiometricChallenge(data.challenge);
      }
    } catch (error) {
      console.error('Failed to generate biometric challenge:', error);
    }
  };

  const createProof = async (proofType: string, proofData: any) => {
    try {
      const response = await fetch('/api/wallet/create-proof', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proof_type: proofType,
          proof_data: proofData
        })
      });
      
      const result = await response.json();
      if (result.status === 'SUCCESS') {
        await fetchUserProofs(); // Refresh proofs
        return result;
      }
    } catch (error) {
      console.error('Failed to create proof:', error);
    }
  };

  const simulateInteraction = async (method: 'NFC' | 'QR') => {
    setIsProcessing(true);
    
    try {
      // Simulate interaction processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockInteraction = {
        method,
        timestamp: new Date().toISOString(),
        platformFee: platformFeeConfig?.context_fees?.entry || '$0.25',
        status: 'APPROVED',
        gateway: 'Main Entry',
        context: 'entry'
      };
      
      setLastInteraction(mockInteraction);
    } catch (error) {
      console.error('Interaction failed:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">GHOST PASS WALLET</h1>
        <p className="text-cyan-400 text-sm">Device-Bound • Zero Custody • Cryptographic Proofs</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Device Binding Status */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "p-4 rounded-lg border",
          deviceBound 
            ? "bg-green-900/20 border-green-500/30" 
            : "bg-red-900/20 border-red-500/30"
        )}
      >
        <div className="flex items-center gap-3">
          {deviceBound ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          )}
          <div>
            <h3 className="font-semibold text-white">
              {deviceBound ? "Device Bound" : "Device Not Bound"}
            </h3>
            <p className="text-sm text-gray-400">
              {deviceBound 
                ? "Wallet is securely bound to this device" 
                : "Bind your device to enable Ghost Pass features"
              }
            </p>
          </div>
        </div>
        
        {deviceBound && walletBindingId && (
          <div className="mt-3 p-2 bg-black/20 rounded text-xs font-mono text-cyan-400">
            Binding ID: {walletBindingId.slice(0, 16)}...
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
      </motion.div>

      {/* Cryptographic Proofs Section */}
      {deviceBound && (
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
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {showProofs && (
            <div className="space-y-2">
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
                  className="p-2 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-600/30 transition-colors"
                >
                  Add Age Proof
                </button>
                <button
                  onClick={() => createProof('medical_credential', { credential_present: true })}
                  className="p-2 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-600/30 transition-colors"
                >
                  Add Medical
                </button>
                <button
                  onClick={() => createProof('access_class', { access_class: 'VIP' })}
                  className="p-2 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-400 hover:bg-purple-600/30 transition-colors"
                >
                  Add VIP Access
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Interaction Methods */}
      {deviceBound && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">Interaction Methods</h3>
          
          {/* Method Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedMethod('NFC')}
              className={cn(
                "p-4 rounded-lg border transition-all duration-200",
                selectedMethod === 'NFC'
                  ? "bg-cyan-600/20 border-cyan-500 text-cyan-400"
                  : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <Wifi className="w-6 h-6" />
                <span className="text-sm font-medium">NFC Tap</span>
                <span className="text-xs">Preferred</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedMethod('QR')}
              className={cn(
                "p-4 rounded-lg border transition-all duration-200",
                selectedMethod === 'QR'
                  ? "bg-cyan-600/20 border-cyan-500 text-cyan-400"
                  : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <QrCode className="w-6 h-6" />
                <span className="text-sm font-medium">QR Scan</span>
              </div>
            </button>
          </div>

          {/* Simulate Interaction Button */}
          <button
            onClick={() => simulateInteraction(selectedMethod)}
            disabled={isProcessing}
            className={cn(
              "w-full p-4 rounded-lg font-semibold transition-all duration-200",
              "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500",
              "text-white shadow-lg hover:shadow-cyan-500/25",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing {selectedMethod}...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                Simulate {selectedMethod} Interaction
              </div>
            )}
          </button>

          {/* Platform Fee Info */}
          {platformFeeConfig && (
            <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="text-yellow-400 text-sm font-medium mb-1">Platform Fee</div>
              <div className="text-xs text-gray-300">
                Entry: {platformFeeConfig.context_fees?.entry} • 
                Bar: {platformFeeConfig.context_fees?.bar} • 
                Merch: {platformFeeConfig.context_fees?.merch}
              </div>
            </div>
          )}
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
      {deviceBound && (
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
            className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-gray-300 hover:border-gray-500 transition-colors"
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
    </div>
  );
};

export default GhostPassWallet;