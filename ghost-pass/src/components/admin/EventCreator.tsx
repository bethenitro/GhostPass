import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { eventApi, venueApi } from '../../lib/api-client';

export const EventCreator: React.FC = () => {
  const { t } = useTranslation();
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    event_id: '',
    venue_id: '',
    venue_name: '',
    event_name: '',
    description: '',
    start_date: '',
    end_date: '',
    ticket_price_cents: 0,
    entry_fee_cents: 0,
    re_entry_fee_cents: 0,
    platform_fee_cents: 25,
    state_tax_percentage: 0,
    local_tax_percentage: 0,
    alcohol_tax_percentage: 0,
    food_tax_percentage: 0,
    // Revenue split percentages (matching revenue_profiles table)
    valid_percentage: 0,
    vendor_percentage: 0,
    pool_percentage: 0,
    promoter_percentage: 0,
    executive_percentage: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const venuesRes = await venueApi.list();
      setVenues(venuesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get venue name from selected venue
      const selectedVenue = venues.find(v => v.venue_id === formData.venue_id);
      
      await eventApi.create({
        ...formData,
        venue_name: selectedVenue?.venue_name || formData.venue_id
      });
      alert(t('events.eventCreated'));
      setFormData({
        event_id: '',
        venue_id: '',
        venue_name: '',
        event_name: '',
        description: '',
        start_date: '',
        end_date: '',
        ticket_price_cents: 0,
        entry_fee_cents: 0,
        re_entry_fee_cents: 0,
        platform_fee_cents: 25,
        state_tax_percentage: 0,
        local_tax_percentage: 0,
        alcohol_tax_percentage: 0,
        food_tax_percentage: 0,
        valid_percentage: 0,
        vendor_percentage: 0,
        pool_percentage: 0,
        promoter_percentage: 0,
        executive_percentage: 0,
      });
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-4">{t('events.createEvent')}</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.eventId')}</label>
          <input
            type="text"
            value={formData.event_id}
            onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.venue')}</label>
          <select
            value={formData.venue_id}
            onChange={(e) => setFormData({ ...formData, venue_id: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
            required
          >
            <option value="">{t('events.selectVenue')}</option>
            {venues.map((venue) => (
              <option key={venue.venue_id} value={venue.venue_id}>
                {venue.venue_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.eventName')}</label>
          <input
            type="text"
            value={formData.event_name}
            onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.description')}</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.startDate')}</label>
            <input
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.endDate')}</label>
            <input
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.ticketPrice')} ($)</label>
            <input
              type="number"
              value={formData.ticket_price_cents / 100}
              onChange={(e) => setFormData({ ...formData, ticket_price_cents: parseFloat(e.target.value) * 100 })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.entryFee')} ($)</label>
            <input
              type="number"
              value={formData.entry_fee_cents / 100}
              onChange={(e) => setFormData({ ...formData, entry_fee_cents: parseFloat(e.target.value) * 100 })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              step="0.01"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.reEntryFee')} ($)</label>
            <input
              type="number"
              value={formData.re_entry_fee_cents / 100}
              onChange={(e) => setFormData({ ...formData, re_entry_fee_cents: parseFloat(e.target.value) * 100 })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.platformFee')} ($)</label>
            <input
              type="number"
              value={formData.platform_fee_cents / 100}
              onChange={(e) => setFormData({ ...formData, platform_fee_cents: parseFloat(e.target.value) * 100 })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              step="0.01"
            />
          </div>
        </div>

        {/* Revenue Split Configuration */}
        <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Revenue Split (%)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">VALID</label>
              <input
                type="number"
                value={formData.valid_percentage}
                onChange={(e) => setFormData({ ...formData, valid_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Vendor</label>
              <input
                type="number"
                value={formData.vendor_percentage}
                onChange={(e) => setFormData({ ...formData, vendor_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Pool</label>
              <input
                type="number"
                value={formData.pool_percentage}
                onChange={(e) => setFormData({ ...formData, pool_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Promoter</label>
              <input
                type="number"
                value={formData.promoter_percentage}
                onChange={(e) => setFormData({ ...formData, promoter_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Executive</label>
              <input
                type="number"
                value={formData.executive_percentage}
                onChange={(e) => setFormData({ ...formData, executive_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-3 p-2 bg-slate-900/50 rounded">
            <p className="text-xs text-slate-400">
              Total Split: <span className={`font-semibold ${
                (formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage) === 100 
                  ? 'text-emerald-400' 
                  : 'text-red-400'
              }`}>
                {(formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage).toFixed(2)}%
              </span>
              {(formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage) !== 100 && (
                <span className="ml-2 text-red-400">(must equal 100%)</span>
              )}
            </p>
          </div>
        </div>

        {/* Tax Configuration */}
        <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Tax Configuration (%)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">State Tax</label>
              <input
                type="number"
                value={formData.state_tax_percentage}
                onChange={(e) => setFormData({ ...formData, state_tax_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g., 5.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Local Tax</label>
              <input
                type="number"
                value={formData.local_tax_percentage}
                onChange={(e) => setFormData({ ...formData, local_tax_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g., 2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Alcohol Tax</label>
              <input
                type="number"
                value={formData.alcohol_tax_percentage}
                onChange={(e) => setFormData({ ...formData, alcohol_tax_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g., 3.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Food Tax</label>
              <input
                type="number"
                value={formData.food_tax_percentage}
                onChange={(e) => setFormData({ ...formData, food_tax_percentage: parseFloat(e.target.value || '0') })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g., 1.5"
              />
            </div>
          </div>
          <div className="mt-3 p-2 bg-slate-900/50 rounded">
            <p className="text-xs text-slate-400">
              Total Base Tax: <span className="text-white font-semibold">
                {(formData.state_tax_percentage + formData.local_tax_percentage).toFixed(2)}%
              </span>
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || (formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage) !== 100}
          className="w-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 py-3 px-4 rounded-xl hover:bg-cyan-500/30 disabled:opacity-50 font-medium transition-all"
        >
          {loading ? t('common.processing') : t('events.createEvent')}
        </button>
      </form>
    </div>
  );
};
