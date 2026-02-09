/**
 * Wallet Recovery Code Component
 * 
 * Displays and manages the wallet recovery code for cross-device access.
 * Recovery code is generated automatically and allows users to access their
 * wallet from any device using: Wallet ID + Recovery Code
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Copy, Download, Eye, EyeOff, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface WalletRecoveryCodeProps {
  walletBindingId: string;
  recoveryCode: string;
  onDismiss?: () => void;
  compact?: boolean;
}

const WalletRecoveryCode: React.FC<WalletRecoveryCodeProps> = ({
  walletBindingId,
  recoveryCode,
  onDismiss,
  compact = false
}) => {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Check if user has already saved the recovery code
  useEffect(() => {
    const savedCodes = localStorage.getItem('wallet_recovery_codes_saved');
    if (savedCodes) {
      try {
        const codes = JSON.parse(savedCodes);
        if (codes.includes(walletBindingId)) {
          setSaved(true);
        }
      } catch (error) {
        console.error('Failed to parse saved codes:', error);
      }
    }
  }, [walletBindingId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Wallet ID: ${walletBindingId}\nRecovery Code: ${recoveryCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    const content = `GHOSTPASS WALLET RECOVERY
    
⚠️ KEEP THIS SAFE - DO NOT SHARE ⚠️

Wallet ID: ${walletBindingId}
Recovery Code: ${recoveryCode}

Use these credentials to recover your wallet on any device.

Instructions:
1. Open GhostPass on your new device
2. Click "Recover Wallet" 
3. Enter your Wallet ID and Recovery Code
4. Your wallet and funds will be restored

Generated: ${new Date().toLocaleString()}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostpass-recovery-${walletBindingId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    markAsSaved();
  };

  const markAsSaved = () => {
    setSaved(true);
    const savedCodes = localStorage.getItem('wallet_recovery_codes_saved');
    let codes = [];
    if (savedCodes) {
      try {
        codes = JSON.parse(savedCodes);
      } catch (error) {
        codes = [];
      }
    }
    if (!codes.includes(walletBindingId)) {
      codes.push(walletBindingId);
      localStorage.setItem('wallet_recovery_codes_saved', JSON.stringify(codes));
    }
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3"
      >
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-400 font-medium text-sm mb-1">Backup Your Wallet</p>
            <p className="text-slate-300 text-xs mb-2">
              Save your Wallet ID and recovery code to access your wallet from any device
            </p>
            {/* Show Wallet ID in compact mode */}
            <div className="bg-slate-900/50 border border-slate-700 rounded px-2 py-1 mb-2">
              <p className="text-[10px] text-slate-400 mb-0.5">Wallet ID</p>
              <p className="text-cyan-400 font-mono text-xs break-all">{walletBindingId}</p>
            </div>
            {/* Show Recovery Code in compact mode */}
            <div className="bg-slate-900/50 border border-slate-700 rounded px-2 py-1 mb-2">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] text-slate-400">Recovery Code</p>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="p-0.5 hover:bg-slate-700 rounded transition-colors text-slate-400"
                >
                  {showCode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-cyan-400 font-mono text-xs break-all">
                {showCode ? recoveryCode : '••••••••••••••••••••'}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleDownload}
                className="flex items-center space-x-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-400 text-xs font-medium transition-all"
              >
                <Download className="w-3 h-3" />
                <span>Save</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-lg text-slate-300 text-xs font-medium transition-all"
              >
                {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
          {onDismiss && saved && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Wallet Recovery</h3>
            <p className="text-slate-400 text-sm">Backup your wallet access</p>
          </div>
        </div>
        {saved && (
          <div className="flex items-center space-x-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Saved</span>
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-300">
            <p className="font-medium text-amber-400 mb-1">Important: Save Your Recovery Code</p>
            <p>
              Your wallet is device-bound. Use this recovery code to access your funds from any device.
              Keep it safe and never share it with anyone.
            </p>
          </div>
        </div>
      </div>

      {/* Wallet ID */}
      <div className="space-y-2">
        <label className="text-slate-400 text-sm font-medium">Wallet ID</label>
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-cyan-400 font-mono text-sm break-all">{walletBindingId}</p>
        </div>
      </div>

      {/* Recovery Code */}
      <div className="space-y-2">
        <label className="text-slate-400 text-sm font-medium">Recovery Code</label>
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-cyan-400 font-mono text-sm">
              {showCode ? recoveryCode : '••••••••••••••••••••'}
            </p>
            <button
              onClick={() => setShowCode(!showCode)}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400"
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-400 font-medium transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-lg text-slate-300 font-medium transition-all"
        >
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Instructions */}
      <div className="text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">To recover your wallet:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Open GhostPass on your new device</li>
          <li>Click "Recover Wallet"</li>
          <li>Enter your Wallet ID and Recovery Code</li>
          <li>Your wallet and funds will be restored</li>
        </ol>
      </div>
    </motion.div>
  );
};

export default WalletRecoveryCode;
