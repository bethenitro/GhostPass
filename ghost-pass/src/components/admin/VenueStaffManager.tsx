import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '../ui/toast';
import { cn } from '@/lib/utils';

interface VenueStaffManagerProps {
  venueId: string;
}

interface StaffMember {
  id: string;
  email: string;
  role: string;
  venue_id?: string;
  created_at: string;
}

export const VenueStaffManager: React.FC<VenueStaffManagerProps> = ({ venueId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'VENDOR' as string,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadStaff();
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users?venue_id=${venueId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load staff');
      
      const data = await response.json();
      setStaff(data || []);
    } catch (error: any) {
      console.error('Failed to load staff:', error);
      showToast('Failed to load staff', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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
      // Register new staff member
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role,
          venue_id: venueId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add staff member');
      }

      showToast('Staff member added successfully', 'success');
      setShowForm(false);
      resetForm();
      loadStaff();
    } catch (error: any) {
      console.error('Failed to add staff:', error);
      showToast(error.message || 'Failed to add staff member', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      const response = await fetch(`/api/admin/users/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete staff');

      showToast('Staff member removed successfully', 'success');
      loadStaff();
    } catch (error: any) {
      console.error('Failed to delete staff:', error);
      showToast('Failed to remove staff member', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      role: 'VENDOR',
    });
    setErrors({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">{t('staff.title')}</h2>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded-lg text-indigo-400 transition-all min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">{showForm ? t('common.cancel') : t('staff.addStaff')}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 md:p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Add New Staff Member</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={cn(
                  "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                  errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-indigo-500/50'
                )}
                placeholder="staff@example.com"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={cn(
                  "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                  errors.password ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-indigo-500/50'
                )}
                placeholder="Minimum 6 characters"
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none"
              >
                <option value="VENDOR">Vendor</option>
                <option value="VENDOR_MERCHANDISE">Vendor Merchandise</option>
                <option value="VENDOR_FB">F&B</option>
                <option value="SECURITY">Security</option>
                <option value="GM">GM</option>
                <option value="OWNER">Owner</option>
                <option value="VALID_ADMIN">Valid Admin</option>
                <option value="VENUE_ADMIN">Venue Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 py-3 px-4 rounded-lg hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                t('staff.addStaff')
              )}
            </button>
          </form>
        </div>
      )}

      {staff.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No staff members yet</p>
          <p className="text-slate-500 text-sm mt-2">Add your first staff member above</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {staff.map((member) => (
            <div key={member.id} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:border-indigo-500/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{member.email}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={cn(
                      "inline-block px-2 py-1 rounded text-xs",
                      member.role === 'VENUE_ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                    )}>
                      {member.role}
                    </span>
                    <span className="text-slate-500 text-xs">
                      Added {new Date(member.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button 
                    onClick={() => handleDelete(member.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                  >
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
