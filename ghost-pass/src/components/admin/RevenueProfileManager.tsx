import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { revenueProfileApi } from '../../lib/api-client';

export const RevenueProfileManager: React.FC = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    profile_name: '',
    description: '',
    valid_percentage: 40,
    vendor_percentage: 30,
    pool_percentage: 20,
    promoter_percentage: 10,
    executive_percentage: 0,
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await revenueProfileApi.list();
      setProfiles(res.data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const calculateTotal = () => {
    return formData.valid_percentage + formData.vendor_percentage + 
           formData.pool_percentage + formData.promoter_percentage + 
           formData.executive_percentage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const total = calculateTotal();
    if (Math.abs(total - 100) > 0.01) {
      alert(t('revenueProfiles.totalMustBe100'));
      return;
    }

    setLoading(true);
    try {
      await revenueProfileApi.create(formData);
      alert(t('common.success'));
      setShowForm(false);
      setFormData({
        profile_name: '',
        description: '',
        valid_percentage: 40,
        vendor_percentage: 30,
        pool_percentage: 20,
        promoter_percentage: 10,
        executive_percentage: 0,
      });
      loadProfiles();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const total = calculateTotal();
  const isValid = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-lg sm:text-2xl font-bold text-white">{t('revenueProfiles.title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded-lg hover:bg-cyan-500/30 transition-all min-h-[44px] text-sm sm:text-base"
        >
          {showForm ? t('common.cancel') : t('revenueProfiles.createProfile')}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800/50 backdrop-blur-xl p-3 sm:p-4 md:p-6 rounded-xl border border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.profileName')}</label>
              <input
                type="text"
                value={formData.profile_name}
                onChange={(e) => setFormData({ ...formData, profile_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.validPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.valid_percentage}
                  onChange={(e) => setFormData({ ...formData, valid_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none text-sm"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.vendorPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.vendor_percentage}
                  onChange={(e) => setFormData({ ...formData, vendor_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none text-sm"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.poolPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.pool_percentage}
                  onChange={(e) => setFormData({ ...formData, pool_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none text-sm"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.promoterPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.promoter_percentage}
                  onChange={(e) => setFormData({ ...formData, promoter_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none text-sm"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">{t('revenueProfiles.executivePercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.executive_percentage}
                  onChange={(e) => setFormData({ ...formData, executive_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none text-sm"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className={`p-3 rounded-lg text-sm ${isValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {t('common.total')}: {total.toFixed(2)}% {isValid ? '✓' : `⚠ ${t('revenueProfiles.totalMustBe100')}`}
            </div>

            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 py-3 px-4 rounded-lg hover:bg-cyan-500/30 disabled:opacity-50 transition-all min-h-[44px] text-sm sm:text-base"
            >
              {loading ? t('common.processing') : t('revenueProfiles.createProfile')}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-3 sm:gap-4">
        {profiles.map((profile) => (
          <div key={profile.id} className="bg-slate-800/50 backdrop-blur-xl p-3 sm:p-4 rounded-xl border border-slate-700">
            <h3 className="font-bold text-base sm:text-lg mb-2 text-white">{profile.profile_name}</h3>
            {profile.description && <p className="text-slate-400 text-xs sm:text-sm mb-3">{profile.description}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-400 block">VALID:</span>
                <span className="font-medium text-white">{profile.valid_percentage}%</span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-400 block">Vendor:</span>
                <span className="font-medium text-white">{profile.vendor_percentage}%</span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-400 block">Pool:</span>
                <span className="font-medium text-white">{profile.pool_percentage}%</span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-400 block">Promoter:</span>
                <span className="font-medium text-white">{profile.promoter_percentage}%</span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-400 block">Executive:</span>
                <span className="font-medium text-white">{profile.executive_percentage}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
