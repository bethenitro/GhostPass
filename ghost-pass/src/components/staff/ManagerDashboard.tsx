import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, DollarSign, Activity, Settings, Zap, KeyRound, Receipt, Loader2, AlertTriangle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManagerDashboardProps {
    user: any;
}

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ user }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dashboardData, setDashboardData] = useState<any>(null);

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);

            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
            const token = localStorage.getItem('auth_token');

            const response = await fetch(`${API_BASE_URL}/venue/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load dashboard data');
            }

            const data = await response.json();
            setDashboardData(data);
        } catch (err) {
            console.error('Error loading dashboard:', err);
            setError('Could not load shift reports. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-400 font-medium animate-pulse">Loading Manager Dashboard...</p>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center max-w-lg mx-auto mt-10">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Error Loading Data</h3>
                <p className="text-red-400 text-sm mb-6">{error || 'Unknown error occurred'}</p>
                <button
                    onClick={fetchDashboardData}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const { stats, recent_audit_logs } = dashboardData;

    const MetricCard = ({ title, value, icon: Icon, colorClass, delay = 0 }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5 flex flex-col"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
                <div className={cn("p-2 rounded-lg", colorClass.bg)}>
                    <Icon className={cn("w-4 h-4", colorClass.text)} />
                </div>
            </div>
            <div className="mt-auto">
                <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
            </div>
        </motion.div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-emerald-400" />
                        Manager Dashboard
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">Real-time overview of venue activity and shift reports.</p>
                </div>
                <button
                    onClick={fetchDashboardData}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    title="Refresh Data"
                >
                    <Activity className="w-4 h-4" />
                </button>
            </div>

            {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Total Revenue"
                        value={`$${((stats.venue_revenue_cents || 0) / 100).toFixed(2)}`}
                        icon={DollarSign}
                        colorClass={{ bg: 'bg-emerald-500/20', text: 'text-emerald-400' }}
                        delay={0.1}
                    />
                    <MetricCard
                        title="Total Entries"
                        value={(stats.total_entries || 0).toLocaleString()}
                        icon={Users}
                        colorClass={{ bg: 'bg-cyan-500/20', text: 'text-cyan-400' }}
                        delay={0.2}
                    />
                    <MetricCard
                        title="Initial vs Re-entry"
                        value={`${stats.initial_entries || 0} / ${stats.total_reentries || 0}`}
                        icon={KeyRound}
                        colorClass={{ bg: 'bg-purple-500/20', text: 'text-purple-400' }}
                        delay={0.3}
                    />
                    <MetricCard
                        title="Current Capacity"
                        value={(stats.current_capacity || 0).toLocaleString()}
                        icon={Zap}
                        colorClass={{ bg: 'bg-amber-500/20', text: 'text-amber-400' }}
                        delay={0.4}
                    />
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
                    <p className="text-slate-400">No stats available for this venue.</p>
                </div>
            )}

            {/* Analytics & Reports Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent Activity Log */}
                <div className="lg:col-span-2 bg-slate-900/50 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-400" />
                            Recent Shift Activity
                        </h3>
                        <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded-md border border-slate-700">Live</span>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[400px]">
                        {!recent_audit_logs || recent_audit_logs.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No recent activity found.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-800/50">
                                {recent_audit_logs.map((log: any, idx: number) => {
                                    const isPos = log.action === 'POS_CHARGE';
                                    const isEntry = log.action === 'SCAN_APPROVED';
                                    const Icon = isPos ? Receipt : isEntry ? Target : Settings;
                                    const color = isPos ? 'text-purple-400 bg-purple-400/10' : isEntry ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-400/10';

                                    return (
                                        <li key={log.id || idx} className="p-4 hover:bg-slate-800/20 transition-colors flex items-start gap-4">
                                            <div className={cn("p-2 rounded-full shrink-0", color)}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate text-capitalize">
                                                    {log.action.replace(/_/g, ' ')}
                                                </p>
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    {isPos && log.metadata?.amount_cents
                                                        ? `Amount: $${(log.metadata.amount_cents / 100).toFixed(2)} - ${log.metadata.station_type}`
                                                        : isEntry && log.metadata?.verification_tier
                                                            ? `Gate: ${log.metadata.gateway_id} (Tier ${log.metadata.verification_tier})`
                                                            : log.resource_type}
                                                </p>
                                            </div>
                                            <div className="text-xs text-slate-500 whitespace-nowrap">
                                                {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Quick Actions / Status */}
                <div className="space-y-4">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                            <Settings className="w-4 h-4 text-slate-400" />
                            Venue Settings
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                <span className="text-sm text-slate-300">Sales Status</span>
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">ACTIVE</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                <span className="text-sm text-slate-300">Entry Gates</span>
                                <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">OPEN</span>
                            </div>
                        </div>
                        {user.role === 'VENUE_ADMIN' && (
                            <button className="w-full py-2.5 mt-4 bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white rounded-lg transition-colors border border-slate-700">
                                Configure Settings
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ManagerDashboard;
