import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { stationApi, revenueProfileApi, taxProfileApi } from '../../lib/api-client';

export const StationManager: React.FC<{ venueId: string; eventId?: string }> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const [stations, setStations] = useState<any[]>([]);
  const [revenueProfiles, setRevenueProfiles] = useState<any[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
      await stationApi.create(formData);
      alert(t('common.success'));
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create station');
    } finally {
      setLoading(false);
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('stations.title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? t('common.cancel') : t('stations.addStation')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('stations.stationId')}</label>
                <input
                  type="text"
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('stations.stationName')}</label>
                <input
                  type="text"
                  value={formData.station_name}
                  onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('stations.stationType')}</label>
              <select
                value={formData.station_type}
                onChange={(e) => setFormData({ ...formData, station_type: e.target.value as any })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="DOOR">{t('stations.door')}</option>
                <option value="BAR">{t('stations.bar')}</option>
                <option value="CONCESSION">{t('stations.concession')}</option>
                <option value="MERCH">{t('stations.merch')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('stations.employeeName')}</label>
                <input
                  type="text"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('stations.employeeId')}</label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('stations.revenueProfile')}</label>
              <select
                value={formData.revenue_profile_id}
                onChange={(e) => setFormData({ ...formData, revenue_profile_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
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
              <label className="block text-sm font-medium mb-1">{t('stations.taxProfile')}</label>
              <select
                value={formData.tax_profile_id}
                onChange={(e) => setFormData({ ...formData, tax_profile_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
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
              <label className="block text-sm font-medium mb-1">{t('stations.idVerificationLevel')}</label>
              <select
                value={formData.id_verification_level}
                onChange={(e) => setFormData({ ...formData, id_verification_level: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value={1}>{t('stations.tier1')}</option>
                <option value={2}>{t('stations.tier2')}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('common.processing') : t('stations.addStation')}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {stations.map((station) => (
          <div key={station.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{station.station_name}</h3>
                <p className="text-sm text-gray-600">ID: {station.station_id}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {station.station_type}
                </span>
              </div>
              <span className={`px-3 py-1 rounded text-sm ${
                station.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {station.status}
              </span>
            </div>
            {station.employee_name && (
              <p className="mt-2 text-sm">
                <span className="text-gray-600">Employee:</span> {station.employee_name} ({station.employee_id})
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
