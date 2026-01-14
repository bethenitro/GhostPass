import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Shield, DollarSign, Users, Database, FileText, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import AdminSetupCheck from './AdminSetupCheck';
import type {
  AdminDashboard,
  FeeConfigUpdate,
  ScanFeeUpdate,
  GhostPassPricingUpdate,
  PayoutAction,
  RetentionOverride
} from '@/types';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToGatewayManager: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-panel border-red-500/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 md:p-4 text-left hover:bg-red-500/5 transition-colors"
      >
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="text-red-400 flex-shrink-0">{icon}</div>
          <h3 className="text-base md:text-lg font-semibold text-red-400">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronDown className="text-red-400 flex-shrink-0" size={18} />
        ) : (
          <ChevronRight className="text-red-400 flex-shrink-0" size={18} />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 md:px-4 md:pb-4 border-t border-red-500/20">
          {children}
        </div>
      )}
    </div>
  );
};

const CommandCenter: React.FC<CommandCenterProps> = ({ isOpen, onClose, onNavigateToGatewayManager }) => {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetupCheck, setShowSetupCheck] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null); // Track which setting is being updated

  // Fee Configuration State
  const [feeConfig, setFeeConfig] = useState<FeeConfigUpdate>({
    valid_pct: 30,
    vendor_pct: 30,
    pool_pct: 30,
    promoter_pct: 10
  });

  // Scan Fee State
  const [scanFee, setScanFee] = useState<ScanFeeUpdate>({
    venue_id: '',
    fee_cents: 10
  });

  // GhostPass Pricing State
  const [pricing, setPricing] = useState<GhostPassPricingUpdate>({
    one_day_cents: 1000,
    three_day_cents: 2000,
    seven_day_cents: 5000
  });

  // Retention Override State
  const [retention, setRetention] = useState<RetentionOverride>({
    retention_days: 60,
    justification: ''
  });

  // Load dashboard data
  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getDashboard();
      console.log('Dashboard data received:', data);
      setDashboard(data);

      // Update form states with current values from backend
      if (data.current_fee_config) {
        console.log('Loading fee config from backend:', data.current_fee_config);
        setFeeConfig({
          valid_pct: parseFloat(String(data.current_fee_config.valid_pct)) || 30,
          vendor_pct: parseFloat(String(data.current_fee_config.vendor_pct)) || 30,
          pool_pct: parseFloat(String(data.current_fee_config.pool_pct)) || 30,
          promoter_pct: parseFloat(String(data.current_fee_config.promoter_pct)) || 10
        });
      }

      if (data.current_pricing) {
        console.log('Loading pricing from backend:', data.current_pricing);
        setPricing({
          one_day_cents: parseInt(String(data.current_pricing["1"])) || 1000,
          three_day_cents: parseInt(String(data.current_pricing["3"])) || 2000,
          seven_day_cents: parseInt(String(data.current_pricing["7"])) || 5000
        });
      }

      if (data.current_retention) {
        console.log('Loading retention from backend:', data.current_retention);
        setRetention(prev => ({
          ...prev,
          retention_days: parseInt(String(data.current_retention?.retention_days)) || 60
        }));
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to load dashboard';
      setError(errorMessage);

      // If it's a setup issue, show the setup check
      if (errorMessage.includes('Admin tables not found') || errorMessage.includes('setup')) {
        setShowSetupCheck(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetupCheck(false);
    loadDashboard();
  };

  useEffect(() => {
    if (isOpen) {
      loadDashboard();
    }
  }, [isOpen]);

  // Fee Configuration Handlers
  const handleFeeConfigChange = (field: keyof FeeConfigUpdate, value: number) => {
    setFeeConfig(prev => ({ ...prev, [field]: value }));
  };

  const validateFeeConfig = () => {
    const total = feeConfig.valid_pct + feeConfig.vendor_pct + feeConfig.pool_pct + feeConfig.promoter_pct;
    return Math.abs(total - 100) < 0.01;
  };

  const handleUpdateFeeConfig = async () => {
    if (!validateFeeConfig()) {
      setError('Fee percentages must sum to 100%');
      return;
    }

    try {
      setUpdating('fee-config');
      setError(null);
      await adminApi.updateFeeConfig(feeConfig);
      // Reload dashboard to show updated values
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update fee configuration');
    } finally {
      setUpdating(null);
    }
  };

  // Scan Fee Handlers
  const handleUpdateScanFee = async () => {
    if (!scanFee.venue_id.trim()) {
      setError('Please enter a venue ID');
      return;
    }

    try {
      setUpdating('scan-fee');
      setError(null);
      await adminApi.updateScanFee(scanFee);
      // Reload dashboard to show updated values
      await loadDashboard();
      // Reset form
      setScanFee({ venue_id: '', fee_cents: 10 });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update scan fee');
    } finally {
      setUpdating(null);
    }
  };

  // Pricing Handlers
  const handleUpdatePricing = async () => {
    try {
      setUpdating('pricing');
      setError(null);
      await adminApi.updateGhostPassPricing(pricing);
      // Reload dashboard to show updated values
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update pricing');
    } finally {
      setUpdating(null);
    }
  };

  // Payout Handlers
  const handlePayoutAction = async (payoutId: string, action: PayoutAction) => {
    try {
      setUpdating(`payout-${payoutId}`);
      setError(null);
      await adminApi.processPayoutAction(payoutId, action);
      // Reload dashboard to show updated values
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process payout');
    } finally {
      setUpdating(null);
    }
  };

  const handleProcessAllPayouts = async () => {
    if (!confirm('Are you sure you want to approve all pending payouts?')) {
      return;
    }

    try {
      setUpdating('process-all');
      setError(null);
      await adminApi.processAllPayouts();
      // Reload dashboard to show updated values
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process payouts');
    } finally {
      setUpdating(null);
    }
  };

  // Retention Override Handler
  const handleRetentionOverride = async () => {
    if (!retention.justification.trim() || retention.justification.length < 10) {
      setError('Please provide a detailed justification (minimum 10 characters)');
      return;
    }

    if (!confirm('Are you sure you want to override the data retention period? This action will be audited.')) {
      return;
    }

    try {
      setUpdating('retention');
      setError(null);
      await adminApi.overrideRetention(retention);
      // Reload dashboard to show updated values
      await loadDashboard();
      // Reset form
      setRetention({ retention_days: 60, justification: '' });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update retention period');
    } finally {
      setUpdating(null);
    }
  };

  if (!isOpen) return null;

  // Show setup check if needed
  if (showSetupCheck) {
    return <AdminSetupCheck onSetupComplete={handleSetupComplete} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Command Center Panel - Mobile Responsive */}
      <div className="relative w-full h-full md:w-full md:max-w-6xl md:mx-auto md:my-4 md:h-auto bg-slate-900/95 backdrop-blur-xl border-0 md:border border-red-500/30 md:rounded-xl shadow-2xl shadow-red-500/20 overflow-hidden">
        {/* Header - Mobile Optimized */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent">
          <div className="flex items-center space-x-3 md:space-x-4">
            <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-red-400">⚠ COMMAND CENTER</h1>
              <div className="flex items-center space-x-2 mt-1">
                <div className="px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-xs font-medium text-red-300">
                  AUDIT LOGGED
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">Every change is tracked</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Mobile Scrollable */}
        <div className="h-[calc(100vh-80px)] md:max-h-[80vh] overflow-y-auto p-4 md:p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {dashboard && (
            <div className="space-y-4 md:space-y-6">
              {/* System Overview - Mobile Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="glass-panel p-3 md:p-4 border-red-500/20">
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
                    <Users className="text-red-400 mb-2 md:mb-0" size={16} />
                    <div>
                      <p className="text-xs md:text-sm text-slate-400">Users</p>
                      <p className="text-lg md:text-xl font-bold text-red-400">{dashboard.stats.total_users}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-3 md:p-4 border-red-500/20">
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
                    <DollarSign className="text-red-400 mb-2 md:mb-0" size={16} />
                    <div>
                      <p className="text-xs md:text-sm text-slate-400">Balance</p>
                      <p className="text-lg md:text-xl font-bold text-red-400">
                        ${(dashboard.stats.total_balance_cents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-3 md:p-4 border-red-500/20">
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
                    <Shield className="text-red-400 mb-2 md:mb-0" size={16} />
                    <div>
                      <p className="text-xs md:text-sm text-slate-400">Passes</p>
                      <p className="text-lg md:text-xl font-bold text-red-400">{dashboard.stats.active_passes}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-3 md:p-4 border-red-500/20">
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
                    <AlertTriangle className="text-red-400 mb-2 md:mb-0" size={16} />
                    <div>
                      <p className="text-xs md:text-sm text-slate-400">Payouts</p>
                      <p className="text-lg md:text-xl font-bold text-red-400">{dashboard.stats.pending_payouts}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee & Distribution Config */}
              <CollapsibleSection
                title="Revenue Split Configuration"
                icon={<DollarSign size={18} />}
                defaultOpen={true}
              >
                <div className="space-y-4 mt-4">
                  {/* Preset Configurations */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => {
                        setFeeConfig({ valid_pct: 30, vendor_pct: 30, pool_pct: 30, promoter_pct: 10 });
                      }}
                      className="px-3 py-1 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                    >
                      Default (30/30/30/10)
                    </button>
                    <button
                      onClick={() => {
                        setFeeConfig({ valid_pct: 25, vendor_pct: 25, pool_pct: 25, promoter_pct: 25 });
                      }}
                      className="px-3 py-1 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                    >
                      Equal Split (25/25/25/25)
                    </button>
                    <button
                      onClick={() => {
                        setFeeConfig({ valid_pct: 40, vendor_pct: 40, pool_pct: 15, promoter_pct: 5 });
                      }}
                      className="px-3 py-1 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                    >
                      Vendor Focus (40/40/15/5)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Valid %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={feeConfig.valid_pct}
                        onChange={(e) => handleFeeConfigChange('valid_pct', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                        placeholder="30.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Vendor %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={feeConfig.vendor_pct}
                        onChange={(e) => handleFeeConfigChange('vendor_pct', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                        placeholder="30.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Pool %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={feeConfig.pool_pct}
                        onChange={(e) => handleFeeConfigChange('pool_pct', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                        placeholder="30.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Promoter %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={feeConfig.promoter_pct}
                        onChange={(e) => handleFeeConfigChange('promoter_pct', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                        placeholder="10.0"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-3 md:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-300">Live Preview (on $100 scan):</p>
                      <button
                        onClick={() => {
                          const remaining = 100 - (feeConfig.valid_pct + feeConfig.vendor_pct + feeConfig.pool_pct);
                          handleFeeConfigChange('promoter_pct', Math.max(0, remaining));
                        }}
                        className="text-xs px-2 py-1 bg-red-500/20 border border-red-500/50 text-red-300 rounded hover:bg-red-500/30 transition-colors"
                      >
                        Auto-Balance
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                      <div>Valid: <span className="text-red-400 font-mono">${(feeConfig.valid_pct).toFixed(2)}</span></div>
                      <div>Vendor: <span className="text-red-400 font-mono">${(feeConfig.vendor_pct).toFixed(2)}</span></div>
                      <div>Pool: <span className="text-red-400 font-mono">${(feeConfig.pool_pct).toFixed(2)}</span></div>
                      <div>Promoter: <span className="text-red-400 font-mono">${(feeConfig.promoter_pct).toFixed(2)}</span></div>
                    </div>
                    <div className="mt-2 text-sm flex items-center justify-between">
                      <div>
                        Total: <span className={cn(
                          "font-mono font-bold",
                          validateFeeConfig() ? "text-emerald-400" : "text-red-400"
                        )}>
                          {(feeConfig.valid_pct + feeConfig.vendor_pct + feeConfig.pool_pct + feeConfig.promoter_pct).toFixed(1)}%
                        </span>
                        {!validateFeeConfig() && <span className="text-red-400 ml-2">⚠ Must equal 100%</span>}
                      </div>
                      {validateFeeConfig() && (
                        <span className="text-emerald-400 text-xs">✓ Valid</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateFeeConfig}
                    disabled={!validateFeeConfig() || updating === 'fee-config'}
                    className={cn(
                      "w-full md:w-auto px-6 py-2 rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2",
                      validateFeeConfig() && updating !== 'fee-config'
                        ? "bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20"
                        : "bg-slate-700 border border-slate-600 text-slate-500 cursor-not-allowed"
                    )}
                  >
                    {updating === 'fee-config' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                    )}
                    <span>{updating === 'fee-config' ? 'UPDATING...' : 'APPLY CHANGES'}</span>
                  </button>
                </div>
              </CollapsibleSection>

              {/* Scan Fee Pricing */}
              <CollapsibleSection
                title="Gateway Scan Fees"
                icon={<Shield size={18} />}
              >
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Venue ID
                      </label>
                      <input
                        type="text"
                        value={scanFee.venue_id}
                        onChange={(e) => setScanFee(prev => ({ ...prev, venue_id: e.target.value }))}
                        placeholder="e.g., venue_001 or 'global'"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Fee per Scan (${(scanFee.fee_cents / 100).toFixed(2)})
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={scanFee.fee_cents}
                        onChange={(e) => setScanFee(prev => ({ ...prev, fee_cents: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-red"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateScanFee}
                    disabled={updating === 'scan-fee'}
                    className="w-full md:w-auto px-6 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating === 'scan-fee' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                    )}
                    <span>{updating === 'scan-fee' ? 'UPDATING...' : 'UPDATE FEE'}</span>
                  </button>
                </div>
              </CollapsibleSection>

              {/* GhostPass Pricing */}
              <CollapsibleSection
                title="GhostPass Pricing"
                icon={<Database size={18} />}
              >
                <div className="space-y-4 mt-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 mb-4">
                    <p className="text-yellow-400 text-sm">⚠ Changes affect NEW purchases only. Existing passes unchanged.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        1 Day Pass (${(pricing.one_day_cents / 100).toFixed(2)})
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="5000"
                        step="100"
                        value={pricing.one_day_cents}
                        onChange={(e) => setPricing(prev => ({ ...prev, one_day_cents: parseInt(e.target.value) || 1000 }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        3 Day Pass (${(pricing.three_day_cents / 100).toFixed(2)})
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="5000"
                        step="100"
                        value={pricing.three_day_cents}
                        onChange={(e) => setPricing(prev => ({ ...prev, three_day_cents: parseInt(e.target.value) || 2000 }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        7 Day Pass (${(pricing.seven_day_cents / 100).toFixed(2)})
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="10000"
                        step="100"
                        value={pricing.seven_day_cents}
                        onChange={(e) => setPricing(prev => ({ ...prev, seven_day_cents: parseInt(e.target.value) || 5000 }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleUpdatePricing}
                    disabled={updating === 'pricing'}
                    className="w-full md:w-auto px-6 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating === 'pricing' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                    )}
                    <span>{updating === 'pricing' ? 'UPDATING...' : 'SAVE PRICING'}</span>
                  </button>
                </div>
              </CollapsibleSection>

              {/* Payout Controls */}
              <CollapsibleSection
                title="Vendor Payout Dashboard"
                icon={<DollarSign size={18} />}
              >
                <div className="space-y-4 mt-4">
                  {dashboard.pending_payouts.length > 0 ? (
                    <>
                      {/* Mobile-friendly payout list */}
                      <div className="space-y-3 md:hidden">
                        {dashboard.pending_payouts.map((payout) => (
                          <div key={payout.id} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-white font-medium text-sm">{payout.vendor_email}</p>
                                <p className="text-red-400 font-mono text-lg">
                                  ${(payout.amount_cents / 100).toFixed(2)}
                                </p>
                                <p className="text-slate-400 text-xs">
                                  {new Date(payout.requested_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handlePayoutAction(payout.id, { action: 'approve' })}
                                disabled={updating === `payout-${payout.id}`}
                                className="flex-1 px-3 py-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updating === `payout-${payout.id}` ? '...' : 'APPROVE'}
                              </button>
                              <button
                                onClick={() => handlePayoutAction(payout.id, { action: 'reject' })}
                                disabled={updating === `payout-${payout.id}`}
                                className="flex-1 px-3 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updating === `payout-${payout.id}` ? '...' : 'REJECT'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 text-slate-300">Vendor</th>
                              <th className="text-left py-2 text-slate-300">Amount</th>
                              <th className="text-left py-2 text-slate-300">Requested</th>
                              <th className="text-left py-2 text-slate-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboard.pending_payouts.map((payout) => (
                              <tr key={payout.id} className="border-b border-slate-800">
                                <td className="py-3 text-white">{payout.vendor_email}</td>
                                <td className="py-3 text-red-400 font-mono">
                                  ${(payout.amount_cents / 100).toFixed(2)}
                                </td>
                                <td className="py-3 text-slate-400">
                                  {new Date(payout.requested_at).toLocaleDateString()}
                                </td>
                                <td className="py-3 space-x-2">
                                  <button
                                    onClick={() => handlePayoutAction(payout.id, { action: 'approve' })}
                                    disabled={updating === `payout-${payout.id}`}
                                    className="px-3 py-1 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {updating === `payout-${payout.id}` ? '...' : 'APPROVE'}
                                  </button>
                                  <button
                                    onClick={() => handlePayoutAction(payout.id, { action: 'reject' })}
                                    disabled={updating === `payout-${payout.id}`}
                                    className="px-3 py-1 bg-red-500/20 border border-red-500 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {updating === `payout-${payout.id}` ? '...' : 'REJECT'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        onClick={handleProcessAllPayouts}
                        disabled={updating === 'process-all'}
                        className="w-full md:w-auto px-6 py-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg font-medium hover:bg-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === 'process-all' && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
                        )}
                        <span>{updating === 'process-all' ? 'PROCESSING...' : 'PROCESS ALL'}</span>
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-400 py-4">No pending payouts</p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Data Retention Override */}
              <CollapsibleSection
                title="Transaction Purge Schedule"
                icon={<Database size={18} />}
              >
                <div className="space-y-4 mt-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                    <p className="text-yellow-400 text-sm">⚠ Compliance Risk. Must justify in audit log.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Retention Period (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={retention.retention_days}
                        onChange={(e) => setRetention(prev => ({ ...prev, retention_days: parseInt(e.target.value) || 60 }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Justification (Required)
                      </label>
                      <textarea
                        value={retention.justification}
                        onChange={(e) => setRetention(prev => ({ ...prev, justification: e.target.value }))}
                        placeholder="Explain why this override is necessary..."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none resize-none text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleRetentionOverride}
                    disabled={updating === 'retention'}
                    className="w-full md:w-auto px-6 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating === 'retention' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                    )}
                    <span>{updating === 'retention' ? 'UPDATING...' : 'OVERRIDE RETENTION'}</span>
                  </button>
                </div>
              </CollapsibleSection>

              {/* Gateway Manager */}
              <CollapsibleSection
                title="Gateway Manager"
                icon={<MapPin size={18} />}
              >
                <div className="space-y-4 mt-4">
                  <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-3 mb-4">
                    <p className="text-blue-400 text-sm">ℹ️ Configure entry points, internal areas, and seating zones for GhostPass validation.</p>
                  </div>

                  <button
                    onClick={onNavigateToGatewayManager}
                    className="w-full md:w-auto px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2"
                  >
                    <MapPin size={18} />
                    <span>OPEN GATEWAY MANAGER</span>
                  </button>
                </div>
              </CollapsibleSection>

              {/* Audit Logs */}
              <CollapsibleSection
                title="System Audit Trail"
                icon={<FileText size={18} />}
              >
                <div className="space-y-4 mt-4">
                  {dashboard.recent_audit_logs.length > 0 ? (
                    <>
                      {/* Mobile-friendly audit log list */}
                      <div className="space-y-3 md:hidden">
                        {dashboard.recent_audit_logs.map((log) => (
                          <div key={log.id} className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-red-400 font-mono text-sm">{log.action}</p>
                              <p className="text-slate-400 text-xs">
                                {new Date(log.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-white text-sm">{log.admin_email}</p>
                            <p className="text-slate-300 text-xs">{log.resource_type}</p>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 text-slate-300">Timestamp</th>
                              <th className="text-left py-2 text-slate-300">Admin</th>
                              <th className="text-left py-2 text-slate-300">Action</th>
                              <th className="text-left py-2 text-slate-300">Resource</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboard.recent_audit_logs.map((log) => (
                              <tr key={log.id} className="border-b border-slate-800">
                                <td className="py-3 text-slate-400 font-mono text-xs">
                                  {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="py-3 text-white">{log.admin_email}</td>
                                <td className="py-3 text-red-400 font-mono">{log.action}</td>
                                <td className="py-3 text-slate-300">{log.resource_type}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-400 py-4">No audit logs available</p>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default CommandCenter;