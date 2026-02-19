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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('revenueProfiles.title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? t('common.cancel') : t('revenueProfiles.createProfile')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('revenueProfiles.profileName')}</label>
              <input
                type="text"
                value={formData.profile_name}
                onChange={(e) => setFormData({ ...formData, profile_name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('revenueProfiles.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('revenueProfiles.validPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.valid_percentage}
                  onChange={(e) => setFormData({ ...formData, valid_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('revenueProfiles.vendorPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.vendor_percentage}
                  onChange={(e) => setFormData({ ...formData, vendor_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('revenueProfiles.poolPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.pool_percentage}
                  onChange={(e) => setFormData({ ...formData, pool_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('revenueProfiles.promoterPercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.promoter_percentage}
                  onChange={(e) => setFormData({ ...formData, promoter_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('revenueProfiles.executivePercentage')} (%)</label>
                <input
                  type="number"
                  value={formData.executive_percentage}
                  onChange={(e) => setFormData({ ...formData, executive_percentage: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className={`p-3 rounded ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {t('common.total')}: {total.toFixed(2)}% {isValid ? '✓' : `⚠ ${t('revenueProfiles.totalMustBe100')}`}
            </div>

            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('common.processing') : t('revenueProfiles.createProfile')}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <div key={profile.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-2">{profile.profile_name}</h3>
            {profile.description && <p className="text-gray-600 text-sm mb-3">{profile.description}</p>}
            <div className="grid grid-cols-5 gap-2 text-sm">
              <div>
                <span className="text-gray-600">VALID:</span>
                <span className="ml-1 font-medium">{profile.valid_percentage}%</span>
              </div>
              <div>
                <span className="text-gray-600">Vendor:</span>
                <span className="ml-1 font-medium">{profile.vendor_percentage}%</span>
              </div>
              <div>
                <span className="text-gray-600">Pool:</span>
                <span className="ml-1 font-medium">{profile.pool_percentage}%</span>
              </div>
              <div>
                <span className="text-gray-600">Promoter:</span>
                <span className="ml-1 font-medium">{profile.promoter_percentage}%</span>
              </div>
              <div>
                <span className="text-gray-600">Executive:</span>
                <span className="ml-1 font-medium">{profile.executive_percentage}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
