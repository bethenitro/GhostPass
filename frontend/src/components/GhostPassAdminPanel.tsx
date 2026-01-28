import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, DollarSign, Users, BarChart3, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { walletApi } from '../lib/api';
import { cn } from '@/lib/utils';

interface GhostPassAdminPanelProps {
  onClose: () => void;
}

interface FeeDistribution {
  valid_platform: string;
  vendor: string;
  pool: string;
  promoter: string;
}

interface PlatformFeeConfig {
  fee_enabled: boolean;
  default_fee_cents: number;
  context_fees: {
    entry: number;
    bar: number;
    merch: number;
    general: number;
  };
}

const GhostPassAdminPanel: React.FC<GhostPassAdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'fees' | 'distribution' | 'payouts'>('fees');
  const [feeConfig, setFeeConfig] = useState<PlatformFeeConfig | null>(null);
  const [feeDistribution, setFeeDistribution] = useState<FeeDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fee configuration state
  const [entryFee, setEntryFee] = useState(25);
  const [barFee, setBarFee] = useState(50);
  const [merchFee, setMerchFee] = useState(75);
  const [generalFee, setGeneralFee] = useState(50);

  // Distribution state
  const [validPct, setValidPct] = useState(40);
  const [vendorPct, setVendorPct] = useState(35);
  const [poolPct, setPoolPct] = useState(15);
  const [promoterPct, setPromoterPct] = useState(10);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      
      // Fetch platform fee config
      const feeConfigData = await walletApi.getPlatformFeeConfig();
      setFeeConfig(feeConfigData);
      
      if (feeConfigData.context_fees) {
        setEntryFee(feeConfigData.context_fees.entry || 25);
        setBarFee(feeConfigData.context_fees.bar || 50);
        setMerchFee(feeConfigData.context_fees.merch || 75);
        setGeneralFee(feeConfigData.context_fees.general || 50);
      }

      // Fetch fee distribution
      const distributionData = await walletApi.getFeeDistribution();
      setFeeDistribution(distributionData.distribution);
      
      if (distributionData.distribution) {
        // Parse percentages from strings like "40%"
        setValidPct(parseInt(distributionData.distribution.valid_platform.replace('%', '')));
        setVendorPct(parseInt(distributionData.distribution.vendor.replace('%', '')));
        setPoolPct(parseInt(distributionData.distribution.pool.replace('%', '')));
        setPromoterPct(parseInt(distributionData.distribution.promoter.replace('%', '')));
      }
      
    } catch (error) {
      console.error('Failed to fetch configurations:', error);
      setMessage({ type: 'error', text: 'Failed to load configurations' });
    } finally {
      setLoading(false);
    }
  };

  const updatePlatformFee = async (context: string, feeCents: number) => {
    try {
      setSaving(true);
      await walletApi.setPlatformFee(feeCents, context);
      setMessage({ type: 'success', text: `${context} fee updated to $${(feeCents / 100).toFixed(2)}` });
      
      // Refresh config
      await fetchConfigurations();
    } catch (error) {
      console.error('Failed to update platform fee:', error);
      setMessage({ type: 'error', text: 'Failed to update platform fee' });
    } finally {
      setSaving(false);
    }
  };

  const updateFeeDistribution = async () => {
    try {
      setSaving(true);
      
      // Validate percentages add up to 100
      const total = validPct + vendorPct + poolPct + promoterPct;
      if (total !== 100) {
        setMessage({ type: 'error', text: `Percentages must add up to 100% (currently ${total}%)` });
        return;
      }

      await walletApi.setFeeDistribution(validPct, vendorPct, poolPct, promoterPct);
      setMessage({ type: 'success', text: 'Fee distribution updated successfully' });
      
      // Refresh config
      await fetchConfigurations();
    } catch (error) {
      console.error('Failed to update fee distribution:', error);
      setMessage({ type: 'error', text: 'Failed to update fee distribution' });
    } finally {
      setSaving(false);
    }
  };

  const processAllPayouts = async () => {
    try {
      setSaving(true);
      const result = await walletApi.processVendorPayouts();
      setMessage({ 
        type: 'success', 
        text: `Processed ${result.processed_count} payouts totaling ${result.total_payout}` 
      });
    } catch (error) {
      console.error('Failed to process payouts:', error);
      setMessage({ type: 'error', text: 'Failed to process vendor payouts' });
    } finally {
      setSaving(false);
    }
  };

  const renderFeeConfiguration = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entry Fee */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">Entry Fee</label>
          <div className="flex items-center space-x-3">
            <span className="text-slate-400">$</span>
            <input
              type="number"
              value={(entryFee / 100).toFixed(2)}
              onChange={(e) => setEntryFee(Math.round(parseFloat(e.target.value) * 100))}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              step="0.01"
              min="0"
              max="5.00"
            />
            <button
              onClick={() => updatePlatformFee('entry', entryFee)}
              disabled={saving}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm disabled:opacity-50"
            >
              Update
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Fee charged at entry points</p>
        </div>

        {/* Bar Fee */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">Bar Fee</label>
          <div className="flex items-center space-x-3">
            <span className="text-slate-400">$</span>
            <input
              type="number"
              value={(barFee / 100).toFixed(2)}
              onChange={(e) => setBarFee(Math.round(parseFloat(e.target.value) * 100))}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              step="0.01"
              min="0"
              max="5.00"
            />
            <button
              onClick={() => updatePlatformFee('bar', barFee)}
              disabled={saving}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm disabled:opacity-50"
            >
              Update
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Fee charged at bar areas</p>
        </div>

        {/* Merch Fee */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">Merchandise Fee</label>
          <div className="flex items-center space-x-3">
            <span className="text-slate-400">$</span>
            <input
              type="number"
              value={(merchFee / 100).toFixed(2)}
              onChange={(e) => setMerchFee(Math.round(parseFloat(e.target.value) * 100))}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              step="0.01"
              min="0"
              max="5.00"
            />
            <button
              onClick={() => updatePlatformFee('merch', merchFee)}
              disabled={saving}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm disabled:opacity-50"
            >
              Update
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Fee charged for merchandise</p>
        </div>

        {/* General Fee */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">General Fee</label>
          <div className="flex items-center space-x-3">
            <span className="text-slate-400">$</span>
            <input
              type="number"
              value={(generalFee / 100).toFixed(2)}
              onChange={(e) => setGeneralFee(Math.round(parseFloat(e.target.value) * 100))}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              step="0.01"
              min="0"
              max="5.00"
            />
            <button
              onClick={() => updatePlatformFee('general', generalFee)}
              disabled={saving}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm disabled:opacity-50"
            >
              Update
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Default fee for other interactions</p>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-medium">Platform Fee Policy</span>
        </div>
        <ul className="text-sm text-yellow-200 space-y-1">
          <li>• Fees are charged automatically on every successful interaction</li>
          <li>• Fees are independent of vendor pricing</li>
          <li>• Fees are deducted before vendor payout</li>
          <li>• All fees are itemized on user receipts</li>
        </ul>
      </div>
    </div>
  );

  const renderFeeDistribution = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* VALID Platform */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">VALID Platform</label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={validPct}
              onChange={(e) => setValidPct(parseInt(e.target.value) || 0)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
              max="100"
            />
            <span className="text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Platform revenue share</p>
        </div>

        {/* Vendor */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">Vendor</label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={vendorPct}
              onChange={(e) => setVendorPct(parseInt(e.target.value) || 0)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
              max="100"
            />
            <span className="text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Vendor revenue share</p>
        </div>

        {/* Pool */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">Pool</label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={poolPct}
              onChange={(e) => setPoolPct(parseInt(e.target.value) || 0)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
              max="100"
            />
            <span className="text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Shared pool allocation</p>
        </div>

        {/* Promoter */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-white mb-2">Promoter</label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={promoterPct}
              onChange={(e) => setPromoterPct(parseInt(e.target.value) || 0)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
              max="100"
            />
            <span className="text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Promoter revenue share</p>
        </div>
      </div>

      {/* Total Validation */}
      <div className={cn(
        "p-4 rounded-lg border",
        (validPct + vendorPct + poolPct + promoterPct) === 100
          ? "bg-green-900/20 border-green-500/30"
          : "bg-red-900/20 border-red-500/30"
      )}>
        <div className="flex items-center space-x-2">
          {(validPct + vendorPct + poolPct + promoterPct) === 100 ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span className={cn(
            "font-medium",
            (validPct + vendorPct + poolPct + promoterPct) === 100
              ? "text-green-400"
              : "text-red-400"
          )}>
            Total: {validPct + vendorPct + poolPct + promoterPct}%
          </span>
        </div>
      </div>

      <button
        onClick={updateFeeDistribution}
        disabled={saving || (validPct + vendorPct + poolPct + promoterPct) !== 100}
        className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
      >
        {saving ? 'Updating...' : 'Update Fee Distribution'}
      </button>
    </div>
  );

  const renderPayoutManagement = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Vendor Payout Processing</h3>
        
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">
            Process all pending vendor payouts based on the current fee distribution settings.
          </p>
          
          <button
            onClick={processAllPayouts}
            disabled={saving}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Processing...' : 'Process All Pending Payouts'}
          </button>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-medium">Payout Information</span>
        </div>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Payouts are calculated based on fee distribution percentages</li>
          <li>• All transactions are atomic - platform fee + vendor payout settle together</li>
          <li>• Payout processing creates audit trail entries</li>
          <li>• Vendors receive ACH transfers (configurable per vendor)</li>
        </ul>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading configurations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Ghost Pass Admin Panel</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-4 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('fees')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                activeTab === 'fees'
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Platform Fees
            </button>
            <button
              onClick={() => setActiveTab('distribution')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                activeTab === 'distribution'
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Fee Distribution
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                activeTab === 'payouts'
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Vendor Payouts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'fees' && renderFeeConfiguration()}
          {activeTab === 'distribution' && renderFeeDistribution()}
          {activeTab === 'payouts' && renderPayoutManagement()}
        </div>

        {/* Message Display */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mx-6 mb-6 p-4 rounded-lg border",
              message.type === 'success'
                ? "bg-green-900/20 border-green-500/30 text-green-400"
                : "bg-red-900/20 border-red-500/30 text-red-400"
            )}
          >
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default GhostPassAdminPanel;