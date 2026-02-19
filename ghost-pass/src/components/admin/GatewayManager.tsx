import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Loader2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gatewayApi } from '@/lib/api';
import { useToast } from '../ui/toast';

interface GatewayManagerProps {
  venueId?: string;
}

interface EntryPoint {
  id: string;
  name: string;
  type: string;
  status: 'ENABLED' | 'DISABLED';
  employee_name?: string;
  employee_id?: string;
  venue_id?: string;
  metrics?: {
    total_scans: number;
    today_scans: number;
  };
}

export const GatewayManager: React.FC<GatewayManagerProps> = ({ venueId }) => {
  const { showToast } = useToast();
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPoint, setEditingPoint] = useState<EntryPoint | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    status: 'ENABLED' as 'ENABLED' | 'DISABLED',
    employee_name: '',
    employee_id: '',
    visual_identifier: '',
  });

  const statusOptions: Array<'ENABLED' | 'DISABLED'> = ['ENABLED', 'DISABLED'];

  useEffect(() => {
    loadEntryPoints();
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEntryPoints = async () => {
    try {
      setLoading(true);
      const points = await gatewayApi.getEntryPoints();
      setEntryPoints(points || []);
    } catch (error: any) {
      console.error('Failed to load entry points:', error);
      if (error.response?.status !== 401) {
        showToast(error.response?.data?.error || 'Failed to load entry points', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast('Entry point name is required', 'error');
      return;
    }

    if (!formData.employee_name.trim() || !formData.employee_id.trim()) {
      showToast('Employee name and ID are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPoint) {
        await gatewayApi.updateEntryPoint(editingPoint.id, formData);
        showToast('Entry point updated successfully', 'success');
      } else {
        await gatewayApi.createEntryPoint(formData);
        showToast('Entry point created successfully', 'success');
      }
      setShowForm(false);
      resetForm();
      loadEntryPoints();
    } catch (error: any) {
      console.error('Failed to save entry point:', error);
      showToast(error.response?.data?.error || 'Failed to save entry point', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pointId: string) => {
    if (!confirm('Are you sure you want to delete this entry point?')) return;

    try {
      await gatewayApi.deleteEntryPoint(pointId);
      showToast('Entry point deleted successfully', 'success');
      loadEntryPoints();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete entry point', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      status: 'ENABLED',
      employee_name: '',
      employee_id: '',
      visual_identifier: '',
    });
    setEditingPoint(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">Gateway Entry Points</h2>
        <button 
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-400 transition-all min-h-[44px] w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">{showForm ? 'Cancel' : 'Add Entry Point'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 sm:p-4 md:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
            {editingPoint ? 'Edit Entry Point' : 'Create New Entry Point'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  placeholder="Main Entrance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ENABLED' | 'DISABLED' })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Employee Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Employee ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                  placeholder="EMP001"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-purple-500/20 border border-purple-500/50 text-purple-400 py-3 px-4 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2 min-h-[44px] text-sm sm:text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingPoint ? 'Update Entry Point' : 'Create Entry Point'}</span>
              )}
            </button>
          </form>
        </div>
      )}

      {entryPoints.length === 0 && !showForm ? (
        <div className="text-center py-8 sm:py-12">
          <MapPin className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">No entry points configured</p>
          <p className="text-slate-500 text-xs sm:text-sm mt-2">Create your first entry point to start tracking</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {entryPoints.map((point) => (
            <div
              key={point.id}
              className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 sm:p-4 hover:border-purple-500/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                    <h3 className="text-white font-medium text-base sm:text-lg truncate">{point.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 sm:py-1 rounded text-xs font-medium flex-shrink-0",
                      point.status === 'ENABLED' ? 'bg-emerald-500/20 text-emerald-400' :
                      point.status === 'DISABLED' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    )}>
                      {point.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">{point.type.replace(/_/g, ' ')}</p>
                  {point.employee_name && (
                    <p className="text-slate-500 text-xs mt-1">
                      Employee: {point.employee_name} ({point.employee_id})
                    </p>
                  )}
                  {point.metrics && (
                    <div className="flex items-center space-x-3 sm:space-x-4 mt-2 sm:mt-3 text-xs">
                      <div className="flex items-center space-x-1">
                        <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
                        <span className="text-slate-400">Today:</span>
                        <span className="text-cyan-400 font-medium">{point.metrics.today_scans}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                        <span className="text-slate-400">Total:</span>
                        <span className="text-purple-400 font-medium">{point.metrics.total_scans}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 sm:ml-4">
                  <button 
                    onClick={() => {
                      setEditingPoint(point);
                      setFormData({
                        name: point.name,
                        status: point.status,
                        employee_name: point.employee_name || '',
                        employee_id: point.employee_id || '',
                        visual_identifier: '',
                      });
                      setShowForm(true);
                    }}
                    className="flex-1 sm:flex-none p-2 hover:bg-slate-600/50 rounded-lg transition-all min-h-[44px] flex items-center justify-center"
                  >
                    <Edit2 className="w-4 h-4 text-slate-400 hover:text-white" />
                  </button>
                  <button 
                    onClick={() => handleDelete(point.id)}
                    className="flex-1 sm:flex-none p-2 hover:bg-red-500/20 rounded-lg transition-all min-h-[44px] flex items-center justify-center"
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
