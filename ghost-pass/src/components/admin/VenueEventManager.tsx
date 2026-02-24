import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Calendar, Plus, Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eventApi, revenueProfileApi } from '@/lib/api-client';
import { useToast } from '../ui/toast';

interface VenueEventManagerProps {
  venueId: string;
}

interface Event {
  event_id: string;
  event_name: string;
  description?: string;
  start_date: string;
  end_date: string;
  entry_fee_cents: number;
  re_entry_fee_cents: number;
  ticket_price_cents: number;
  platform_fee_cents: number;
  revenue_profile_id?: string;
  tax_profile_id?: string;
}

export const VenueEventManager: React.FC<VenueEventManagerProps> = ({ venueId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [revenueProfiles, setRevenueProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [useRevenueProfile, setUseRevenueProfile] = useState(false);
  const [selectedRevenueProfileId, setSelectedRevenueProfileId] = useState('');

  const [formData, setFormData] = useState({
    event_id: '',
    venue_id: venueId,
    venue_name: '',
    event_name: '',
    description: '' as string | undefined,
    start_date: '',
    end_date: '',
    ticket_price_cents: 0,
    entry_fee_cents: 500,
    re_entry_fee_cents: 200,
    platform_fee_cents: 25,
    // Tax percentages
    state_tax_percentage: 0,
    local_tax_percentage: 0,
    alcohol_tax_percentage: 0,
    food_tax_percentage: 0,
    // Revenue split percentages
    valid_percentage: 0,
    vendor_percentage: 0,
    pool_percentage: 0,
    promoter_percentage: 0,
    executive_percentage: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, revenueProfilesRes] = await Promise.all([
        eventApi.list({ venue_id: venueId }),
        revenueProfileApi.list()
      ]);
      setEvents(eventsRes.data || []);
      setRevenueProfiles(revenueProfilesRes.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      // Don't show error toast for 401 - the router will handle it
      if (error.response?.status !== 401) {
        showToast(error.response?.data?.error || t('common.error'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevenueProfileChange = (profileId: string) => {
    setSelectedRevenueProfileId(profileId);
    if (profileId) {
      const profile = revenueProfiles.find(p => p.id === profileId);
      if (profile) {
        setFormData({
          ...formData,
          valid_percentage: profile.valid_percentage,
          vendor_percentage: profile.vendor_percentage,
          pool_percentage: profile.pool_percentage,
          promoter_percentage: profile.promoter_percentage,
          executive_percentage: profile.executive_percentage || 0,
        });
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.event_id.trim()) {
      newErrors.event_id = t('events.eventId') + ' is required';
    }
    if (!formData.event_name.trim()) {
      newErrors.event_name = t('events.eventName') + ' is required';
    }
    if (!formData.start_date) {
      newErrors.start_date = t('events.startDate') + ' is required';
    }
    if (!formData.end_date) {
      newErrors.end_date = t('events.endDate') + ' is required';
    }
    if (formData.start_date && formData.end_date && new Date(formData.start_date) >= new Date(formData.end_date)) {
      newErrors.end_date = 'End date must be after start date';
    }
    if (formData.entry_fee_cents < 0) {
      newErrors.entry_fee_cents = 'Entry fee cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Please fix form errors', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Use venueId as venue_name if venue_name is not set
      const submitData = {
        ...formData,
        venue_name: formData.venue_name || venueId
      };
      
      if (editingEvent) {
        // Update existing event
        await eventApi.update(editingEvent.event_id, submitData);
        showToast('Event updated successfully', 'success');
      } else {
        // Create new event
        await eventApi.create(submitData);
        showToast(t('events.eventCreated'), 'success');
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Failed to save event:', error);
      
      // Handle duplicate event ID error
      if (error.response?.status === 409 || error.response?.data?.detail?.includes('duplicate')) {
        showToast('Event ID already exists. Please use a different event ID.', 'error');
      } else {
        showToast(error.response?.data?.error || `Failed to ${editingEvent ? 'update' : 'create'} event`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventApi.delete(eventId);
      showToast('Event deleted successfully', 'success');
      loadData();
    } catch (error: any) {
      console.error('Failed to delete event:', error);
      showToast(error.response?.data?.error || 'Failed to delete event', 'error');
    }
  };

  const resetForm = () => {
    // Preserve dates when resetting
    const preservedDates = {
      start_date: formData.start_date,
      end_date: formData.end_date,
    };
    
    setFormData({
      event_id: '',
      venue_id: venueId,
      venue_name: '',
      event_name: '',
      description: '' as string | undefined,
      start_date: preservedDates.start_date,
      end_date: preservedDates.end_date,
      ticket_price_cents: 0,
      entry_fee_cents: 500,
      re_entry_fee_cents: 200,
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
    setErrors({});
    setEditingEvent(null);
    setUseRevenueProfile(false);
    setSelectedRevenueProfileId('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{t('events.myEvents')}</h2>
        <button 
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-400 transition-all min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">{showForm ? t('common.cancel') : t('events.createEvent')}</span>
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 md:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('events.eventId')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.event_id}
                  onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                  disabled={!!editingEvent}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    editingEvent && 'opacity-50 cursor-not-allowed',
                    errors.event_id ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-purple-500/50'
                  )}
                  placeholder="event_001"
                />
                {errors.event_id && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.event_id}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('events.eventName')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.event_name ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-purple-500/50'
                  )}
                  placeholder="Summer Festival 2026"
                />
                {errors.event_name && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.event_name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                rows={2}
                placeholder="Event description..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('events.startDate')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.start_date ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-purple-500/50'
                  )}
                />
                {errors.start_date && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.start_date}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('events.endDate')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.end_date ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-purple-500/50'
                  )}
                />
                {errors.end_date && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.end_date}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.ticketPrice')} ($)</label>
                <input
                  type="number"
                  value={formData.ticket_price_cents / 100 || ''}
                  onChange={(e) => setFormData({ ...formData, ticket_price_cents: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value) * 100) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.entryFee')} ($)</label>
                <input
                  type="number"
                  value={formData.entry_fee_cents / 100 || ''}
                  onChange={(e) => setFormData({ ...formData, entry_fee_cents: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value) * 100) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.reEntryFee')} ($)</label>
                <input
                  type="number"
                  value={formData.re_entry_fee_cents / 100 || ''}
                  onChange={(e) => setFormData({ ...formData, re_entry_fee_cents: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value) * 100) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('events.platformFee')} ($)</label>
                <input
                  type="number"
                  value={formData.platform_fee_cents / 100 || ''}
                  onChange={(e) => setFormData({ ...formData, platform_fee_cents: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value) * 100) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {/* Revenue Split Configuration */}
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-300">Revenue Split (%)</h4>
                <label className="flex items-center space-x-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={useRevenueProfile}
                    onChange={(e) => {
                      setUseRevenueProfile(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedRevenueProfileId('');
                      }
                    }}
                    className="rounded border-slate-600 bg-slate-900/50 text-purple-500 focus:ring-purple-500/50"
                  />
                  <span>Use Profile</span>
                </label>
              </div>

              {useRevenueProfile && (
                <div className="mb-4">
                  <select
                    value={selectedRevenueProfileId}
                    onChange={(e) => handleRevenueProfileChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    <option value="">Select Revenue Profile</option>
                    {revenueProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.profile_name} - VALID: {profile.valid_percentage}%, Vendor: {profile.vendor_percentage}%, Pool: {profile.pool_percentage}%
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">VALID</label>
                  <input
                    type="number"
                    value={formData.valid_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, valid_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={useRevenueProfile && !!selectedRevenueProfileId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Vendor</label>
                  <input
                    type="number"
                    value={formData.vendor_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={useRevenueProfile && !!selectedRevenueProfileId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pool</label>
                  <input
                    type="number"
                    value={formData.pool_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, pool_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={useRevenueProfile && !!selectedRevenueProfileId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Promoter</label>
                  <input
                    type="number"
                    value={formData.promoter_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, promoter_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={useRevenueProfile && !!selectedRevenueProfileId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Executive</label>
                  <input
                    type="number"
                    value={formData.executive_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, executive_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={useRevenueProfile && !!selectedRevenueProfileId}
                  />
                </div>
              </div>
              <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs">
                <span className="text-slate-400">Total: </span>
                <span className={`font-semibold ${
                  (formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage) === 100 
                    ? 'text-emerald-400' 
                    : 'text-red-400'
                }`}>
                  {(formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage).toFixed(2)}%
                </span>
                {(formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage) !== 100 && (
                  <span className="ml-2 text-red-400">(must equal 100%)</span>
                )}
              </div>
            </div>

            {/* Tax Configuration */}
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Tax Configuration (%)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">State Tax</label>
                  <input
                    type="number"
                    value={formData.state_tax_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, state_tax_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Local Tax</label>
                  <input
                    type="number"
                    value={formData.local_tax_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, local_tax_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Alcohol Tax</label>
                  <input
                    type="number"
                    value={formData.alcohol_tax_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, alcohol_tax_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Food Tax</label>
                  <input
                    type="number"
                    value={formData.food_tax_percentage || ''}
                    onChange={(e) => setFormData({ ...formData, food_tax_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs text-slate-400">
                Total Base Tax (State + Local): <span className="text-white font-semibold">
                  {(formData.state_tax_percentage + formData.local_tax_percentage).toFixed(2)}%
                </span>
                <br />
                Total All Taxes: <span className="text-white font-semibold">
                  {(formData.state_tax_percentage + formData.local_tax_percentage + formData.alcohol_tax_percentage + formData.food_tax_percentage).toFixed(2)}%
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || (formData.valid_percentage + formData.vendor_percentage + formData.pool_percentage + formData.promoter_percentage + formData.executive_percentage) !== 100}
              className="w-full bg-purple-500/20 border border-purple-500/50 text-purple-400 py-3 px-4 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                editingEvent ? 'Update Event' : t('events.createEvent')
              )}
            </button>
          </form>
        </motion.div>
      )}

      {events.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{t('events.noEvents')}</p>
          <p className="text-slate-500 text-sm mt-2">{t('events.createFirstEvent')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <motion.div
              key={event.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:border-purple-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium text-lg">{event.event_name}</h3>
                  <p className="text-slate-400 text-sm mt-1">{event.description}</p>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs">
                    <span className="text-slate-500">
                      {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                    </span>
                    <span className="text-green-400">Entry: ${(event.entry_fee_cents / 100).toFixed(2)}</span>
                    <span className="text-cyan-400">Re-entry: ${(event.re_entry_fee_cents / 100).toFixed(2)}</span>
                    {event.ticket_price_cents > 0 && (
                      <span className="text-purple-400">Ticket: ${(event.ticket_price_cents / 100).toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button 
                    onClick={() => {
                      setEditingEvent(event);
                      
                      // Extract metadata values if they exist
                      const metadata = (event as any).metadata || {};
                      
                      // Format dates for datetime-local input (remove timezone and milliseconds)
                      const formatDateForInput = (dateString: string) => {
                        if (!dateString) return '';
                        const date = new Date(dateString);
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        return `${year}-${month}-${day}T${hours}:${minutes}`;
                      };
                      
                      setFormData({
                        event_id: event.event_id,
                        venue_id: venueId,
                        venue_name: '',
                        event_name: event.event_name,
                        description: (event.description || '') as string | undefined,
                        start_date: formatDateForInput(event.start_date),
                        end_date: formatDateForInput(event.end_date),
                        ticket_price_cents: event.ticket_price_cents,
                        entry_fee_cents: event.entry_fee_cents,
                        re_entry_fee_cents: event.re_entry_fee_cents,
                        platform_fee_cents: event.platform_fee_cents,
                        state_tax_percentage: metadata.state_tax_percentage || 0,
                        local_tax_percentage: metadata.local_tax_percentage || 0,
                        alcohol_tax_percentage: metadata.alcohol_tax_percentage || 0,
                        food_tax_percentage: metadata.food_tax_percentage || 0,
                        valid_percentage: metadata.valid_percentage || 0,
                        vendor_percentage: metadata.vendor_percentage || 0,
                        pool_percentage: metadata.pool_percentage || 0,
                        promoter_percentage: metadata.promoter_percentage || 0,
                        executive_percentage: metadata.executive_percentage || 0,
                      });
                      setShowForm(true);
                    }}
                    className="p-2 hover:bg-slate-600/50 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4 text-slate-400 hover:text-white" />
                  </button>
                  <button 
                    onClick={() => handleDelete(event.event_id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
