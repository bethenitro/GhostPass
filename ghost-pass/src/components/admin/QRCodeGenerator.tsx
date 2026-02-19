import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, Download, Loader2, Plus } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { useToast } from '../ui/toast';

interface QRCodeGeneratorProps {
  venueId?: string;
  eventId?: string;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    asset_type: 'QR' as 'QR' | 'NFC',
    venue_id: venueId || '',
    event_id: eventId || '',
    station_type: 'DOOR' as 'DOOR' | 'BAR' | 'CONCESSION' | 'MERCH',
    station_id: '',
    revenue_profile_id: '',
    tax_profile_id: '',
    id_verification_level: 1
  });

  const generateQRCode = async () => {
    try {
      setLoading(true);
      
      // Create QR asset via API
      const response = await fetch('/api/qr-assets/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          asset_type: formData.asset_type,
          venue_id: formData.venue_id,
          event_id: formData.event_id,
          station_id: formData.station_id,
          revenue_profile_id: formData.revenue_profile_id,
          tax_profile_id: formData.tax_profile_id,
          fee_logic: {},
          re_entry_rules: {},
          id_verification_level: formData.id_verification_level
        })
      });

      if (!response.ok) throw new Error('Failed to provision QR asset');
      
      const asset = await response.json();
      setSelectedAsset(asset);

      // Generate QR code image
      const qrData = JSON.stringify({
        type: 'ENTRY_POINT',
        asset_code: asset.asset_code,
        venue_id: asset.venue_id,
        event_id: asset.event_id,
        station_id: asset.station_id,
        station_type: formData.station_type,
        timestamp: new Date().toISOString()
      });

      const dataUrl = await QRCodeLib.toDataURL(qrData, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrDataUrl(dataUrl);
      showToast('QR Code generated successfully', 'success');
    } catch (error: any) {
      console.error('Error generating QR code:', error);
      showToast(error.message || 'Failed to generate QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrDataUrl) return;
    
    const link = document.createElement('a');
    link.download = `qr-${formData.station_type}-${formData.station_id || 'new'}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-3">
        <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
        <h2 className="text-lg sm:text-xl font-bold text-white">{t('qr.title', 'QR Code Generator')}</h2>
      </div>

      {/* Configuration Form */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4">{t('qr.assetConfig', 'Asset Configuration')}</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('qr.assetType', 'Asset Type')}</label>
            <select
              value={formData.asset_type}
              onChange={(e) => setFormData({ ...formData, asset_type: e.target.value as 'QR' | 'NFC' })}
              className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-blue-500 focus:outline-none min-h-[44px]"
            >
              <option value="QR">{t('qr.qrCode', 'QR Code')}</option>
              <option value="NFC">{t('qr.nfcTag', 'NFC Tag')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('qr.stationType', 'Station Type')}</label>
            <select
              value={formData.station_type}
              onChange={(e) => setFormData({ ...formData, station_type: e.target.value as any })}
              className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-blue-500 focus:outline-none min-h-[44px]"
            >
              <option value="DOOR">{t('qr.door', 'Door / Entry')}</option>
              <option value="BAR">{t('qr.bar', 'Bar')}</option>
              <option value="CONCESSION">{t('qr.concession', 'Concession')}</option>
              <option value="MERCH">{t('qr.merch', 'Merchandise')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('qr.stationId', 'Station ID')}</label>
            <input
              type="text"
              value={formData.station_id}
              onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
              placeholder={t('qr.stationIdPlaceholder', 'e.g., DOOR-001')}
              className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-blue-500 focus:outline-none min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('qr.idVerification', 'ID Verification Level')}</label>
            <select
              value={formData.id_verification_level}
              onChange={(e) => setFormData({ ...formData, id_verification_level: parseInt(e.target.value) })}
              className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-blue-500 focus:outline-none min-h-[44px]"
            >
              <option value={1}>{t('qr.tier1', 'Tier 1 - Manual Log')}</option>
              <option value={2}>{t('qr.tier2', 'Tier 2 - Age Verification')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('qr.revenueProfile', 'Revenue Profile ID (Optional)')}</label>
            <input
              type="text"
              value={formData.revenue_profile_id}
              onChange={(e) => setFormData({ ...formData, revenue_profile_id: e.target.value })}
              placeholder={t('qr.revenueProfilePlaceholder', 'Leave empty for event default')}
              className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-blue-500 focus:outline-none min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('qr.taxProfile', 'Tax Profile ID (Optional)')}</label>
            <input
              type="text"
              value={formData.tax_profile_id}
              onChange={(e) => setFormData({ ...formData, tax_profile_id: e.target.value })}
              placeholder={t('qr.taxProfilePlaceholder', 'Leave empty for event default')}
              className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-blue-500 focus:outline-none min-h-[44px]"
            />
          </div>
        </div>

        <button
          onClick={generateQRCode}
          disabled={loading || !formData.venue_id}
          className="mt-4 w-full sm:w-auto px-6 py-3 bg-blue-500/20 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>{t('qr.generate', 'Generate QR Code')}</span>
        </button>
      </div>

      {/* QR Code Display */}
      {qrDataUrl && selectedAsset && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4 sm:p-6 text-center">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4">
            {t('qr.generatedTitle', 'Generated QR Code')}
          </h3>
          
          <div className="inline-block bg-white p-4 rounded-lg mb-4">
            <img src={qrDataUrl} alt="Generated QR Code" className="w-64 h-64 sm:w-80 sm:h-80" />
          </div>

          <div className="bg-slate-950/50 border border-slate-700 rounded-lg p-3 sm:p-4 mb-4 text-left">
            <p className="text-xs sm:text-sm text-slate-400 mb-1">{t('qr.assetCode', 'Asset Code')}:</p>
            <p className="text-sm sm:text-base text-white font-mono break-all">{selectedAsset.asset_code}</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-1">{t('qr.stationType', 'Station Type')}:</p>
            <p className="text-sm sm:text-base text-white">{formData.station_type}</p>
            {formData.station_id && (
              <>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-1">{t('qr.stationId', 'Station ID')}:</p>
                <p className="text-sm sm:text-base text-white">{formData.station_id}</p>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={downloadQRCode}
              className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>{t('qr.download', 'Download QR Code')}</span>
            </button>
            <button
              onClick={() => {
                setQrDataUrl('');
                setSelectedAsset(null);
              }}
              className="px-6 py-3 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors min-h-[44px]"
            >
              {t('qr.generateAnother', 'Generate Another')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
