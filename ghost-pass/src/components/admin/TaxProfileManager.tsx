import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Plus, Loader2, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { taxProfileApi } from '@/lib/api-client';
import { useToast } from '../ui/toast';
import { cn } from '@/lib/utils';

interface TaxProfile {
  id: string;
  profile_name: string;
  venue_id?: string;
  state_tax_percentage: number;
  local_tax_percentage: number;
  alcohol_tax_percentage: number;
  food_tax_percentage: number;
  is_active: boolean;
}

export const TaxProfileManager: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<TaxProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    profile_name: '',
    venue_id: '',
    state_tax_percentage: 0,
    local_tax_percentage: 0,
    alcohol_tax_percentage: 0,
    food_tax_percentage: 0,
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await taxProfileApi.list();
      setProfiles(response.data || []);
    } catch (error: any) {
      console.error('Failed to load tax profiles:', error);
      showToast(error.response?.data?.error || 'Failed to load tax profiles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.profile_name.trim()) {
      newErrors.profile_name = 'Profile name is required';
    }
    if (formData.state_tax_percentage < 0 || formData.state_tax_percentage > 100) {
      newErrors.state_tax_percentage = 'Must be between 0 and 100';
    }
    if (formData.local_tax_percentage < 0 || formData.local_tax_percentage > 100) {
      newErrors.local_tax_percentage = 'Must be between 0 and 100';
    }
    if (formData.alcohol_tax_percentage < 0 || formData.alcohol_tax_percentage > 100) {
      newErrors.alcohol_tax_percentage = 'Must be between 0 and 100';
    }
    if (formData.food_tax_percentage < 0 || formData.food_tax_percentage > 100) {
      newErrors.food_tax_percentage = 'Must be between 0 and 100';
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
      await taxProfileApi.create(formData);
      showToast('Tax profile created successfully', 'success');
      setShowForm(false);
      resetForm();
      loadProfiles();
    } catch (error: any) {
      console.error('Failed to create tax profile:', error);
      showToast(error.response?.data?.error || 'Failed to create tax profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      profile_name: '',
      venue_id: '',
      state_tax_percentage: 0,
      local_tax_percentage: 0,
      alcohol_tax_percentage: 0,
      food_tax_percentage: 0,
      is_active: true,
    });
    setErrors({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">{t('taxProfiles.title')}</h2>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-400 transition-all min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">{showForm ? t('common.cancel') : t('taxProfiles.createProfile')}</span>
        </button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <p className="text-amber-400 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {t('taxProfiles.taxBeforeSplit')}
        </p>
      </div>

      {showForm && (
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Profile Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.profile_name}
                onChange={(e) => setFormData({ ...formData, profile_name: e.target.value })}
                className={cn(
                  "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                  errors.profile_name ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-amber-500/50'
                )}
                placeholder="California Standard Tax"
              />
              {errors.profile_name && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.profile_name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('taxProfiles.stateTax')} (%)
                </label>
                <input
                  type="number"
                  value={formData.state_tax_percentage}
                  onChange={(e) => setFormData({ ...formData, state_tax_percentage: parseFloat(e.target.value || '0') })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.state_tax_percentage ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-amber-500/50'
                  )}
                  step="0.01"
                  min="0"
                  max="100"
                />
                {errors.state_tax_percentage && (
                  <p className="text-red-400 text-xs mt-1">{errors.state_tax_percentage}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('taxProfiles.localTax')} (%)
                </label>
                <input
                  type="number"
                  value={formData.local_tax_percentage}
                  onChange={(e) => setFormData({ ...formData, local_tax_percentage: parseFloat(e.target.value || '0') })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.local_tax_percentage ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-amber-500/50'
                  )}
                  step="0.01"
                  min="0"
                  max="100"
                />
                {errors.local_tax_percentage && (
                  <p className="text-red-400 text-xs mt-1">{errors.local_tax_percentage}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('taxProfiles.alcoholTax')} (%)
                </label>
                <input
                  type="number"
                  value={formData.alcohol_tax_percentage}
                  onChange={(e) => setFormData({ ...formData, alcohol_tax_percentage: parseFloat(e.target.value || '0') })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.alcohol_tax_percentage ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-amber-500/50'
                  )}
                  step="0.01"
                  min="0"
                  max="100"
                />
                {errors.alcohol_tax_percentage && (
                  <p className="text-red-400 text-xs mt-1">{errors.alcohol_tax_percentage}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('taxProfiles.foodTax')} (%)
                </label>
                <input
                  type="number"
                  value={formData.food_tax_percentage}
                  onChange={(e) => setFormData({ ...formData, food_tax_percentage: parseFloat(e.target.value || '0') })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.food_tax_percentage ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-amber-500/50'
                  )}
                  step="0.01"
                  min="0"
                  max="100"
                />
                {errors.food_tax_percentage && (
                  <p className="text-red-400 text-xs mt-1">{errors.food_tax_percentage}</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3">
              <p className="text-slate-300 text-sm">
                Total Tax Rate: <span className="font-bold text-white">
                  {(formData.state_tax_percentage + formData.local_tax_percentage).toFixed(2)}%
                </span>
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Alcohol: {formData.alcohol_tax_percentage}% • Food: {formData.food_tax_percentage}%
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-500/20 border border-amber-500/50 text-amber-400 py-3 px-4 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                t('taxProfiles.createProfile')
              )}
            </button>
          </form>
        </div>
      )}

      {profiles.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{t('taxProfiles.title')}</p>
          <p className="text-slate-500 text-sm mt-2">Create your first tax profile</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{profile.profile_name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <span className="text-slate-400">State:</span>
                      <span className="ml-2 text-white font-medium">{profile.state_tax_percentage}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Local:</span>
                      <span className="ml-2 text-white font-medium">{profile.local_tax_percentage}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Alcohol:</span>
                      <span className="ml-2 text-white font-medium">{profile.alcohol_tax_percentage}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Food:</span>
                      <span className="ml-2 text-white font-medium">{profile.food_tax_percentage}%</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className={cn(
                      "inline-block px-2 py-1 rounded text-xs",
                      profile.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                    )}>
                      {profile.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button className="p-2 hover:bg-slate-600/50 rounded-lg transition-all">
                    <Edit2 className="w-4 h-4 text-slate-400 hover:text-white" />
                  </button>
                  <button className="p-2 hover:bg-red-500/20 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
