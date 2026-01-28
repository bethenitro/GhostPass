import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  Ban, 
  CheckCircle, 
  Clock,
  Key
} from 'lucide-react';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';

interface GhostPassRevocationManagerProps {
  ghostPassToken?: string;
  walletBindingId?: string;
  onRevocationComplete?: (result: any) => void;
}

interface RevocationResult {
  status: 'success' | 'error';
  revocation_id?: string;
  message: string;
  timestamp: string;
}

const GhostPassRevocationManager: React.FC<GhostPassRevocationManagerProps> = ({
  ghostPassToken,
  walletBindingId,
  onRevocationComplete
}) => {
  const [isRevoking, setIsRevoking] = useState(false);
  const [revocationResult, setRevocationResult] = useState<RevocationResult | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleRevocation = async () => {
    if (!ghostPassToken) {
      setRevocationResult({
        status: 'error',
        message: 'No Ghost Pass token available for revocation',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!revocationReason.trim()) {
      setRevocationResult({
        status: 'error',
        message: 'Revocation reason is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsRevoking(true);
    setRevocationResult(null);

    try {
      const result = await walletApi.revokeGhostPass(ghostPassToken, revocationReason);
      
      if (result.status === 'revoked') {
        const successResult: RevocationResult = {
          status: 'success',
          revocation_id: result.revocation_id,
          message: `Ghost Pass successfully revoked. Revocation ID: ${result.revocation_id}`,
          timestamp: result.revoked_at
        };
        
        setRevocationResult(successResult);
        
        if (onRevocationComplete) {
          onRevocationComplete(successResult);
        }
      } else {
        setRevocationResult({
          status: 'error',
          message: result.message || 'Revocation failed',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Revocation failed:', error);
      setRevocationResult({
        status: 'error',
        message: 'System error during revocation. Please try again.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsRevoking(false);
      setShowConfirmation(false);
    }
  };

  const resetRevocation = () => {
    setRevocationResult(null);
    setRevocationReason('');
    setShowConfirmation(false);
  };

  if (!ghostPassToken) {
    return (
      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-600">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-medium text-sm">No Active Ghost Pass</span>
        </div>
        <p className="text-gray-400 text-xs">
          No Ghost Pass token is currently available for revocation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-white">Ghost Pass Revocation</h3>
      </div>

      {/* Current Token Info */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-600">
        <h4 className="text-sm font-medium text-white mb-3">Current Ghost Pass</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Token:</span>
            <span className="text-white font-mono text-xs">
              {ghostPassToken.slice(0, 16)}...
            </span>
          </div>
          {walletBindingId && (
            <div className="flex justify-between">
              <span className="text-slate-400">Binding ID:</span>
              <span className="text-white font-mono text-xs">
                {walletBindingId.slice(0, 16)}...
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="text-green-400">Active</span>
          </div>
        </div>
      </div>

      {/* Revocation Form */}
      {!revocationResult && !showConfirmation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Revocation Reason
            </label>
            <textarea
              value={revocationReason}
              onChange={(e) => setRevocationReason(e.target.value)}
              placeholder="Enter reason for revocation (required)"
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-slate-400 mt-1">
              {revocationReason.length}/500 characters
            </div>
          </div>

          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!revocationReason.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            Revoke Ghost Pass
          </button>
        </motion.div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && !revocationResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg"
        >
          <div className="flex items-center gap-2 mb-3">
            <Ban className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Confirm Revocation</span>
          </div>
          
          <div className="space-y-3 text-sm">
            <p className="text-red-200">
              Are you sure you want to revoke this Ghost Pass? This action cannot be undone.
            </p>
            
            <div className="p-3 bg-black/20 rounded">
              <div className="text-xs text-slate-400 mb-1">Reason:</div>
              <div className="text-white">{revocationReason}</div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-medium text-xs">Revocation Effects</span>
              </div>
              <ul className="text-yellow-200 text-xs space-y-1">
                <li>• Immediate effect on all tap interactions</li>
                <li>• Immediate effect on all QR scan interactions</li>
                <li>• Propagates to all vendors and entry points</li>
                <li>• Cannot be reversed once completed</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevocation}
                disabled={isRevoking}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
              >
                {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Processing State */}
      {isRevoking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-400" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-red-400 font-medium">Revoking Ghost Pass</p>
              <p className="text-red-300 text-sm">Propagating revocation across all systems...</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Result Display */}
      {revocationResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-lg border",
            revocationResult.status === 'success'
              ? "bg-green-900/20 border-green-500/30"
              : "bg-red-900/20 border-red-500/30"
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            {revocationResult.status === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <h4 className={cn(
                "font-semibold",
                revocationResult.status === 'success' ? "text-green-400" : "text-red-400"
              )}>
                {revocationResult.status === 'success' ? 'Revocation Successful' : 'Revocation Failed'}
              </h4>
              <p className="text-sm text-gray-400">
                {new Date(revocationResult.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className={cn(
              revocationResult.status === 'success' ? "text-green-200" : "text-red-200"
            )}>
              {revocationResult.message}
            </p>
            
            {revocationResult.revocation_id && (
              <div className="p-2 bg-black/20 rounded">
                <div className="text-xs text-gray-400">Revocation ID:</div>
                <div className="font-mono text-xs text-white">
                  {revocationResult.revocation_id}
                </div>
              </div>
            )}

            {revocationResult.status === 'success' && (
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 font-medium text-xs">Propagation Status</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-blue-200">NFC Tap:</span>
                    <span className="text-green-400">Immediate</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">QR Scan:</span>
                    <span className="text-green-400">Immediate</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Vendors:</span>
                    <span className="text-green-400">Immediate</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Entry Points:</span>
                    <span className="text-green-400">Immediate</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={resetRevocation}
            className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
          >
            Close
          </button>
        </motion.div>
      )}

      {/* Security Notice */}
      <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-medium text-xs">Security Notice</span>
        </div>
        <ul className="text-blue-200 text-xs space-y-1">
          <li>• Revocation is immediate and cannot be undone</li>
          <li>• All interactions with this token will be denied</li>
          <li>• Audit trail maintains complete revocation history</li>
          <li>• New Ghost Pass can be created after revocation</li>
        </ul>
      </div>
    </div>
  );
};

export default GhostPassRevocationManager;