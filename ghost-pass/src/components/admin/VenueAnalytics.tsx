import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Users, DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { venueApi as venueApiLib } from '@/lib/api';
import { useToast } from '../ui/toast';

interface VenueAnalyticsProps {
  venueId: string;
  eventId?: string;
}

interface Stats {
  total_revenue_cents: number;
  total_transactions: number;
  unique_users: number;
  total_entries: number;
  total_reentries: number;
}

export const VenueAnalytics: React.FC<VenueAnalyticsProps> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [venueId, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);
      const response = await venueApiLib.getStats(venueId, eventId);
      setStats(response.data);
      if (showRefreshToast) {
        showToast('Analytics refreshed', 'success', 2000);
      }
    } catch (error: any) {
      console.error('Failed to load stats:', error);
      if (!stats) {
        showToast(error.response?.data?.error || 'Failed to load analytics', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const statCards = [
    { 
      label: t('analytics.revenue'), 
      value: formatCurrency(stats?.total_revenue_cents || 0), 
      icon: DollarSign, 
      color: 'green',
      change: '+12.5%'
    },
    { 
      label: t('analytics.transactions'), 
      value: stats?.total_transactions || 0, 
      icon: TrendingUp, 
      color: 'cyan',
      change: '+8.2%'
    },
    { 
      label: t('analytics.users'), 
      value: stats?.unique_users || 0, 
      icon: Users, 
      color: 'purple',
      change: '+15.3%'
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
          <h2 className="text-lg sm:text-xl font-bold text-white">{t('analytics.dashboard')}</h2>
        </div>
        <button
          onClick={() => loadStats(true)}
          disabled={refreshing}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg text-cyan-400 transition-all disabled:opacity-50 min-h-[44px] text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm">{t('common.refresh')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-xs sm:text-sm">{stat.label}</span>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${stat.color}-400`} />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-green-400">{stat.change} vs last period</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3 text-sm sm:text-base">Entry Statistics</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Initial Entries</span>
              <span className="text-white font-medium">{stats?.total_entries || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Re-entries</span>
              <span className="text-white font-medium">{stats?.total_reentries || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Re-entry Rate</span>
              <span className="text-white font-medium">
                {stats?.total_entries ? ((stats.total_reentries / stats.total_entries) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3 text-sm sm:text-base">Performance</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Avg Transaction</span>
              <span className="text-white font-medium">
                {formatCurrency(stats?.total_transactions ? (stats.total_revenue_cents / stats.total_transactions) : 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Revenue per User</span>
              <span className="text-white font-medium">
                {formatCurrency(stats?.unique_users ? (stats.total_revenue_cents / stats.unique_users) : 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 sm:p-4">
        <p className="text-cyan-400 text-xs sm:text-sm">
          📊 Real-time analytics • Auto-refreshes every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};
