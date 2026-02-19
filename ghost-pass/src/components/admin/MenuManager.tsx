import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { menuApi, revenueProfileApi } from '../../lib/api-client';
import { Plus, Loader2, Trash2, Beer, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { useToast } from '../ui/toast';

export const MenuManager: React.FC<{ venueId: string; eventId?: string }> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
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
      showToast(t('common.success'), 'success');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create menu item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('forms.confirmations.deleteItem'))) return;

    try {
      await menuApi.delete(id);
      showToast('Item deleted successfully', 'success');
      loadData();
    } catch (error) {
      showToast('Failed to delete item', 'error');
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

  const getStationIcon = (type: string) => {
    switch (type) {
      case 'BAR': return <Beer className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'CONCESSION': return <UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'MERCH': return <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">{t('menu.title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto px-4 py-3 bg-cyan-500/20 border border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors flex items-center justify-center space-x-2 min-h-[44px]"
        >
          {showForm ? (
            <span>{t('common.cancel')}</span>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>{t('menu.addItem')}</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {(['BAR', 'CONCESSION', 'MERCH'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setSelectedStation(type);
              setFormData({ ...formData, station_type: type });
            }}
            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors min-h-[44px] ${
              selectedStation === type
                ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {getStationIcon(type)}
            <span className="text-sm sm:text-base">{t(`menu.${type.toLowerCase()}Menu`)}</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4">
            {t('menu.addItem')} - {selectedStation}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('menu.itemName')}</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-cyan-500 focus:outline-none min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('menu.category')}</label>
                <input
                  type="text"
                  value={formData.item_category}
                  onChange={(e) => setFormData({ ...formData, item_category: e.target.value })}
                  placeholder="e.g., Beer, Spirits, Snacks"
                  className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-cyan-500 focus:outline-none min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('menu.price')} ($)</label>
              <input
                type="number"
                value={formData.price_cents / 100}
                onChange={(e) => setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) })}
                className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-cyan-500 focus:outline-none min-h-[44px]"
                step="0.01"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 bg-slate-950/30 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-950/50 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={formData.is_taxable}
                  onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-sm sm:text-base text-slate-200">{t('menu.taxable')}</span>
              </label>
              <label className="flex items-center space-x-3 p-3 bg-slate-950/30 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-950/50 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={formData.is_alcohol}
                  onChange={(e) => setFormData({ ...formData, is_alcohol: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm sm:text-base text-slate-200">{t('menu.alcohol')} (applies alcohol tax)</span>
              </label>
              <label className="flex items-center space-x-3 p-3 bg-slate-950/30 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-950/50 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={formData.is_food}
                  onChange={(e) => setFormData({ ...formData, is_food: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm sm:text-base text-slate-200">{t('menu.food')} (applies food tax)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">{t('menu.assignRevenueProfile')}</label>
              <select
                value={formData.revenue_profile_id}
                onChange={(e) => setFormData({ ...formData, revenue_profile_id: e.target.value })}
                className="w-full px-3 py-3 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-base focus:border-cyan-500 focus:outline-none min-h-[44px]"
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
              className="w-full bg-cyan-500/20 border border-cyan-500 text-cyan-400 py-3 px-4 rounded-lg hover:bg-cyan-500/30 disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('common.processing')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('menu.addItem')}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {items.length === 0 ? (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-6 sm:p-8 text-center">
            <div className="flex justify-center mb-3">
              {getStationIcon(selectedStation)}
            </div>
            <p className="text-slate-400 text-sm sm:text-base">
              No items in {selectedStation} menu. Add your first item above.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4 sm:p-5">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="text-base sm:text-lg font-bold text-white break-words">{item.item_name}</h3>
                  </div>
                  {item.item_category && (
                    <p className="text-xs sm:text-sm text-slate-400 mb-2">{item.item_category}</p>
                  )}
                  <p className="text-xl sm:text-2xl font-bold text-cyan-400 mb-3">
                    ${(item.price_cents / 100).toFixed(2)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.is_taxable && (
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs">
                        Taxable
                      </span>
                    )}
                    {item.is_alcohol && (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-1 rounded text-xs">
                        Alcohol
                      </span>
                    )}
                    {item.is_food && (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs">
                        Food
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex-shrink-0 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
