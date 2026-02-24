import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { stationApi, revenueProfileApi, taxProfileApi } from '../../lib/api-client';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { useToast } from '../ui/toast';

export const StationManager: React.FC<{ venueId: string; eventId?: string }> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [stations, setStations] = useState<any[]>([]);
  const [revenueProfiles, setRevenueProfiles] = useState<any[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStation, setEditingStation] = useState<any>(null);

  const [formData, setFormData] = useState({
    station_id: '',
    venue_id: venueId,
    event_id: eventId,
    station_name: '',
    station_type: 'DOOR' as 'DOOR' | 'BAR' | 'CONCESSION' | 'MERCH',
    revenue_profile_id: '',
    tax_profile_id: '',
    employee_id: '',
    employee_name: '',
    id_verification_level: 1,
  });

  useEffect(() => {
    loadData();
  }, [venueId, eventId]);

  const loadData = async () => {
    try {
      const [stationsRes, revenueRes, taxRes] = await Promise.all([
        stationApi.list({ venue_id: venueId, event_id: eventId }),
        revenueProfileApi.list(),
        taxProfileApi.list(venueId),
      ]);
      setStations(stationsRes.data);
      setRevenueProfiles(revenueRes.data);
      setTaxProfiles(taxRes.data);
    } catch (error) {
      console.error('Failed to load station data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingStation) {
        await stationApi.update(editingStation.id, formData);
        showToast('Station updated successfully', 'success');
      } else {
        await stationApi.create(formData);
        showToast('Station created successfully', 'success');
      }
      setShowForm(false);
      setEditingStation(null);
      resetForm();
      loadData();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to save station', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (station: any) => {
    setEditingStation(station);
    setFormData({
      station_id: station.station_id,
      venue_id: station.venue_id,
      event_id: station.event_id,
      station_name: station.station_name,
      station_type: station.station_type,
      revenue_profile_id: station.revenue_profile_id || '',
      tax_profile_id: station.tax_profile_id || '',
      employee_id: station.employee_id || '',
      employee_name: station.employee_name || '',
      id_verification_level: station.id_verification_level || 1,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this station?')) return;

    try {
      await stationApi.delete(id);
      showToast('Station deleted successfully', 'success');
      loadData();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete station', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      station_id: '',
      venue_id: venueId,
      event_id: eventId,
      station_name: '',
      station_type: 'DOOR',
      revenue_profile_id: '',
      tax_profile_id: '',
      employee_id: '',
      employee_name: '',
      id_verification_level: 1,
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStation(null);
    resetForm();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('stations.title')}</h2>
        <button
          onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setShowForm(true);
            }
          }}
          className="bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded hover:bg-cyan-500/30 flex items-center space-x-2 min-h-[44px]"
        >
          {showForm ? (
            <span>{t('common.cancel')}</span>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>{t('stations.addStation')}</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800/50 backdrop-blur-xl p-6 rounded-xl border border-slate-700 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingStation ? 'Edit Station' : 'Create New Station'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.stationId')}</label>
                <input
                  type="text"
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                  required
                  disabled={!!editingStation}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.stationName')}</label>
                <input
                  type="text"
                  value={formData.station_name}
                  onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.stationType')}</label>
              <select
                value={formData.station_type}
                onChange={(e) => setFormData({ ...formData, station_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="DOOR">{t('stations.door')}</option>
                <option value="BAR">{t('stations.bar')}</option>
                <option value="CONCESSION">{t('stations.concession')}</option>
                <option value="MERCH">{t('stations.merch')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.employeeName')}</label>
                <input
                  type="text"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.employeeId')}</label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.revenueProfile')}</label>
              <select
                value={formData.revenue_profile_id}
                onChange={(e) => setFormData({ ...formData, revenue_profile_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="">{t('events.selectProfile')}</option>
                {revenueProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profile_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.taxProfile')}</label>
              <select
                value={formData.tax_profile_id}
                onChange={(e) => setFormData({ ...formData, tax_profile_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="">{t('events.selectProfile')}</option>
                {taxProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profile_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('stations.idVerificationLevel')}</label>
              <select
                value={formData.id_verification_level}
                onChange={(e) => setFormData({ ...formData, id_verification_level: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
              >
                <option value={1}>{t('stations.tier1')}</option>
                <option value={2}>Tier 2 - Footprint Real ID</option>
                <option value={3}>Tier 3 - Footprint Deep Check</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 py-2 px-4 rounded hover:bg-cyan-500/30 disabled:opacity-50 min-h-[44px]"
            >
              {loading ? t('common.processing') : editingStation ? 'Update Station' : t('stations.addStation')}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {stations.map((station) => (
          <div key={station.id} className="bg-slate-800/50 backdrop-blur-xl p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{station.station_name}</h3>
                <p className="text-sm text-slate-400">ID: {station.station_id}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {station.station_type}
                </span>
                {station.employee_name && (
                  <p className="mt-2 text-sm">
                    <span className="text-slate-400">Employee:</span> {station.employee_name} ({station.employee_id})
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded text-sm ${
                  station.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                }`}>
                  {station.status}
                </span>
                <button
                  onClick={() => handleEdit(station)}
                  className="p-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded hover:bg-blue-500/20 min-h-[44px] min-w-[44px]"
                  title="Edit station"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(station.id)}
                  className="p-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded hover:bg-red-500/20 min-h-[44px] min-w-[44px]"
                  title="Delete station"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
