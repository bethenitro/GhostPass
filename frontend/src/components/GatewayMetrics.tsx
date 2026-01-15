import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { gatewayApi } from '@/lib/api';
import type { GatewayRealtimeMetrics } from '@/types';
import { cn } from '@/lib/utils';

interface GatewayMetricsProps {
  gatewayPointId: string;
  gatewayType: 'ENTRY_POINT' | 'INTERNAL_AREA' | 'TABLE_SEAT';
  refreshInterval?: number; // milliseconds, default 30000 (30 seconds)
}

export const GatewayMetrics: React.FC<GatewayMetricsProps> = ({
  gatewayPointId,
  gatewayType,
  refreshInterval = 30000
}) => {
  const [metrics, setMetrics] = useState<GatewayRealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const loadMetrics = async () => {
    try {
      const data = await gatewayApi.getMetrics(gatewayPointId);
      setMetrics(data);
      setError('');
    } catch (err: any) {
      console.error('Error loading metrics:', err);
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();

    // Set up auto-refresh
    const interval = setInterval(loadMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [gatewayPointId, refreshInterval]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-400"></div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-slate-500 text-xs py-2">
        {error || 'No metrics available'}
      </div>
    );
  }

  // For ENTRY_POINT: Show QR scan metrics
  if (gatewayType === 'ENTRY_POINT') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Activity size={14} className="text-emerald-400" />
            <span>QR Scans</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-white font-medium">{metrics.qr_scans_today}</div>
              <div className="text-slate-500 text-[10px]">Today</div>
            </div>
            <div className="text-right">
              <div className="text-white font-medium">{metrics.total_qr_scans}</div>
              <div className="text-slate-500 text-[10px]">Total</div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Clock size={14} className="text-blue-400" />
            <span>Last Scan</span>
          </div>
          <div className="text-slate-300 font-medium">
            {formatTimestamp(metrics.last_qr_scan)}
          </div>
        </div>

        {metrics.qr_scans_last_hour > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-400">
              <TrendingUp size={14} className="text-amber-400" />
              <span>Last Hour</span>
            </div>
            <div className="text-amber-400 font-medium">
              {metrics.qr_scans_last_hour} scans
            </div>
          </div>
        )}
      </div>
    );
  }

  // For TABLE_SEAT and INTERNAL_AREA: Show transaction/sales metrics
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <Activity size={14} className="text-emerald-400" />
          <span>Transactions</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-white font-medium">{metrics.transactions_today}</div>
            <div className="text-slate-500 text-[10px]">Today</div>
          </div>
          <div className="text-right">
            <div className="text-white font-medium">{metrics.total_transactions}</div>
            <div className="text-slate-500 text-[10px]">Total</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <DollarSign size={14} className="text-green-400" />
          <span>Sales Today</span>
        </div>
        <div className="text-green-400 font-medium">
          {formatCurrency(metrics.sales_today_cents)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <Clock size={14} className="text-blue-400" />
          <span>Last Transaction</span>
        </div>
        <div className="text-slate-300 font-medium">
          {formatTimestamp(metrics.last_transaction)}
        </div>
      </div>

      {metrics.transactions_last_hour > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <TrendingUp size={14} className="text-amber-400" />
            <span>Last Hour</span>
          </div>
          <div className="text-amber-400 font-medium">
            {metrics.transactions_last_hour} • {formatCurrency(metrics.sales_last_hour_cents)}
          </div>
        </div>
      )}

      {metrics.total_sales_cents > 0 && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700">
          <div className="text-slate-400">Total Sales</div>
          <div className="text-white font-semibold">
            {formatCurrency(metrics.total_sales_cents)}
          </div>
        </div>
      )}
    </div>
  );
};

// Compact version for table rows
export const GatewayMetricsCompact: React.FC<GatewayMetricsProps> = ({
  gatewayPointId,
  gatewayType,
  refreshInterval = 30000
}) => {
  const [metrics, setMetrics] = useState<GatewayRealtimeMetrics | null>(null);

  const loadMetrics = async () => {
    try {
      const data = await gatewayApi.getMetrics(gatewayPointId);
      setMetrics(data);
    } catch (err) {
      console.error('Error loading metrics:', err);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [gatewayPointId, refreshInterval]);

  if (!metrics) {
    return <span className="text-slate-500 text-xs">—</span>;
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString();
  };

  if (gatewayType === 'ENTRY_POINT') {
    return (
      <div className="flex items-center space-x-3 text-xs">
        <div className="flex items-center space-x-1">
          <Activity size={12} className="text-emerald-400" />
          <span className="text-white font-medium">{metrics.qr_scans_today}</span>
          <span className="text-slate-500">today</span>
        </div>
        {formatTimestamp(metrics.last_qr_scan) !== '—' && (
          <div className="flex items-center space-x-1">
            <Clock size={12} className="text-blue-400" />
            <span className="text-slate-300">{formatTimestamp(metrics.last_qr_scan)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 text-xs">
      <div className="flex items-center space-x-1">
        <Activity size={12} className="text-emerald-400" />
        <span className="text-white font-medium">{metrics.transactions_today}</span>
        <span className="text-slate-500">txns</span>
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-green-400 font-medium">
          ${(metrics.sales_today_cents / 100).toFixed(0)}
        </span>
      </div>
    </div>
  );
};
