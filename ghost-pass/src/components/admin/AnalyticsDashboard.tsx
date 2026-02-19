import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Users, DollarSign, Building2, RefreshCw, FileText } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { AdminDashboard } from '@/types';

export const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const stats = [
    { 
      label: t('analytics.revenue'), 
      value: dashboard ? formatCurrency(dashboard.stats?.revenue_month_cents || 0) : '$0.00', 
      icon: DollarSign, 
      color: 'green' 
    },
    { 
      label: t('analytics.transactions'), 
      value: dashboard?.stats?.total_transactions?.toString() || '0', 
      icon: TrendingUp, 
      color: 'cyan' 
    },
    { 
      label: t('analytics.users'), 
      value: dashboard?.stats?.total_users?.toString() || '0', 
      icon: Users, 
      color: 'purple' 
    },
    { 
      label: t('events.title'), 
      value: '0', // TODO: Add total_events to SystemStats
      icon: Building2, 
      color: 'blue' 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">{t('analytics.dashboard')}</h2>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm">{t('common.refresh')}</span>
        </button>
      </div>

      {loading && !dashboard ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">{stat.label}</span>
                    <Icon className={`w-5 h-5 text-${stat.color}-400`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Recent Audit Logs */}
          {dashboard?.recent_audit_logs && dashboard.recent_audit_logs.length > 0 && (
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
                <h3 className="text-white font-medium">{t('audit.recentActivity')}</h3>
              </div>
              
              <div className="space-y-3 md:hidden">
                {dashboard.recent_audit_logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="text-cyan-400 font-mono text-sm">{log.action}</p>
                      <p className="text-slate-400 text-xs">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-white text-sm">{log.admin_email}</p>
                    <p className="text-slate-300 text-xs">{log.resource_type}</p>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 text-slate-300">Timestamp</th>
                      <th className="text-left py-2 text-slate-300">Admin</th>
                      <th className="text-left py-2 text-slate-300">Action</th>
                      <th className="text-left py-2 text-slate-300">Resource</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recent_audit_logs.slice(0, 10).map((log) => (
                      <tr key={log.id} className="border-b border-slate-800">
                        <td className="py-3 text-slate-400 font-mono text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 text-white">{log.admin_email}</td>
                        <td className="py-3 text-cyan-400 font-mono">{log.action}</td>
                        <td className="py-3 text-slate-300">{log.resource_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
