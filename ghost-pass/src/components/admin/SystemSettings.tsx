import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, DollarSign, Percent, Clock, AlertTriangle, Save } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { AdminDashboard, FeeConfigUpdate, RetentionOverride } from '@/types';

export const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Revenue Split Configuration
  const [revenueSplit, setRevenueSplit] = useState({
    valid_pct: 0,
    vendor_pct: 0,
    pool_pct: 0,
    promoter_pct: 0
  });

  // Gateway Scan Fees
  const [scanFees, setScanFees] = useState({
    entry_scan_fee_cents: 0,
    reentry_scan_fee_cents: 0,
    internal_scan_fee_cents: 0
  });

  // GhostPass Pricing
  const [ghostPassPricing, setGhostPassPricing] = useState({
    one_day_cents: 500,
    three_day_cents: 1200,
    five_day_cents: 2000,
    seven_day_cents: 2500,
    ten_day_cents: 3500,
    fourteen_day_cents: 4500,
    thirty_day_cents: 8000
  });

  // Retention Override
  const [retention, setRetention] = useState({
    retention_days: 60,
    justification: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const dashboard: AdminDashboard = await adminApi.getDashboard();
      
      // Load current settings from dashboard
      if (dashboard.current_fee_config) {
        setRevenueSplit({
          valid_pct: dashboard.current_fee_config.valid_pct || 0,
          vendor_pct: dashboard.current_fee_config.vendor_pct || 0,
          pool_pct: dashboard.current_fee_config.pool_pct || 0,
          promoter_pct: dashboard.current_fee_config.promoter_pct || 0
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: t('common.error'),
        description: t('settings.loadError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRevenueSplit = async () => {
    const total = revenueSplit.valid_pct + revenueSplit.vendor_pct + 
                  revenueSplit.pool_pct + revenueSplit.promoter_pct;
    
    if (total !== 100) {
      toast({
        title: t('common.error'),
        description: t('settings.splitMustEqual100'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setUpdating('revenue-split');
      const config: FeeConfigUpdate = {
        valid_pct: revenueSplit.valid_pct,
        vendor_pct: revenueSplit.vendor_pct,
        pool_pct: revenueSplit.pool_pct,
        promoter_pct: revenueSplit.promoter_pct
      };
      await adminApi.updateFeeConfig(config);
      
      toast({
        title: t('common.success'),
        description: t('settings.revenueSplitUpdated')
      });
    } catch (error) {
      console.error('Error updating revenue split:', error);
      toast({
        title: t('common.error'),
        description: t('settings.updateError'),
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateScanFees = async () => {
    try {
      setUpdating('scan-fees');
      // Update each scan fee type separately
      await Promise.all([
        adminApi.updateScanFee({ venue_id: 'entry', fee_cents: scanFees.entry_scan_fee_cents }),
        adminApi.updateScanFee({ venue_id: 'reentry', fee_cents: scanFees.reentry_scan_fee_cents }),
        adminApi.updateScanFee({ venue_id: 'internal', fee_cents: scanFees.internal_scan_fee_cents })
      ]);
      
      toast({
        title: t('common.success'),
        description: t('settings.scanFeesUpdated')
      });
    } catch (error) {
      console.error('Error updating scan fees:', error);
      toast({
        title: t('common.error'),
        description: t('settings.updateError'),
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateGhostPassPricing = async () => {
    try {
      setUpdating('ghostpass-pricing');
      await adminApi.updateGhostPassPricing(ghostPassPricing);
      
      toast({
        title: t('common.success'),
        description: t('settings.ghostPassPricingUpdated')
      });
    } catch (error) {
      console.error('Error updating GhostPass pricing:', error);
      toast({
        title: t('common.error'),
        description: t('settings.updateError'),
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleRetentionOverride = async () => {
    if (!retention.justification.trim()) {
      toast({
        title: t('common.error'),
        description: t('settings.justificationRequired'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setUpdating('retention');
      const override: RetentionOverride = {
        retention_days: retention.retention_days,
        justification: retention.justification
      };
      await adminApi.overrideRetention(override);
      
      toast({
        title: t('common.success'),
        description: t('settings.retentionUpdated')
      });
      setRetention({ retention_days: 60, justification: '' });
    } catch (error) {
      console.error('Error updating retention:', error);
      toast({
        title: t('common.error'),
        description: t('settings.updateError'),
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const applyPreset = (preset: 'balanced' | 'vendor_focused' | 'valid_focused') => {
    const presets = {
      balanced: { valid_pct: 25, vendor_pct: 50, pool_pct: 15, promoter_pct: 10 },
      vendor_focused: { valid_pct: 15, vendor_pct: 65, pool_pct: 10, promoter_pct: 10 },
      valid_focused: { valid_pct: 40, vendor_pct: 40, pool_pct: 10, promoter_pct: 10 }
    };
    setRevenueSplit(presets[preset]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Settings className="w-6 h-6 text-slate-400" />
        <h2 className="text-xl font-bold text-white">{t('settings.title')}</h2>
      </div>

      {/* Revenue Split Configuration */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Percent className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">{t('settings.revenueSplit')}</h3>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPreset('balanced')}
              className="px-3 py-1 bg-blue-500/20 border border-blue-500 text-blue-400 rounded text-sm hover:bg-blue-500/30 transition-colors min-h-[44px]"
            >
              Balanced (25/50/15/10)
            </button>
            <button
              onClick={() => applyPreset('vendor_focused')}
              className="px-3 py-1 bg-purple-500/20 border border-purple-500 text-purple-400 rounded text-sm hover:bg-purple-500/30 transition-colors min-h-[44px]"
            >
              Vendor Focused (15/65/10/10)
            </button>
            <button
              onClick={() => applyPreset('valid_focused')}
              className="px-3 py-1 bg-cyan-500/20 border border-cyan-500 text-cyan-400 rounded text-sm hover:bg-cyan-500/30 transition-colors min-h-[44px]"
            >
              VALID Focused (40/40/10/10)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">VALID %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={revenueSplit.valid_pct}
                onChange={(e) => setRevenueSplit(prev => ({ ...prev, valid_pct: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Vendor %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={revenueSplit.vendor_pct}
                onChange={(e) => setRevenueSplit(prev => ({ ...prev, vendor_pct: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Pool %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={revenueSplit.pool_pct}
                onChange={(e) => setRevenueSplit(prev => ({ ...prev, pool_pct: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Promoter %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={revenueSplit.promoter_pct}
                onChange={(e) => setRevenueSplit(prev => ({ ...prev, promoter_pct: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <span className="text-slate-300">Total:</span>
            <span className={`font-bold ${
              revenueSplit.valid_pct + revenueSplit.vendor_pct + 
              revenueSplit.pool_pct + revenueSplit.promoter_pct === 100
                ? 'text-green-400'
                : 'text-red-400'
            }`}>
              {revenueSplit.valid_pct + revenueSplit.vendor_pct + 
               revenueSplit.pool_pct + revenueSplit.promoter_pct}%
            </span>
          </div>

          <button
            onClick={handleUpdateRevenueSplit}
            disabled={updating === 'revenue-split'}
            className="w-full md:w-auto px-6 py-2 bg-green-500/20 border border-green-500 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
          >
            {updating === 'revenue-split' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{t('common.save')}</span>
          </button>
        </div>
      </div>

      {/* Gateway Scan Fees */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">{t('settings.scanFees')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Entry Scan Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={(scanFees.entry_scan_fee_cents / 100).toFixed(2)}
                onChange={(e) => setScanFees(prev => ({ ...prev, entry_scan_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Re-entry Scan Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={(scanFees.reentry_scan_fee_cents / 100).toFixed(2)}
                onChange={(e) => setScanFees(prev => ({ ...prev, reentry_scan_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Internal Scan Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={(scanFees.internal_scan_fee_cents / 100).toFixed(2)}
                onChange={(e) => setScanFees(prev => ({ ...prev, internal_scan_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleUpdateScanFees}
          disabled={updating === 'scan-fees'}
          className="mt-4 w-full md:w-auto px-6 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
        >
          {updating === 'scan-fees' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{t('common.save')}</span>
        </button>
      </div>

      {/* GhostPass Pricing */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">{t('settings.ghostPassPricing')}</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'one_day_cents', label: '1 Day' },
            { key: 'three_day_cents', label: '3 Day' },
            { key: 'five_day_cents', label: '5 Day' },
            { key: 'seven_day_cents', label: '7 Day' },
            { key: 'ten_day_cents', label: '10 Day' },
            { key: 'fourteen_day_cents', label: '14 Day' },
            { key: 'thirty_day_cents', label: '30 Day' }
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={(ghostPassPricing[key as keyof typeof ghostPassPricing] / 100).toFixed(2)}
                  onChange={(e) => setGhostPassPricing(prev => ({ 
                    ...prev, 
                    [key]: Math.round(parseFloat(e.target.value || '0') * 100) 
                  }))}
                  className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleUpdateGhostPassPricing}
          disabled={updating === 'ghostpass-pricing'}
          className="mt-4 w-full md:w-auto px-6 py-2 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
        >
          {updating === 'ghostpass-pricing' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{t('common.save')}</span>
        </button>
      </div>

      {/* Transaction Retention Override */}
      <div className="bg-slate-700/30 border border-amber-600 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">{t('settings.retentionOverride')}</h3>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-400 text-sm">{t('settings.retentionWarning')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Retention Period (Days)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={retention.retention_days}
              onChange={(e) => setRetention(prev => ({ ...prev, retention_days: parseInt(e.target.value) || 60 }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Justification (Required)</label>
            <textarea
              value={retention.justification}
              onChange={(e) => setRetention(prev => ({ ...prev, justification: e.target.value }))}
              placeholder="Explain why this override is necessary..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          <button
            onClick={handleRetentionOverride}
            disabled={updating === 'retention' || !retention.justification.trim()}
            className="w-full md:w-auto px-6 py-2 bg-amber-500/20 border border-amber-500 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
          >
            {updating === 'retention' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{t('settings.applyOverride')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
