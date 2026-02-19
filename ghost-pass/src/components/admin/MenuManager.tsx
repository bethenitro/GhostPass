import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { menuApi, revenueProfileApi } from '../../lib/api-client';

export const MenuManager: React.FC<{ venueId: string; eventId?: string }> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedStation, setSelectedStation] = useState<'BAR' | 'CONCESSION' | 'MERCH'>('BAR');

  const [formData, setFormData] = useState({
    venue_id: venueId,
    event_id: eventId,
    station_type: 'BAR' as 'BAR' | 'CONCESSION' | 'MERCH',
    item_name: '',
    item_category: '',
    price_cents: 0,
    is_taxable: true,
    is_alcohol: false,
    is_food: false,
    revenue_profile_id: '',
  });

  useEffect(() => {
    loadData();
  }, [venueId, eventId, selectedStation]);

  const loadData = async () => {
    try {
      const [itemsRes, profilesRes] = await Promise.all([
        menuApi.list({ venue_id: venueId, event_id: eventId, station_type: selectedStation }),
        revenueProfileApi.list(),
      ]);
      setItems(itemsRes.data);
      setProfiles(profilesRes.data);
    } catch (error) {
      console.error('Failed to load menu data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await menuApi.create({ ...formData, venue_id: venueId, event_id: eventId });
      alert(t('common.success'));
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create menu item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('forms.confirmations.deleteItem'))) return;

    try {
      await menuApi.delete(id);
      loadData();
    } catch (error) {
      alert('Failed to delete item');
    }
  };

  const resetForm = () => {
    setFormData({
      venue_id: venueId,
      event_id: eventId,
      station_type: selectedStation,
      item_name: '',
      item_category: '',
      price_cents: 0,
      is_taxable: true,
      is_alcohol: false,
      is_food: false,
      revenue_profile_id: '',
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('menu.title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? t('common.cancel') : t('menu.addItem')}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['BAR', 'CONCESSION', 'MERCH'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedStation(type)}
            className={`px-4 py-2 rounded ${
              selectedStation === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t(`menu.${type.toLowerCase()}Menu`)}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('menu.itemName')}</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('menu.category')}</label>
                <input
                  type="text"
                  value={formData.item_category}
                  onChange={(e) => setFormData({ ...formData, item_category: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('menu.price')} ($)</label>
              <input
                type="number"
                value={formData.price_cents / 100}
                onChange={(e) => setFormData({ ...formData, price_cents: parseFloat(e.target.value) * 100 })}
                className="w-full px-3 py-2 border rounded"
                step="0.01"
                required
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_taxable}
                  onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                  className="mr-2"
                />
                {t('menu.taxable')}
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_alcohol}
                  onChange={(e) => setFormData({ ...formData, is_alcohol: e.target.checked })}
                  className="mr-2"
                />
                {t('menu.alcohol')}
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_food}
                  onChange={(e) => setFormData({ ...formData, is_food: e.target.checked })}
                  className="mr-2"
                />
                {t('menu.food')}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('menu.assignRevenueProfile')}</label>
              <select
                value={formData.revenue_profile_id}
                onChange={(e) => setFormData({ ...formData, revenue_profile_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">{t('events.selectProfile')}</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profile_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('common.processing') : t('menu.addItem')}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
            <div>
              <h3 className="font-bold">{item.item_name}</h3>
              {item.item_category && <p className="text-sm text-gray-600">{item.item_category}</p>}
              <p className="text-lg font-semibold mt-1">${(item.price_cents / 100).toFixed(2)}</p>
              <div className="flex gap-2 mt-2 text-xs">
                {item.is_taxable && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Taxable</span>}
                {item.is_alcohol && <span className="bg-red-100 text-red-800 px-2 py-1 rounded">Alcohol</span>}
                {item.is_food && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Food</span>}
              </div>
            </div>
            <button
              onClick={() => handleDelete(item.id)}
              className="text-red-600 hover:text-red-800"
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
