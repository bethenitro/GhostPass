import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Trash2, Loader2, UserCheck } from 'lucide-react';
import { useToast } from '../ui/toast';

interface VenueStaffManagerProps {
  venueId: string;
  eventId?: string;
}

interface StaffMember {
  id: string;
  full_name?: string;
  email: string;
  role: string;
  created_at: string;
  event_ids?: string[];
}

interface StaffFormData {
  full_name: string;
  email: string;
  password: string;
  role: string;
  event_ids: string[];
}

interface FormErrors {
  full_name?: string;
  email?: string;
  password?: string;
}

export const VenueStaffManager: React.FC<VenueStaffManagerProps> = ({ venueId, eventId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<StaffFormData>({
    full_name: '', email: '', password: '', role: 'door_staff',
    event_ids: eventId ? [eventId] : [],
  });

  const roleOptions = [
    { value: 'door_staff', label: t('staffManager.roleDoor') },
    { value: 'bar_staff', label: t('staffManager.roleBar') },
    { value: 'concession_staff', label: t('staffManager.roleConcession') },
    { value: 'merch_staff', label: t('staffManager.roleMerch') },
    { value: 'manager', label: t('staffManager.roleManager') },
    { value: 'venue_admin', label: t('staffManager.roleVenueAdmin') },
  ];

  useEffect(() => { loadStaff(); loadEvents(); }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStaff = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;
      const res = await fetch(`/api/admin/users?venue_id=${venueId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : data.users || []);
      }
    } catch { showToast(t('staffManager.failedToLoad'), 'error'); }
    finally { setLoading(false); }
  };

  const loadEvents = async () => {
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;
      const res = await fetch(`/api/events/list?venue_id=${venueId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) { const data = await res.json(); setEvents(Array.isArray(data) ? data : []); }
    } catch { /* silently fail */ }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.full_name.trim()) errors.full_name = t('staffManager.nameRequired');
    if (!formData.email.trim()) errors.email = t('staffManager.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = t('staffManager.emailInvalid');
    if (formData.password.length < 6) errors.password = t('staffManager.passwordRequired');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { showToast(t('staffManager.fixErrors'), 'error'); return; }
    try {
      setSubmitting(true);
      const authToken = localStorage.getItem('auth_token');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ...formData, venue_id: venueId })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || t('staffManager.failedToAdd')); }
      showToast(t('staffManager.memberAdded'), 'success');
      setShowForm(false);
      setFormData({ full_name: '', email: '', password: '', role: 'door_staff', event_ids: eventId ? [eventId] : [] });
      setFormErrors({});
      loadStaff();
    } catch (error: any) { showToast(error.message || t('staffManager.failedToAdd'), 'error'); }
    finally { setSubmitting(false); }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm(t('staffManager.deleteConfirm'))) return;
    try {
      const authToken = localStorage.getItem('auth_token');
      const res = await fetch(`/api/admin/users/${memberId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error();
      setStaff(prev => prev.filter(s => s.id !== memberId));
      showToast(t('staffManager.memberRemoved'), 'success');
    } catch { showToast(t('staffManager.failedToRemove'), 'error'); }
  };

  const toggleEvent = (evId: string) => {
    setFormData(prev => ({
      ...prev,
      event_ids: prev.event_ids.includes(evId)
        ? prev.event_ids.filter(id => id !== evId)
        : [...prev.event_ids, evId]
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
          <h2 className="text-lg sm:text-xl font-bold text-white">{t('staffManager.title')}</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded-lg text-indigo-400 transition-all min-h-[44px] w-full sm:w-auto text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? t('staffManager.cancel') : t('staffManager.addStaff')}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4">{t('staffManager.addNewMember')}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('staffManager.fullName')} <span className="text-red-400">*</span></label>
                <input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none" />
                {formErrors.full_name && <p className="text-red-400 text-xs mt-1">{formErrors.full_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('staffManager.email')} <span className="text-red-400">*</span></label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none" />
                {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('staffManager.password')} <span className="text-red-400">*</span></label>
                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none"
                  placeholder={t('staffManager.passwordHint')} />
                {formErrors.password && <p className="text-red-400 text-xs mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('staffManager.role')}</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none">
                  {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            {events.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('staffManager.assignEvents')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {events.map(ev => (
                    <label key={ev.id || ev.event_id} className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={formData.event_ids.includes(ev.id || ev.event_id)}
                        onChange={() => toggleEvent(ev.id || ev.event_id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" />
                      <span className="text-slate-300 text-sm truncate">{ev.name || ev.event_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 py-3 px-4 rounded-lg hover:bg-indigo-500/30 disabled:opacity-50 font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{t('staffManager.addStaff')}</span>
            </button>
          </form>
        </div>
      )}

      {staff.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <Users className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">{t('staffManager.noStaff')}</p>
          <p className="text-slate-500 text-xs sm:text-sm mt-2">{t('staffManager.noStaffHint')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {staff.map(member => (
            <div key={member.id} className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 sm:p-4 hover:border-indigo-500/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <UserCheck className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">{member.full_name || t('staffManager.unnamedStaff')}</p>
                    <p className="text-slate-400 text-xs truncate">{member.email}</p>
                    <p className="text-indigo-400 text-xs mt-0.5">{roleOptions.find(r => r.value === member.role)?.label || member.role}</p>
                    {member.event_ids && member.event_ids.length > 0 && (
                      <p className="text-slate-500 text-xs mt-0.5">{t('staffManager.assignedTo', { count: member.event_ids.length })}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className="text-slate-500 text-xs hidden sm:block">{t('staffManager.added')} {new Date(member.created_at).toLocaleDateString()}</span>
                  <button onClick={() => handleRemove(member.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all min-h-[44px] flex items-center justify-center">
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
