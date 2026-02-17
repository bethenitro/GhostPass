import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Wifi, Shield, AlertTriangle, CheckCircle, Zap, Lock, Key, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import GhostPassWalletPersistence from './GhostPassWalletPersistence';
import GhostPassEntryManager from './GhostPassEntryManager';

interface GhostPassWalletProps {
  balance: number; // in cents
  deviceBound: boolean;
  walletBindingId?: string;
  venueId?: string;
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

const GhostPassWallet: React.FC<GhostPassWalletProps> = ({
  balance,
  deviceBound,
  walletBindingId,
  venueId,
  onBalanceUpdate
}) => {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<'NFC' | 'QR'>('NFC');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInteraction, setLastInteraction] = useState<any>(null);
  const [platformFeeConfig, setPlatformFeeConfig] = useState<any>(null);
  const [proofs, setProofs] = useState<CryptographicProof[]>([]);
  const [showProofs, setShowProofs] = useState(false);
  const [biometricChallenge, setBiometricChallenge] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'wallet' | 'entry' | 'persistence'>('wallet');
  const [currentBrightness, setCurrentBrightness] = useState<number>(100);

  useEffect(() => {
    // Fetch platform fee configuration and proofs
    fetchPlatformFeeConfig();
    if (deviceBound) {
      fetchUserProofs();
    }
    
    // Auto-adjust brightness for QR codes in low light
    if (selectedMethod === 'QR') {
      adjustBrightnessForQR();
    }
  }, [deviceBound, selectedMethod]);

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

  const adjustBrightnessForQR = async () => {
    try {
      // Detect ambient light level (if supported)
      if ('AmbientLightSensor' in window) {
        const sensor = new (window as any).AmbientLightSensor();
        sensor.addEventListener('reading', () => {
          const lightLevel = sensor.illuminance;
          // Adjust brightness based on ambient light
          const targetBrightness = lightLevel < 10 ? 100 : Math.max(75, 100 - (lightLevel / 10));
          setCurrentBrightness(Math.round(targetBrightness));
        });
        sensor.start();
      } else {
        // Fallback: assume low light conditions and use maximum brightness
        setCurrentBrightness(100);
      }
      
      // Apply brightness control
      if (walletBindingId) {
        await fetch('/api/ghost-pass/entry/qr/brightness', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            wallet_binding_id: walletBindingId,
            brightness_level: currentBrightness
          })
        });
      }
    } catch (error) {
      console.error('Failed to adjust brightness for QR:', error);
    }
  };

  const simulateInteraction = async (method: 'NFC' | 'QR') => {
    setIsProcessing(true);
    
    try {
      // For QR codes, ensure maximum brightness
      if (method === 'QR') {
        await adjustBrightnessForQR();
      }
      
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
      
      if (onBalanceUpdate) {
        onBalanceUpdate();
      }
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
        return `${t('ghostPass.ageVerified')}: ${proof.verified ? t('ghostPass.yes') : t('ghostPass.no')}`;
      case 'medical_credential': 
        return `${t('ghostPass.medicalCredential')}: ${proof.credential_present ? t('ghostPass.present') : t('ghostPass.notPresent')}`;
      case 'access_class': 
        return `${t('ghostPass.accessClass')}: ${proof.access_class || t('ghostPass.ga')}`;
      default: 
        return t('ghostPass.unknownProof');
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
        <h1 className="text-2xl font-bold text-white mb-2">{t('ghostPass.walletTitle')}</h1>
        <p className="text-cyan-400 text-sm">{t('ghostPass.walletSubtitle')}</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('wallet')}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
            activeTab === 'wallet'
              ? "bg-cyan-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          {t('ghostPass.walletTab')}
        </button>
        <button
          onClick={() => setActiveTab('entry')}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
            activeTab === 'entry'
              ? "bg-cyan-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          {t('ghostPass.entryTab')}
        </button>
        <button
          onClick={() => setActiveTab('persistence')}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
            activeTab === 'persistence'
              ? "bg-cyan-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          {t('ghostPass.persistenceTab')}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
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
                  {deviceBound ? t('ghostPass.deviceBound') : t('ghostPass.deviceNotBound')}
                </h3>
                <p className="text-sm text-gray-400">
                  {deviceBound 
                    ? t('ghostPass.walletSecure')
                    : t('ghostPass.bindDevice')
                  }
                </p>
              </div>
            </div>
            
            {deviceBound && walletBindingId && (
              <div className="mt-3 p-2 bg-black/20 rounded text-xs font-mono text-cyan-400">
                {t('ghostPass.bindingId')}: {walletBindingId.slice(0, 16)}...
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
                  {t('ghostPass.cryptographicProofs')}
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
                      className="p-2 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-600/30 transition-colors"
                    >
                      {t('ghostPass.addAgeProof')}
                    </button>
                    <button
                      onClick={() => createProof('medical_credential', { credential_present: true })}
                      className="p-2 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-600/30 transition-colors"
                    >
                      {t('ghostPass.addMedical')}
                    </button>
                    <button
                      onClick={() => createProof('access_class', { access_class: 'VIP' })}
                      className="p-2 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-400 hover:bg-purple-600/30 transition-colors"
                    >
                      {t('ghostPass.addVIPAccess')}
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
              <h3 className="text-lg font-semibold text-white">{t('ghostPass.interactionMethods')}</h3>
              
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
                    <span className="text-sm font-medium">{t('ghostPass.nfcTap')}</span>
                    <span className="text-xs">{t('ghostPass.preferred')}</span>
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
                    <span className="text-sm font-medium">{t('ghostPass.qrScan')}</span>
                    {selectedMethod === 'QR' && (
                      <span className="text-xs">{t('ghostPass.brightness')}: {currentBrightness}%</span>
                    )}
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
                    {t('ghostPass.processing', { method: selectedMethod })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    {t('ghostPass.simulateInteraction', { method: selectedMethod })}
                  </div>
                )}
              </button>

              {/* Platform Fee Info */}
              {platformFeeConfig && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <div className="text-yellow-400 text-sm font-medium mb-1">{t('ghostPass.platformFee')}</div>
                  <div className="text-xs text-gray-300">
                    {t('ghostPass.entry')}: {platformFeeConfig.context_fees?.entry} • 
                    {t('ghostPass.bar')}: {platformFeeConfig.context_fees?.bar} • 
                    {t('ghostPass.merch')}: {platformFeeConfig.context_fees?.merch}
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
          {deviceBound && (
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
                className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-gray-300 hover:border-gray-500 transition-colors"
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
        </div>
      )}

      {/* Entry Management Tab */}
      {activeTab === 'entry' && venueId && walletBindingId && (
        <GhostPassEntryManager
          venueId={venueId}
          walletBindingId={walletBindingId}
          onEntryComplete={(result) => {
            setLastInteraction({
              method: result.interaction_method || 'QR',
              timestamp: new Date().toISOString(),
              platformFee: `$${(result.total_fee_cents / 100).toFixed(2)}`,
              status: result.status,
              gateway: 'Entry Gateway',
              context: 'entry'
            });
            if (onBalanceUpdate) {
              onBalanceUpdate();
            }
          }}
        />
      )}

      {/* Wallet Persistence Tab */}
      {activeTab === 'persistence' && walletBindingId && (
        <GhostPassWalletPersistence
          walletBindingId={walletBindingId}
          venueId={venueId}
          onPersistenceUpdate={(config) => {
            console.log('Persistence config updated:', config);
          }}
        />
      )}
    </div>
  );
};

export default GhostPassWallet;