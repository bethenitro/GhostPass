import React, { useState, useEffect } from 'react';
import { FileText, Filter, ArrowLeft, Search, Activity, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auditApi } from '../lib/api';
import type { 
  EntryPointAuditLog, 
  EntryPointActionType, 
  AuditSummaryStats,
  EntryPointAuditFilter 
} from '../types';

interface AuditTrailProps {
  className?: string;
  onBack?: () => void;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ className = '', onBack }) => {
  const { t } = useTranslation();
  const rootClass = `min-h-screen bg-slate-950 ${className}`.trim();
  const [auditLogs, setAuditLogs] = useState<EntryPointAuditLog[]>([]);
  const [summaryStats, setSummaryStats] = useState<AuditSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<EntryPointAuditFilter>({
    limit: 50,
    offset: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadAuditData();
  }, [filters]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load audit logs with current filters
      const logs = await auditApi.getEntryPointAuditLogs(filters);
      setAuditLogs(logs);
      setHasMore(logs.length === (filters.limit || 50));

      // Load summary stats (only on initial load)
      if (filters.offset === 0) {
        const stats = await auditApi.getAuditSummary(30);
        setSummaryStats(stats);
      }
    } catch (err) {
      console.error('Error loading audit data:', err);
      setError(t('auditTrail.errors.failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof EntryPointAuditFilter, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset pagination when filters change
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    const limit = filters.limit || 50;
    const newOffset = direction === 'next' 
      ? (filters.offset || 0) + limit
      : Math.max(0, (filters.offset || 0) - limit);
    
    setFilters(prev => ({ ...prev, offset: newOffset }));
    setCurrentPage(direction === 'next' ? currentPage + 1 : currentPage - 1);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionTypeColor = (actionType: EntryPointActionType) => {
    switch (actionType) {
      case 'SCAN': return 'bg-blue-500/20 text-blue-400 border border-blue-500/50';
      case 'CREATE': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50';
      case 'EDIT': return 'bg-amber-500/20 text-amber-400 border border-amber-500/50';
      case 'ACTIVATE': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50';
      case 'DEACTIVATE': return 'bg-red-500/20 text-red-400 border border-red-500/50';
      case 'DELETE': return 'bg-red-500/20 text-red-400 border border-red-500/50';
      default: return 'bg-slate-700 text-slate-400 border border-slate-600';
    }
  };

  const getSourceLocationIcon = (source: string) => {
    switch (source) {
      case 'Scan UI': return '📱';
      case 'Command Center': return '🖥️';
      case 'PCGM': return '⚙️';
      default: return '📋';
    }
  };

  if (loading && auditLogs.length === 0) {
    return (
      <div className={rootClass}>
        {/* Header */}
        <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 flex-shrink-0 touch-manipulation active:scale-95"
                  aria-label={t('auditTrail.backToDashboard')}
                >
                  <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-red-400 truncate">
                  {t('auditTrail.title')}
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1 truncate">
                  {t('auditTrail.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={rootClass}>
        {/* Header */}
        <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 flex-shrink-0 touch-manipulation active:scale-95"
                  aria-label={t('auditTrail.backToDashboard')}
                >
                  <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-red-400 truncate">
                  {t('auditTrail.title')}
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1 truncate">
                  {t('auditTrail.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-8 sm:p-12 text-center">
            <FileText className="mx-auto text-red-600 mb-4" size={48} />
            <p className="text-red-400 text-base sm:text-lg mb-2">{t('auditTrail.errors.loadingError')}</p>
            <p className="text-slate-500 text-xs sm:text-sm mb-6">{error}</p>
            <button 
              onClick={loadAuditData} 
              className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 inline-flex items-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
            >
              <Activity size={18} />
              <span>{t('auditTrail.retry')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {/* Header */}
      <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 flex-shrink-0 touch-manipulation active:scale-95"
                aria-label={t('auditTrail.backToDashboard')}
              >
                <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-red-400 truncate">
                {t('auditTrail.title')}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1 truncate">
                {t('auditTrail.subtitle')}
              </p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 sm:px-4 py-2.5 sm:py-2 border rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 touch-manipulation min-h-[44px] active:scale-95 ${
                showFilters
                  ? 'bg-red-500/30 border-red-500 text-red-400'
                  : 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20'
              }`}
            >
              <Filter size={18} />
              <span className="text-sm sm:text-base hidden sm:inline">{showFilters ? t('auditTrail.hide') : t('auditTrail.show')}</span>
              <span className="text-sm sm:text-base sm:hidden">{t('auditTrail.filter')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {/* Summary Stats */}
        {summaryStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-bold text-blue-400">{summaryStats.total_scans}</div>
              <div className="text-xs sm:text-sm text-slate-400">{t('auditTrail.stats.totalScans')}</div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-bold text-amber-400">{summaryStats.total_edits}</div>
              <div className="text-xs sm:text-sm text-slate-400">{t('auditTrail.stats.edits')}</div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">{summaryStats.unique_entry_points}</div>
              <div className="text-xs sm:text-sm text-slate-400">{t('auditTrail.stats.activeEntryPoints')}</div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-bold text-purple-400">{summaryStats.unique_employees}</div>
              <div className="text-xs sm:text-sm text-slate-400">{t('auditTrail.stats.activeEmployees')}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-4 sm:p-6 mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-red-400 mb-4 flex items-center space-x-2">
              <Search size={18} />
              <span>{t('auditTrail.filterAuditLogs')}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('auditTrail.filters.employeeName')}
                </label>
                <input
                  type="text"
                  placeholder={t('auditTrail.filters.searchByEmployee')}
                  value={filters.employee_name || ''}
                  onChange={(e) => handleFilterChange('employee_name', e.target.value || undefined)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('auditTrail.filters.actionType')}
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                  value={filters.action_type || ''}
                  onChange={(e) => handleFilterChange('action_type', e.target.value || undefined)}
                >
                  <option value="">{t('auditTrail.filters.allActions')}</option>
                  <option value="SCAN">{t('auditTrail.filters.scans')}</option>
                  <option value="CREATE">{t('auditTrail.filters.creates')}</option>
                  <option value="EDIT">{t('auditTrail.filters.edits')}</option>
                  <option value="ACTIVATE">{t('auditTrail.filters.activations')}</option>
                  <option value="DEACTIVATE">{t('auditTrail.filters.deactivations')}</option>
                  <option value="DELETE">{t('auditTrail.filters.deletions')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('auditTrail.filters.sourceLocation')}
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                  value={filters.source_location || ''}
                  onChange={(e) => handleFilterChange('source_location', e.target.value || undefined)}
                >
                  <option value="">{t('auditTrail.filters.allSources')}</option>
                  <option value="Scan UI">Scan UI</option>
                  <option value="Command Center">Command Center</option>
                  <option value="PCGM">PCGM</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setFilters({ limit: 50, offset: 0 });
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px]"
              >
                {t('auditTrail.clearFilters')}
              </button>
            </div>
          </div>
        )}

        {/* Audit Logs */}
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-red-400">{t('auditTrail.auditLogEntries')}</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {t('auditTrail.completeHistory')}
              </p>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-8 sm:p-12 text-center">
              <FileText className="mx-auto text-slate-600 mb-4" size={48} />
              <p className="text-slate-400 text-base sm:text-lg mb-2">{t('auditTrail.noEntriesFound')}</p>
              <p className="text-slate-500 text-xs sm:text-sm mb-6">
                {t('auditTrail.noEntriesMatchFilter')}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-red-500/20 bg-slate-800/50">
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">{t('auditTrail.table.action')}</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">{t('auditTrail.table.entryPoint')}</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">{t('auditTrail.table.employee')}</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">{t('auditTrail.table.source')}</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">{t('auditTrail.table.timestamp')}</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold text-sm">{t('auditTrail.table.details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-800 hover:bg-red-500/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionTypeColor(log.action_type)}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <FileText size={16} className="text-red-400 flex-shrink-0" />
                            <span className="font-medium text-sm text-white">{log.entry_point_name}</span>
                          </div>
                          <div className="text-xs text-slate-400">{log.entry_point_type.replace('_', ' ')}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-white">{log.employee_name}</div>
                          <div className="text-xs text-slate-400">{log.employee_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1 text-sm text-slate-300">
                            <span>{getSourceLocationIcon(log.source_location)}</span>
                            <span>{log.source_location}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-slate-300">{formatTimestamp(log.created_at)}</div>
                          {log.admin_email && (
                            <div className="text-xs text-purple-400">{t('auditTrail.admin')}: {log.admin_email}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end">
                            {(log.action_type === 'EDIT' && log.metadata?.changes) && (
                              <button
                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors touch-manipulation"
                                title={t('auditTrail.viewChanges')}
                              >
                                <Eye size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <FileText size={16} className="text-red-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm text-white break-words block">
                            {log.entry_point_name}
                          </span>
                          <span className="text-xs text-slate-400">{log.entry_point_type.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getActionTypeColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">{t('auditTrail.mobile.employee')}:</span>
                        <span className="text-white text-right">{log.employee_name} ({log.employee_id})</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">{t('auditTrail.mobile.source')}:</span>
                        <span className="text-slate-300 flex items-center space-x-1">
                          <span>{getSourceLocationIcon(log.source_location)}</span>
                          <span>{log.source_location}</span>
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">{t('auditTrail.mobile.time')}:</span>
                        <span className="text-slate-300 text-right text-xs">{formatTimestamp(log.created_at)}</span>
                      </div>
                      {log.admin_email && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">{t('auditTrail.admin')}:</span>
                          <span className="text-purple-400 text-right break-all">{log.admin_email}</span>
                        </div>
                      )}
                    </div>

                    {/* Show changes for edit actions */}
                    {log.action_type === 'EDIT' && log.metadata?.changes && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/50 rounded-lg">
                        <div className="text-xs font-medium text-amber-400 mb-2">{t('auditTrail.changesMade')}:</div>
                        <div className="space-y-1 text-xs">
                          {Object.entries(log.metadata.changes).map(([field, change]: [string, any]) => (
                            <div key={field} className="flex flex-col space-y-1">
                              <span className="font-medium capitalize text-slate-300">{field.replace('_', ' ')}:</span>
                              <div className="flex items-center space-x-2 pl-2">
                                <span className="text-red-400 break-all">"{change.old}"</span>
                                <span className="text-slate-400">→</span>
                                <span className="text-emerald-400 break-all">"{change.new}"</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Show scan metadata */}
                    {log.action_type === 'SCAN' && log.metadata && (
                      <div className="mt-2 text-xs flex flex-wrap gap-2">
                        {log.metadata.is_session ? (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-full">
                            {t('auditTrail.sessionScan')}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-full">
                            {t('auditTrail.passScan')}
                          </span>
                        )}
                        {log.metadata.scan_result && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.metadata.scan_result === 'APPROVED' 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                              : 'bg-red-500/20 text-red-400 border border-red-500/50'
                          }`}>
                            {log.metadata.scan_result}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-lg px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-sm text-slate-400">
                  {t('auditTrail.pagination.page')} {currentPage} • {t('auditTrail.pagination.showing')} {auditLogs.length} {t('auditTrail.pagination.entries')}
                </div>
                <div className="flex space-x-2 w-full sm:w-auto">
                  <button
                    onClick={() => handlePageChange('prev')}
                    disabled={currentPage === 1}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('auditTrail.pagination.previous')}
                  </button>
                  <button
                    onClick={() => handlePageChange('next')}
                    disabled={!hasMore}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('auditTrail.pagination.next')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;
