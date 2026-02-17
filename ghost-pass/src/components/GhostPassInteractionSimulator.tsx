import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Wifi, 
  QrCode, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Shield,
  AlertTriangle
} from 'lucide-react';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';

interface GhostPassInteractionSimulatorProps {
  deviceBound: boolean;
  walletBalance: number; // in cents
  onInteractionComplete?: (result: any) => void;
}

interface SimulationResult {
  method: 'NFC' | 'QR';
  status: 'APPROVED' | 'DENIED';
  timestamp: string;
  platformFee: number;
  gateway: string;
  context: string;
  receipt?: any;
  error?: string;
}

const GhostPassInteractionSimulator: React.FC<GhostPassInteractionSimulatorProps> = ({
  deviceBound,
  walletBalance,
  onInteractionComplete
}) => {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<'NFC' | 'QR'>('NFC');
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [platformFeeConfig, setPlatformFeeConfig] = useState<any>(null);
  const [selectedContext, setSelectedContext] = useState<'entry' | 'bar' | 'merch' | 'general'>('entry');
  const [selectedGateway, setSelectedGateway] = useState('demo_gateway_001');

  useEffect(() => {
    fetchPlatformFeeConfig();
  }, []);

  const fetchPlatformFeeConfig = async () => {
    try {
      const config = await walletApi.getPlatformFeeConfig();
      setPlatformFeeConfig(config);
    } catch (error) {
      console.error('Failed to fetch platform fee config:', error);
    }
  };

  const simulateInteraction = async () => {
    if (!deviceBound) {
      setSimulationResult({
        method: selectedMethod,
        status: 'DENIED',
        timestamp: new Date().toISOString(),
        platformFee: 0,
        gateway: selectedGateway,
        context: selectedContext,
        error: 'Device not bound'
      });
      return;
    }

    setIsProcessing(true);
    setSimulationResult(null);

    try {
      // Calculate expected platform fee
      const expectedFee = platformFeeConfig?.context_fees?.[selectedContext] || 50;
      
      // Check if user has sufficient balance
      if (walletBalance < expectedFee) {
        setSimulationResult({
          method: selectedMethod,
          status: 'DENIED',
          timestamp: new Date().toISOString(),
          platformFee: expectedFee,
          gateway: selectedGateway,
          context: selectedContext,
          error: `Insufficient balance. Required: $${(expectedFee / 100).toFixed(2)}, Available: $${(walletBalance / 100).toFixed(2)}`
        });
        setIsProcessing(false);
        return;
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process atomic transaction
      const result = await walletApi.processAtomicTransaction(
        0, // No item cost, just platform fee
        selectedGateway,
        selectedContext
      );

      if (result.status === 'SUCCESS') {
        const simulationResult: SimulationResult = {
          method: selectedMethod,
          status: 'APPROVED',
          timestamp: new Date().toISOString(),
          platformFee: expectedFee,
          gateway: selectedGateway,
          context: selectedContext,
          receipt: result.receipt
        };

        setSimulationResult(simulationResult);
        
        if (onInteractionComplete) {
          onInteractionComplete(simulationResult);
        }
      } else {
        setSimulationResult({
          method: selectedMethod,
          status: 'DENIED',
          timestamp: new Date().toISOString(),
          platformFee: expectedFee,
          gateway: selectedGateway,
          context: selectedContext,
          error: result.message || 'Transaction failed'
        });
      }

    } catch (error) {
      console.error('Interaction simulation failed:', error);
      setSimulationResult({
        method: selectedMethod,
        status: 'DENIED',
        timestamp: new Date().toISOString(),
        platformFee: platformFeeConfig?.context_fees?.[selectedContext] || 50,
        gateway: selectedGateway,
        context: selectedContext,
        error: 'System error during interaction'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getContextLabel = (context: string) => {
    switch (context) {
      case 'entry': return t('ghostPassInteractionSimulator.entryPoint');
      case 'bar': return t('ghostPassInteractionSimulator.barArea');
      case 'merch': return t('ghostPassInteractionSimulator.merchandise');
      case 'general': return t('ghostPassInteractionSimulator.general');
      default: return context;
    }
  };

  const getContextFee = (context: string) => {
    return platformFeeConfig?.context_fees?.[context] || 50;
  };

  return (
    <div className="space-y-6">
      {/* Method Selection */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">{t('ghostPassInteractionSimulator.interactionMethod')}</h3>
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
              <span className="text-sm font-medium">{t('ghostPassInteractionSimulator.nfcTap')}</span>
              <span className="text-xs">{t('ghostPassInteractionSimulator.preferred')}</span>
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
              <span className="text-sm font-medium">{t('ghostPassInteractionSimulator.qrScan')}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Context Selection */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">{t('ghostPassInteractionSimulator.interactionContext')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {(['entry', 'bar', 'merch', 'general'] as const).map((context) => (
            <button
              key={context}
              onClick={() => setSelectedContext(context)}
              className={cn(
                "p-3 rounded-lg border text-sm transition-all duration-200",
                selectedContext === context
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="font-medium">{getContextLabel(context)}</span>
                <span className="text-xs">
                  ${(getContextFee(context) / 100).toFixed(2)} {t('ghostPassInteractionSimulator.fee')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Gateway Selection */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">{t('ghostPassInteractionSimulator.gateway')}</h3>
        <select
          value={selectedGateway}
          onChange={(e) => setSelectedGateway(e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
        >
          <option value="demo_gateway_001">Demo Gateway 001</option>
          <option value="demo_gateway_002">Demo Gateway 002</option>
          <option value="demo_gateway_003">Demo Gateway 003</option>
        </select>
      </div>

      {/* Transaction Preview */}
      {platformFeeConfig && (
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-600">
          <h4 className="text-sm font-medium text-white mb-3">{t('ghostPassInteractionSimulator.transactionPreview')}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('ghostPassInteractionSimulator.method')}:</span>
              <span className="text-white">{selectedMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('ghostPassInteractionSimulator.context')}:</span>
              <span className="text-white">{getContextLabel(selectedContext)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('ghostPassInteractionSimulator.platformFee')}:</span>
              <span className="text-cyan-400">${(getContextFee(selectedContext) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('ghostPassInteractionSimulator.availableBalance')}:</span>
              <span className={cn(
                walletBalance >= getContextFee(selectedContext) ? "text-green-400" : "text-red-400"
              )}>
                ${(walletBalance / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Button */}
      <button
        onClick={simulateInteraction}
        disabled={isProcessing || !deviceBound}
        className={cn(
          "w-full p-4 rounded-lg font-semibold transition-all duration-200",
          "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500",
          "text-white shadow-lg hover:shadow-cyan-500/25",
          (isProcessing || !deviceBound) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t('ghostPassInteractionSimulator.processingInteraction', { method: selectedMethod })}
          </div>
        ) : !deviceBound ? (
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            {t('ghostPassInteractionSimulator.deviceBindingRequired')}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            {t('ghostPassInteractionSimulator.simulateInteraction', { method: selectedMethod })}
          </div>
        )}
      </button>

      {/* Processing Animation */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-6 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  {selectedMethod === 'NFC' ? (
                    <Wifi className="w-6 h-6 text-blue-400" />
                  ) : (
                    <QrCode className="w-6 h-6 text-blue-400" />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-blue-400 font-medium">{t('ghostPassInteractionSimulator.processingInteraction', { method: selectedMethod })}</p>
                <p className="text-blue-300 text-sm">{t('ghostPassInteractionSimulator.validatingCredentials')}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Display */}
      <AnimatePresence>
        {simulationResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-lg border",
              simulationResult.status === 'APPROVED'
                ? "bg-green-900/20 border-green-500/30"
                : "bg-red-900/20 border-red-500/30"
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              {simulationResult.status === 'APPROVED' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <div>
                <h4 className={cn(
                  "font-semibold",
                  simulationResult.status === 'APPROVED' ? "text-green-400" : "text-red-400"
                )}>
                  {simulationResult.status === 'APPROVED' ? t('ghostPassInteractionSimulator.interactionApproved') : t('ghostPassInteractionSimulator.interactionDenied')}
                </h4>
                <p className="text-sm text-gray-400">
                  {simulationResult.method} • {getContextLabel(simulationResult.context)}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{t('ghostPassInteractionSimulator.gateway')}:</span>
                <span className="text-white">{simulationResult.gateway}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('ghostPass.platformFee')}:</span>
                <span className="text-cyan-400">${(simulationResult.platformFee / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('auditTrail.table.timestamp')}:</span>
                <span className="text-white">
                  {new Date(simulationResult.timestamp).toLocaleString()}
                </span>
              </div>
              
              {simulationResult.error && (
                <div className="mt-3 p-2 bg-red-900/30 rounded text-red-300 text-xs">
                  {simulationResult.error}
                </div>
              )}

              {simulationResult.receipt && (
                <div className="mt-3 p-3 bg-black/20 rounded">
                  <h5 className="text-xs font-medium text-gray-400 mb-2">{t('history.digitalReceipt')}</h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>{t('history.transactionId')}:</span>
                      <span className="font-mono">{simulationResult.receipt.transaction_id?.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('ghostPassInteractionSimulator.balanceAfter')}:</span>
                      <span>{simulationResult.receipt.wallet_balance_after}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSimulationResult(null)}
              className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
            >
              Clear Result
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device Binding Warning */}
      {!deviceBound && (
        <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-medium text-sm">{t('ghostPassInteractionSimulator.deviceBindingRequired')}</span>
          </div>
          <p className="text-yellow-200 text-xs">
            {t('ghostPassInteractionSimulator.bindDeviceToEnable')}
          </p>
        </div>
      )}
    </div>
  );
};

export default GhostPassInteractionSimulator;