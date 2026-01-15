import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Wallet, AlertCircle } from 'lucide-react';
import { gatewayApi } from '@/lib/api';
import type { FinancialDistribution as FinancialDistributionType } from '@/types';
import { cn } from '@/lib/utils';

interface FinancialDistributionProps {
  refreshInterval?: number; // milliseconds, default 60000 (1 minute)
}

export const FinancialDistribution: React.FC<FinancialDistributionProps> = ({
  refreshInterval = 60000
}) => {
  const [distribution, setDistribution] = useState<FinancialDistributionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const loadDistribution = async () => {
    try {
      const data = await gatewayApi.getFinancialDistribution();
      setDistribution(data);
      setError('');
    } catch (err: any) {
      console.error('Error loading financial distribution:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDistribution();

    // Set up auto-refresh
    const interval = setInterval(loadDistribution, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/50';
      case 'SETTLED':
        return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50';
      case 'NO_ACTIVITY':
        return 'text-slate-400 bg-slate-700/20 border-slate-600/50';
      default:
        return 'text-slate-400 bg-slate-700/20 border-slate-600/50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'SETTLED':
        return 'Settled';
      case 'NO_ACTIVITY':
        return 'No Activity';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="glass-panel border-red-500/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
        </div>
      </div>
    );
  }

  if (error || !distribution) {
    return (
      <div className="glass-panel border-red-500/20 p-6">
        <div className="flex items-center space-x-2 text-red-400">
          <AlertCircle size={20} />
          <span className="text-sm">{error || 'No data available'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel border-red-500/20 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <DollarSign className="text-red-400" size={24} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-red-400">
              QR Revenue Distribution
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm">Live View - Read Only</p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-medium border",
          getStatusColor(distribution.status)
        )}>
          {getStatusLabel(distribution.status)}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Gross Collected */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <span className="text-slate-400 text-xs font-medium">Gross Collected</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(distribution.gross_collected_cents)}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {distribution.total_scans} scans
          </div>
        </div>

        {/* Scan Fee Total */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign size={16} className="text-blue-400" />
            <span className="text-slate-400 text-xs font-medium">Scan Fee Total</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(distribution.scan_fee_total_cents)}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            All fees collected
          </div>
        </div>

        {/* Vendor Net */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center space-x-2 mb-2">
            <Wallet size={16} className="text-green-400" />
            <span className="text-slate-400 text-xs font-medium">Vendor Net</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(distribution.vendor_net_cents)}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            Calculated share
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Distribution Breakdown</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Valid Platform Fee</span>
            <span className="text-white font-medium">
              {formatCurrency(distribution.breakdown.valid_pct_cents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Vendor Share</span>
            <span className="text-green-400 font-medium">
              {formatCurrency(distribution.breakdown.vendor_pct_cents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Pool Share</span>
            <span className="text-white font-medium">
              {formatCurrency(distribution.breakdown.pool_pct_cents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Promoter Share</span>
            <span className="text-white font-medium">
              {formatCurrency(distribution.breakdown.promoter_pct_cents)}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
