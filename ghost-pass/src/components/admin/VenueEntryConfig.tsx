import React, { useState, useEffect } from 'react';
import { Settings, Save, DollarSign, CheckCircle } from 'lucide-react';
import { venueApi } from '@/lib/api';
import { useToast } from '../ui/toast';

interface VenueEntryConfigProps {
  venueId: string;
  eventId?: string;
}

export const VenueEntryConfig: React.FC<VenueEntryConfigProps> = ({ venueId, eventId }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    re_entry_allowed: true,
    initial_entry_fee_cents: 0,
    venue_reentry_fee_cents: 0,
    valid_reentry_scan_fee_cents: 0,
    max_reentries: 0,
    reentry_time_limit_hours: 0
  });

  useEffect(() => {
    loadConfig();
  }, [venueId, eventId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await venueApi.getConfig(venueId, eventId);
      if (data) {
        setConfig({
          re_entry_allowed: data.re_entry_allowed ?? true,
          initial_entry_fee_cents: data.initial_entry_fee_cents ?? 0,
          venue_reentry_fee_cents: data.venue_reentry_fee_cents ?? 0,
          valid_reentry_scan_fee_cents: data.valid_reentry_scan_fee_cents ?? 0,
          max_reentries: data.max_reentries ?? 0,
          reentry_time_limit_hours: data.reentry_time_limit_hours ?? 0
        });
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
      // Don't show error toast for 401 - the router will handle it
      if (error.response?.status !== 401) {
        showToast('Failed to load entry configuration', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await venueApi.updateConfig({
        venue_id: venueId,
        event_id: eventId,
        ...config
      });
      
      showToast('Entry configuration updated successfully', 'success');
    } catch (error) {
      console.error('Error saving config:', error);
      showToast('Failed to update entry configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Settings className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-bold text-white">Entry Configuration</h2>
      </div>

      {/* Re-entry Settings */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span>Re-entry Settings</span>
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="re_entry_allowed"
              checked={config.re_entry_allowed}
              onChange={(e) => setConfig(prev => ({ ...prev, re_entry_allowed: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="re_entry_allowed" className="text-slate-300 font-medium">
              Allow Re-entry
            </label>
          </div>

          {config.re_entry_allowed && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Re-entries (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={config.max_reentries}
                    onChange={(e) => setConfig(prev => ({ ...prev, max_reentries: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Time Limit (hours, 0 = no limit)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={config.reentry_time_limit_hours}
                    onChange={(e) => setConfig(prev => ({ ...prev, reentry_time_limit_hours: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fee Configuration */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          <span>Fee Configuration</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  initial_entry_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) 
                }))}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Venue Re-entry Fee
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={(config.venue_reentry_fee_cents / 100).toFixed(2)}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  venue_reentry_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) 
                }))}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              VALID Re-entry Scan Fee
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={(config.valid_reentry_scan_fee_cents / 100).toFixed(2)}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  valid_reentry_scan_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) 
                }))}
                className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Fee Breakdown Preview</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Initial Entry:</span>
              <span className="text-white font-mono">${formatCurrency(config.initial_entry_fee_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Re-entry (Venue):</span>
              <span className="text-white font-mono">${formatCurrency(config.venue_reentry_fee_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Re-entry (VALID Fee):</span>
              <span className="text-white font-mono">${formatCurrency(config.valid_reentry_scan_fee_cents)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-300 font-medium">Total Charges:</span>
              <span className="text-green-400 font-mono font-bold">
                ${formatCurrency(config.initial_entry_fee_cents + config.venue_reentry_fee_cents + config.valid_reentry_scan_fee_cents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full md:w-auto px-6 py-3 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
      >
        {saving ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
        ) : (
          <Save className="w-5 h-5" />
        )}
        <span className="font-medium">{saving ? 'Saving...' : 'Save Configuration'}</span>
      </button>
    </div>
  );
};
