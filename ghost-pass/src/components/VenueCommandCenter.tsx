import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Users, TrendingUp, FileText, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { venueApi } from '@/lib/api';
import type { VenueDashboard, VenueEntryConfig } from '@/types';

interface VenueCommandCenterProps {
  onBack: () => void;
  venueId?: string;
  eventId?: string;
}

const VenueCommandCenter: React.FC<VenueCommandCenterProps> = ({ onBack, venueId, eventId }) => {
  const [dashboard, setDashboard] = useState<VenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<VenueEntryConfig>({
    venue_id: venueId || '',
    event_id: eventId,
    re_entry_allowed: true,
    initial_entry_fee_cents: 0,
    venue_reentry_fee_cents: 0,
    valid_reentry_scan_fee_cents: 0,
    max_reentries: undefined,
    reentry_time_limit_hours: undefined
  });

  useEffect(() => {
    loadDashboard();
  }, [venueId, eventId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await venueApi.getDashboard(venueId, eventId);
      setDashboard(data);
      
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err: any) {
      console.error('Error loading venue dashboard:', err);
      setError(err.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      setUpdating(true);
      setError(null);
      await venueApi.updateConfig(config);
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update configuration');
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="border-b border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-purple-400 flex-shrink-0 touch-manipulation active:scale-95"
              >
                <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-purple-400">Venue Command Center</h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1">Event-scoped controls</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="border-b border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-purple-400 flex-shrink-0 touch-manipulation active:scale-95"
              >
                <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-purple-400">Venue Command Center</h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1">Event-scoped controls</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-8 text-center">
            <p className="text-red-400 text-lg mb-4">Error Loading Dashboard</p>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
              onClick={loadDashboard}
              className="px-6 py-3 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors touch-manipulation min-h-[44px] active:scale-95"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-purple-400 flex-shrink-0 touch-manipulation active:scale-95"
            >
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-purple-400 truncate">Venue Command Center</h1>
              <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1 truncate">
                Event-scoped controls {eventId && `• Event: ${eventId}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Event Statistics */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">Event Totals</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-blue-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">Total Entries</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.stats?.total_entries || 0}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="text-emerald-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">Re-entries</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.stats?.total_reentries || 0}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="text-amber-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">Total Revenue</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {formatCurrency(dashboard?.stats?.total_revenue_cents || 0)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-purple-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">Unique Attendees</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.stats?.unique_attendees || 0}</p>
            </div>
          </div>
        </div>

        {/* Entry Configuration */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">Event Configuration</h2>
          
          <div className="space-y-4 sm:space-y-6">
            {/* Re-entry Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-800/50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white mb-1">Re-Entry Permission</h3>
                <p className="text-sm text-slate-400">Allow attendees to re-enter the event</p>
              </div>
              <button
                onClick={() => setConfig(prev => ({ ...prev, re_entry_allowed: !prev.re_entry_allowed }))}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors touch-manipulation min-h-[44px] active:scale-95 ${
                  config.re_entry_allowed
                    ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                    : 'bg-slate-700 border border-slate-600 text-slate-400'
                }`}
              >
                {config.re_entry_allowed ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                <span className="font-medium">{config.re_entry_allowed ? 'Allowed' : 'Not Allowed'}</span>
              </button>
            </div>

            {/* Pricing Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Initial Entry Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(config.initial_entry_fee_cents / 100).toFixed(2)}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      initial_entry_fee_cents: Math.round(parseFloat(e.target.value) * 100) 
                    }))}
                    className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Maximum: $50.00</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Venue Re-Entry Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(config.venue_reentry_fee_cents / 100).toFixed(2)}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      venue_reentry_fee_cents: Math.round(parseFloat(e.target.value) * 100) 
                    }))}
                    disabled={!config.re_entry_allowed}
                    className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Maximum: $20.00</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  VALID Re-Entry Scan Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(config.valid_reentry_scan_fee_cents / 100).toFixed(2)}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      valid_reentry_scan_fee_cents: Math.round(parseFloat(e.target.value) * 100) 
                    }))}
                    disabled={!config.re_entry_allowed}
                    className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Platform fee per re-entry scan</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Max Re-Entries (Optional)
                </label>
                <input
                  type="number"
                  value={config.max_reentries || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    max_reentries: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder="Unlimited"
                  disabled={!config.re_entry_allowed}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-700">
              <button
                onClick={handleUpdateConfig}
                disabled={updating}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors touch-manipulation min-h-[44px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                <span>{updating ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Vendor Payouts */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">Vendor Payouts</h2>
          
          {dashboard?.vendor_payouts && dashboard.vendor_payouts.length > 0 ? (
            <div className="space-y-3">
              {dashboard.vendor_payouts.map((payout) => (
                <div key={payout.vendor_id} className="bg-slate-800/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">{payout.vendor_name}</h3>
                    <p className="text-sm text-slate-400">{payout.transaction_count} transactions</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(payout.amount_cents)}</p>
                      <p className="text-xs text-slate-400">{payout.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No vendor payouts yet</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">Recent Activity</h2>
          
          {dashboard?.recent_audit_logs && dashboard.recent_audit_logs.length > 0 ? (
            <div className="space-y-2">
              {dashboard.recent_audit_logs.map((log) => (
                <div key={log.id} className="bg-slate-800/50 rounded-lg p-3 flex items-start space-x-3">
                  <FileText className="text-purple-400 flex-shrink-0 mt-1" size={16} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{log.action_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-400 truncate">{log.admin_email}</p>
                    <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueCommandCenter;
