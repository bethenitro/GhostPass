import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Search, Filter, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import { useToast } from '../ui/toast';

interface AuditLog {
  id: string;
  timestamp: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
}

export const AuditTrailViewer: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAuditLogs({
        action: filterAction || undefined,
        limit: 100,
      });
      setLogs(data || []);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      if (error.response?.status !== 401) {
        showToast(error.response?.data?.error || 'Failed to load audit logs', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        log.admin_email.toLowerCase().includes(search) ||
        log.action.toLowerCase().includes(search) ||
        log.resource_type.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueResources = Array.from(new Set(logs.map(log => log.resource_type)));

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
        <h2 className="text-lg sm:text-xl font-bold text-white">System Audit Trail</h2>
        <button 
          onClick={loadAuditLogs}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-400 transition-all min-h-[44px] w-full sm:w-auto"
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none text-sm"
              placeholder="Search logs..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Filter className="w-4 h-4 inline mr-1" />
              Action
            </label>
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                loadAuditLogs();
              }}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none text-sm"
            >
              <option value="">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Filter className="w-4 h-4 inline mr-1" />
              Resource
            </label>
            <select
              value={filterResource}
              onChange={(e) => {
                setFilterResource(e.target.value);
                loadAuditLogs();
              }}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none text-sm"
            >
              <option value="">All Resources</option>
              {uniqueResources.map((resource) => (
                <option key={resource} value={resource}>
                  {resource}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Range
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-purple-500/50 focus:outline-none text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">No audit logs found</p>
          <p className="text-slate-500 text-xs sm:text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg overflow-hidden">
          {/* Mobile View */}
          <div className="md:hidden space-y-2 p-2 sm:p-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-purple-400 font-mono text-xs truncate">{log.action}</span>
                  <span className="text-slate-500 text-xs flex-shrink-0">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-white text-sm truncate">{log.admin_email}</div>
                <div className="text-slate-400 text-xs">{log.resource_type}</div>
                {log.resource_id && (
                  <div className="text-slate-500 text-xs font-mono truncate">ID: {log.resource_id}</div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Timestamp</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Admin</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Action</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Resource</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Resource ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr 
                    key={log.id}
                    className={cn(
                      "border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors",
                      index % 2 === 0 ? 'bg-slate-800/20' : ''
                    )}
                  >
                    <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-white">{log.admin_email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{log.resource_type}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                      {log.resource_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 sm:p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-center">
          <div>
            <p className="text-slate-400 text-xs mb-1">Total Logs</p>
            <p className="text-white text-xl sm:text-2xl font-bold">{filteredLogs.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Unique Actions</p>
            <p className="text-purple-400 text-xl sm:text-2xl font-bold">{uniqueActions.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Resources</p>
            <p className="text-cyan-400 text-xl sm:text-2xl font-bold">{uniqueResources.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Admins</p>
            <p className="text-emerald-400 text-xl sm:text-2xl font-bold">
              {Array.from(new Set(logs.map(log => log.admin_email))).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
