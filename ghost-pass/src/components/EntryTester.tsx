/**
 * Entry Tester Component
 * 
 * Simple UI to test entry and re-entry flow with:
 * - Device fingerprint authentication
 * - Entry count tracking
 * - Fee breakdown display
 * - Entry history
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DoorOpen, Wallet, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface EntryResult {
  success: boolean;
  entry_type: 'initial' | 're_entry';
  entry_number: number;
  fees: {
    initial_entry_fee_cents: number;
    venue_reentry_fee_cents: number;
    valid_reentry_scan_fee_cents: number;
    total_fees_cents: number;
  };
  balance_before_cents: number;
  balance_after_cents: number;
  receipt_id: string;
  gateway_name: string;
  message: string;
}

interface EntryHistory {
  entry_number: number;
  entry_type: string;
  fees_paid: number;
  timestamp: string;
}

const EntryTester: React.FC = () => {
  const [walletBindingId, setWalletBindingId] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [venueId, setVenueId] = useState('test-venue-stress-001');
  const [gatewayId, setGatewayId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EntryResult | null>(null);
  const [error, setError] = useState('');
  const [entryHistory, setEntryHistory] = useState<EntryHistory[]>([]);

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillText('fingerprint', 10, 10);
      }
      const fingerprint = canvas.toDataURL();
      return btoa(fingerprint).slice(0, 32);
    };
    
    const fp = generateFingerprint();
    setDeviceFingerprint(fp);
    
    // Generate wallet binding ID from fingerprint
    setWalletBindingId(`wallet_${fp.slice(0, 8)}`);
  }, []);

  const handleEntry = async () => {
    if (!walletBindingId || !venueId || !gatewayId) {
      setError('Please fill in all fields');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/entry/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': deviceFingerprint,
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          venue_id: venueId,
          gateway_id: gatewayId,
          interaction_method: 'QR',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
        
        // Add to history
        setEntryHistory(prev => [
          {
            entry_number: data.entry_number,
            entry_type: data.entry_type,
            fees_paid: data.fees.total_fees_cents,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
      } else {
        setError(data.error || 'Entry failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg shadow-xl p-6 mb-6"
        >
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <DoorOpen className="w-8 h-8 text-cyan-400" />
            Entry & Re-Entry Tester
          </h1>
          <p className="text-gray-400 mb-6">Test venue entry and re-entry flow with fee tracking</p>

          {/* Configuration */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Wallet Binding ID
              </label>
              <input
                type="text"
                value={walletBindingId}
                onChange={(e) => setWalletBindingId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="wallet_test_1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Venue ID
              </label>
              <input
                type="text"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="test-venue-stress-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gateway ID (UUID)
              </label>
              <input
                type="text"
                value={gatewayId}
                onChange={(e) => setGatewayId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="a3970357-99ed-4d10-a77e-b88be387f05d"
              />
            </div>

            <div className="text-xs text-gray-500">
              Device Fingerprint: {deviceFingerprint}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleEntry}
            disabled={isProcessing}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Processing Entry...
              </>
            ) : (
              <>
                <DoorOpen className="w-5 h-5" />
                Process Entry
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-red-200">{error}</div>
            </motion.div>
          )}

          {/* Success Result */}
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 bg-green-900/30 border border-green-500 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <h3 className="text-xl font-bold text-green-400">
                  {result.entry_type === 'initial' ? 'Initial Entry' : 'Re-Entry'} Approved
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Entry Number</div>
                  <div className="text-white font-semibold text-lg">#{result.entry_number}</div>
                </div>

                <div>
                  <div className="text-gray-400">Entry Type</div>
                  <div className="text-white font-semibold text-lg capitalize">
                    {result.entry_type.replace('_', ' ')}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400">Balance Before</div>
                  <div className="text-white font-semibold">{formatCents(result.balance_before_cents)}</div>
                </div>

                <div>
                  <div className="text-gray-400">Balance After</div>
                  <div className="text-white font-semibold">{formatCents(result.balance_after_cents)}</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-green-700">
                <div className="text-gray-300 font-semibold mb-2">Fee Breakdown:</div>
                <div className="space-y-1 text-sm">
                  {result.fees.initial_entry_fee_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Initial Entry Fee:</span>
                      <span className="text-white">{formatCents(result.fees.initial_entry_fee_cents)}</span>
                    </div>
                  )}
                  {result.fees.venue_reentry_fee_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Venue Re-Entry Fee:</span>
                      <span className="text-white">{formatCents(result.fees.venue_reentry_fee_cents)}</span>
                    </div>
                  )}
                  {result.fees.valid_reentry_scan_fee_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">VALID Platform Fee:</span>
                      <span className="text-white">{formatCents(result.fees.valid_reentry_scan_fee_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-green-700 font-semibold">
                    <span className="text-gray-300">Total Charged:</span>
                    <span className="text-green-400">{formatCents(result.fees.total_fees_cents)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-400">
                Receipt ID: {result.receipt_id}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Entry History */}
        {entryHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-lg shadow-xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-cyan-400" />
              Entry History
            </h2>

            <div className="space-y-2">
              {entryHistory.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-white font-bold">
                      {entry.entry_number}
                    </div>
                    <div>
                      <div className="text-white font-medium capitalize">
                        {entry.entry_type.replace('_', ' ')}
                      </div>
                      <div className="text-xs text-gray-400">{entry.timestamp}</div>
                    </div>
                  </div>
                  <div className="text-cyan-400 font-semibold">
                    {formatCents(entry.fees_paid)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default EntryTester;
