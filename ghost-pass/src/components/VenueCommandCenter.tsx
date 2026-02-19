import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Users, TrendingUp, FileText, ToggleLeft, ToggleRight, Save, QrCode, Package, Eye, Download, Trash2, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { venueApi, authApi, gatewayApi } from '@/lib/api';
import type { VenueDashboard, VenueEntryConfig } from '@/types';
import QRCodeLib from 'qrcode';

interface VenueCommandCenterProps {
  onBack: () => void;
  venueId?: string;
  eventId?: string;
}

const VenueCommandCenter: React.FC<VenueCommandCenterProps> = ({ onBack, venueId, eventId }) => {
  const { t } = useTranslation();
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
      // Don't show error for 401 - the router will handle it
      if (err.response?.status !== 401) {
        setError(err.response?.data?.detail || 'Failed to load dashboard');
      }
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
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-purple-400">{t('venueCommandCenter.title')}</h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1">{t('venueCommandCenter.eventScopedControls')}</p>
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
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-purple-400">{t('venueCommandCenter.title')}</h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1">{t('venueCommandCenter.eventScopedControls')}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-8 text-center">
            <p className="text-red-400 text-lg mb-4">{t('venue.errorLoadingDashboard')}</p>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
              onClick={loadDashboard}
              className="px-6 py-3 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors touch-manipulation min-h-[44px] active:scale-95"
            >
              {t('venue.retry')}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4">
          <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
            {/* Left side - Back button and title */}
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <button
                onClick={onBack}
                className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-purple-400 flex-shrink-0 touch-manipulation active:scale-95"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl font-bold text-purple-400 truncate">{t('venueCommandCenter.title')}</h1>
                <p className="text-xs md:text-sm text-slate-400 mt-0.5 truncate">
                  {t('venueCommandCenter.eventScopedControls')} {eventId && `• ${t('venueCommandCenter.eventLabel', { eventId })}`}
                </p>
              </div>
            </div>
            
            {/* Right side - Action buttons */}
            <div className="flex items-center space-x-2 ml-auto md:ml-0">
              <button
                onClick={async () => {
                  try {
                    const deviceFingerprint = localStorage.getItem('device_fingerprint') || '';
                    const ssoData = await authApi.generateSSOToken(deviceFingerprint);
                    window.open(ssoData.bevalid_url, '_blank');
                  } catch (error) {
                    console.error('Error generating SSO token:', error);
                    alert('Failed to open beVALID. Please try again.');
                  }
                }}
                className="px-3 py-2 md:px-4 bg-cyan-500/20 border border-cyan-500 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
              >
                {t('venueCommandCenter.beValid')}
              </button>
              <button
                onClick={async () => {
                  await authApi.signOut();
                  onBack();
                }}
                className="px-3 py-2 md:px-4 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors whitespace-nowrap"
              >
                {t('venueCommandCenter.logout')}
              </button>
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
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">{t('venue.eventTotals')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-blue-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">{t('venue.totalEntries')}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.stats?.total_entries || 0}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="text-emerald-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">{t('venue.reEntries')}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.stats?.total_reentries || 0}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="text-amber-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">{t('venue.totalRevenue')}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {formatCurrency(dashboard?.stats?.total_revenue_cents || 0)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-purple-400" size={18} />
                <p className="text-xs sm:text-sm text-slate-400">{t('venue.uniqueAttendees')}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.stats?.unique_attendees || 0}</p>
            </div>
          </div>
        </div>

        {/* Entry Configuration */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">{t('venue.eventConfiguration')}</h2>
          
          <div className="space-y-4 sm:space-y-6">
            {/* Re-entry Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-800/50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white mb-1">{t('venue.reEntryPermission')}</h3>
                <p className="text-sm text-slate-400">{t('venue.allowReEntry')}</p>
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
                <span className="font-medium">{config.re_entry_allowed ? t('venue.allowed') : t('venue.notAllowed')}</span>
              </button>
            </div>

            {/* Pricing Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('venue.initialEntryFee')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(config.initial_entry_fee_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '.') {
                        setConfig(prev => ({ ...prev, initial_entry_fee_cents: 0 }));
                      } else {
                        const parsed = parseFloat(value);
                        if (!isNaN(parsed)) {
                          setConfig(prev => ({ 
                            ...prev, 
                            initial_entry_fee_cents: Math.round(parsed * 100) 
                          }));
                        }
                      }
                    }}
                    className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('venue.maximum')}: $50.00</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('venue.venueReEntryFee')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(config.venue_reentry_fee_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '.') {
                        setConfig(prev => ({ ...prev, venue_reentry_fee_cents: 0 }));
                      } else {
                        const parsed = parseFloat(value);
                        if (!isNaN(parsed)) {
                          setConfig(prev => ({ 
                            ...prev, 
                            venue_reentry_fee_cents: Math.round(parsed * 100) 
                          }));
                        }
                      }
                    }}
                    disabled={!config.re_entry_allowed}
                    className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('venue.maximum')}: $20.00</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('venue.validReEntryScanFee')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(config.valid_reentry_scan_fee_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '.') {
                        setConfig(prev => ({ ...prev, valid_reentry_scan_fee_cents: 0 }));
                      } else {
                        const parsed = parseFloat(value);
                        if (!isNaN(parsed)) {
                          setConfig(prev => ({ 
                            ...prev, 
                            valid_reentry_scan_fee_cents: Math.round(parsed * 100) 
                          }));
                        }
                      }
                    }}
                    disabled={!config.re_entry_allowed}
                    className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('venue.platformFeePerReEntry')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('venue.maxReEntries')}
                </label>
                <input
                  type="number"
                  value={config.max_reentries || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    max_reentries: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder={t('venue.unlimited')}
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
                <span>{updating ? t('venue.saving') : t('venue.saveConfiguration')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Vendor Payouts */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">{t('venue.vendorPayouts')}</h2>
          
          {dashboard?.vendor_payouts && dashboard.vendor_payouts.length > 0 ? (
            <div className="space-y-3">
              {dashboard.vendor_payouts.map((payout) => (
                <div key={payout.vendor_id} className="bg-slate-800/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">{payout.vendor_name}</h3>
                    <p className="text-sm text-slate-400">{payout.transaction_count} {t('venue.transactions')}</p>
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
            <p className="text-slate-400 text-center py-8">{t('venue.noVendorPayouts')}</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-4">{t('venue.recentActivity')}</h2>
          
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
            <p className="text-slate-400 text-center py-8">{t('venue.noRecentActivity')}</p>
          )}
        </div>

        {/* Entry Point QR Codes */}
        <EntryPointQRSection venueId={venueId} eventId={eventId} />

        {/* Vendor Item Configuration */}
        <VendorItemSection venueId={venueId} eventId={eventId} />

        {/* Revenue Visibility */}
        <RevenueVisibilitySection venueId={venueId} eventId={eventId} />
      </div>
    </div>
  );
};

// Entry Point QR Code Generator Section
const EntryPointQRSection: React.FC<{ venueId?: string; eventId?: string }> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const [entryPoints, setEntryPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    loadEntryPoints();
  }, [venueId]);

  const loadEntryPoints = async () => {
    try {
      setLoading(true);
      const points = await gatewayApi.getEntryPoints();
      setEntryPoints(points);
    } catch (error) {
      console.error('Error loading entry points:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (pointId: string, pointName: string) => {
    try {
      const qrData = JSON.stringify({
        type: 'ENTRY_POINT',
        venue_id: venueId,
        event_id: eventId,
        entry_point_id: pointId,
        entry_point_name: pointName,
        timestamp: new Date().toISOString()
      });

      // Generate QR code as data URL
      const dataUrl = await QRCodeLib.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrDataUrl(dataUrl);
      setSelectedPoint(pointId);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const downloadQRCode = (pointName: string) => {
    const link = document.createElement('a');
    link.download = `entry-point-${pointName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-purple-400">{t('venue.entryPointQRCodes')}</h2>
        <QrCode className="text-purple-400" size={24} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      ) : entryPoints.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entryPoints.map((point) => (
              <div key={point.id} className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">{point.name}</h3>
                    <p className="text-xs text-slate-400">{point.type.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    point.status === 'ENABLED' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {point.status}
                  </span>
                </div>
                <button
                  onClick={() => generateQRCode(point.id, point.name)}
                  className="w-full mt-2 px-4 py-2 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
                >
                  {t('venue.generateQRCode')}
                </button>
              </div>
            ))}
          </div>

          {qrDataUrl && selectedPoint && (
            <div className="bg-slate-800/50 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-4">
                {t('venue.qrCodeFor')} {entryPoints.find(p => p.id === selectedPoint)?.name}
              </h3>
              <div className="inline-block bg-white p-4 rounded-lg mb-4">
                <img src={qrDataUrl} alt="Entry Point QR Code" className="w-64 h-64" />
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => downloadQRCode(entryPoints.find(p => p.id === selectedPoint)?.name || 'entry-point')}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  <Download size={18} />
                  <span>{t('venue.downloadQRCode')}</span>
                </button>
                <button
                  onClick={() => {
                    setQrDataUrl('');
                    setSelectedPoint(null);
                  }}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  {t('venue.close')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-400 text-center py-8">{t('venue.noEntryPoints')}</p>
      )}
    </div>
  );
};

// Vendor Item Configuration Section
const VendorItemSection: React.FC<{ venueId?: string; eventId?: string }> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    price_cents: 0,
    category: 'FOOD',
    description: '',
    available: true
  });

  const categories = ['FOOD', 'BEVERAGE', 'MERCHANDISE', 'SERVICE', 'OTHER'];

  useEffect(() => {
    loadItems();
  }, [venueId, eventId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await venueApi.getVendorItems(venueId, eventId);
      setItems(data);
    } catch (error) {
      console.error('Error loading vendor items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    try {
      await venueApi.createVendorItem({
        ...newItem,
        event_id: eventId
      });
      setShowAddForm(false);
      setNewItem({ name: '', price_cents: 0, category: 'FOOD', description: '', available: true });
      await loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleUpdateItem = async () => {
    try {
      await venueApi.updateVendorItem(editingItem);
      setEditingItem(null);
      await loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm(t('venue.deleteConfirmation'))) return;
    
    try {
      await venueApi.deleteVendorItem(itemId);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Package className="text-purple-400" size={24} />
          <h2 className="text-lg sm:text-xl font-bold text-purple-400">{t('venue.vendorItems')}</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
        >
          {showAddForm ? t('venue.cancel') : t('venue.addItem')}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-800/50 rounded-lg p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('venue.itemName')}</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Hot Dog"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('venue.price')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={(newItem.price_cents / 100).toFixed(2)}
                  onChange={(e) => setNewItem(prev => ({ 
                    ...prev, 
                    price_cents: Math.round(parseFloat(e.target.value || '0') * 100) 
                  }))}
                  className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('venue.description')}</label>
              <input
                type="text"
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('venue.itemDescription')}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAddItem}
              disabled={!newItem.name || newItem.price_cents <= 0}
              className="px-4 py-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Item
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-slate-800/50 rounded-lg p-4">
              {editingItem?.id === item.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={(editingItem.price_cents / 100).toFixed(2)}
                        onChange={(e) => setEditingItem({ 
                          ...editingItem, 
                          price_cents: Math.round(parseFloat(e.target.value || '0') * 100) 
                        })}
                        className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingItem(null)}
                      className="px-3 py-1 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateItem}
                      className="px-3 py-1 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-semibold text-white">{item.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.available 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <p className="text-sm text-slate-400">{item.category}</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(item.price_cents)}</p>
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-2 bg-blue-500/20 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-slate-400 text-center py-8">
          <Package className="mx-auto mb-2 text-slate-600" size={48} />
          <p>{t('venueCommandCenter.noVendorItems')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('venueCommandCenter.addItemsDescription')}</p>
        </div>
      )}
    </div>
  );
};

// Revenue Visibility Section
const RevenueVisibilitySection: React.FC<{ venueId?: string; eventId?: string }> = ({ venueId }) => {
  const { t } = useTranslation();
  const [revenueData, setRevenueData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    loadRevenueData();
  }, [venueId, timeRange]);

  const loadRevenueData = async () => {
    try {
      setLoading(true);
      const stats = await venueApi.getStats(venueId);
      
      setRevenueData({
        total_revenue: stats.total_revenue_cents || 0,
        entry_fees: stats.venue_revenue_cents || 0,
        reentry_fees: stats.venue_revenue_cents || 0,
        vendor_sales: 0, // Would need separate vendor sales tracking
        platform_fees: stats.valid_revenue_cents || 0
      });
    } catch (error) {
      console.error('Error loading revenue data:', error);
      setRevenueData({
        total_revenue: 0,
        entry_fees: 0,
        reentry_fees: 0,
        vendor_sales: 0,
        platform_fees: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Eye className="text-purple-400" size={24} />
          <h2 className="text-lg sm:text-xl font-bold text-purple-400">{t('venueCommandCenter.revenueBreakdown')}</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-500/20 to-transparent rounded-lg p-4 border border-purple-500/30">
            <p className="text-sm text-slate-400 mb-1">{t('venueCommandCenter.totalRevenue')}</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(revenueData?.total_revenue || 0)}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{t('venueCommandCenter.entryFees')}</p>
              <p className="text-lg font-bold text-emerald-400">{formatCurrency(revenueData?.entry_fees || 0)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{t('venueCommandCenter.reEntryFees')}</p>
              <p className="text-lg font-bold text-blue-400">{formatCurrency(revenueData?.reentry_fees || 0)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{t('venueCommandCenter.vendorSales')}</p>
              <p className="text-lg font-bold text-amber-400">{formatCurrency(revenueData?.vendor_sales || 0)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{t('venueCommandCenter.platformFees')}</p>
              <p className="text-lg font-bold text-purple-400">{formatCurrency(revenueData?.platform_fees || 0)}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">{t('venueCommandCenter.revenueDistribution')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{t('venueCommandCenter.yourShare')}</span>
                <span className="text-white font-medium">{formatCurrency(revenueData?.entry_fees || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{t('venueCommandCenter.validPlatformFee')}</span>
                <span className="text-white font-medium">{formatCurrency(revenueData?.platform_fees || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{t('venueCommandCenter.vendorEarnings')}</span>
                <span className="text-white font-medium">{formatCurrency(revenueData?.vendor_sales || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VenueCommandCenter;
