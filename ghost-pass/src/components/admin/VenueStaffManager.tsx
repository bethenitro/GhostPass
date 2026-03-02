import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '../ui/toast';
import { cn } from '@/lib/utils';
import { eventApi } from '@/lib/api-client';

interface VenueStaffManagerProps {
  venueId: string;
  eventId?: string;
}

interface StaffMember {
  id: string;
  email: string;
  role: string;
  venue_id?: string;
  created_at: string;
  staff_profiles?: {
    name: string | null;
    station_type: string | null;
    event_ids: string[];
  };
}

export const VenueStaffManager: React.FC<VenueStaffManagerProps> = ({ venueId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'DOOR' as string,
    station_type: 'DOOR' as string,
    event_ids: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [venueId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const [staffRes, eventsRes] = await Promise.all([
        fetch(`/api/admin/users?venue_id=${venueId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        eventApi.list({ venue_id: venueId }).catch(() => ({ data: [] }))
      ]);

      // Handle 401 silently (session expired / not authorized)
      if (staffRes.status === 401 || staffRes.status === 403) {
        console.warn('Not authorized to load staff');
        setEvents(eventsRes.data || []);
        return;
      }

      if (!staffRes.ok) throw new Error(`Failed to load staff (${staffRes.status})`);

      const staffData = await staffRes.json();

      // Filter out self (current venue admin) from the list
      let currentUserId = '';
      try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          currentUserId = userData.id || '';
        }
      } catch (e) {
        console.warn('Failed to parse user data for self-filtering');
      }

      const filteredStaff = (staffData || []).filter((s: StaffMember) => s.id !== currentUserId);
      setStaff(filteredStaff);
      setEvents(eventsRes.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      showToast('Failed to load staff data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          venue_id: venueId,
          station_type: ['DOOR', 'BAR', 'CONCESSION', 'MERCH'].includes(formData.role) ? formData.role : formData.station_type,
          event_ids: formData.event_ids
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.detail || 'Failed to add staff member');
      }

      showToast('Staff member added successfully', 'success');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Failed to add staff:', error);
      showToast(error.message || 'Failed to add staff member', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;

    // Optimistically remove from UI immediately
    setStaff(prev => prev.filter(m => m.id !== staffId));

    try {
      const response = await fetch(`/api/admin/users/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || 'Failed to delete staff');
      }

      showToast('Staff member removed successfully', 'success');
      // Silently try to reload to sync with server
      loadData().catch(() => {/* ignore reload errors */ });
    } catch (error: any) {
      console.error('Failed to delete staff:', error);
      showToast(error.message || 'Failed to remove staff member', 'error');
      // Revert optimistic update on error
      loadData().catch(() => {/* ignore */ });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'DOOR',
      station_type: 'DOOR',
      event_ids: [],
    });
    setErrors({});
  };

  const toggleEventId = (eventId: string) => {
    setFormData(prev => {
      const exists = prev.event_ids.includes(eventId);
      if (exists) {
        return { ...prev, event_ids: prev.event_ids.filter(id => id !== eventId) };
      } else {
        return { ...prev, event_ids: [...prev.event_ids, eventId] };
      }
    });
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                    errors.name ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-indigo-500/50'
                  )}
                  placeholder="John Doe"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>

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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none"
                >
                  <option value="DOOR">Door Staff (Scanner Only)</option>
                  <option value="BAR">Bar Staff (POS + Scanner)</option>
                  <option value="CONCESSION">Concession Staff (POS + Scanner)</option>
                  <option value="MERCH">Merch Staff (POS + Scanner)</option>
                  <option value="MANAGER">Manager (Dashboard + Reports)</option>
                  <option value="VENUE_ADMIN">Venue Admin (Full Access)</option>
                </select>
              </div>
            </div>

            {/* Event Assignment */}
            {events.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Assign Events (Optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {events.map(event => (
                    <label
                      key={event.event_id}
                      className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.event_ids.includes(event.event_id)}
                        onChange={() => toggleEventId(event.event_id)}
                        className="rounded border-slate-600 bg-slate-900/50 text-indigo-500 focus:ring-indigo-500/50"
                      />
                      <span className="text-sm text-slate-300">{event.event_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium text-lg">
                      {member.staff_profiles?.name || 'Unnamed Staff'}
                    </h3>
                    <span className="text-slate-400 text-sm">({member.email})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className={cn(
                      "inline-block px-2 py-1 rounded text-xs font-medium",
                      member.role === 'VENUE_ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                    )}>
                      {member.role}
                    </span>
                    {member.staff_profiles?.event_ids && member.staff_profiles.event_ids.length > 0 && (
                      <span className="text-slate-400 text-xs">
                        Assigned to {member.staff_profiles.event_ids.length} event(s)
                      </span>
                    )}
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
