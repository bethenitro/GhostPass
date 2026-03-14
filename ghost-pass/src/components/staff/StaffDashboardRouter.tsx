import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Store, LogOut, Target, ShoppingCart, BarChart3, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/lib/api';
import { LanguageSwitcher } from '../LanguageSwitcher';
import GhostPassScanner from '../GhostPassScanner';
import StaffPOS from './StaffPOS';
import ManagerDashboard from './ManagerDashboard';

interface StaffDashboardRouterProps {
    user: any;
}

export const StaffDashboardRouter: React.FC<StaffDashboardRouterProps> = ({ user }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'scan' | 'pos' | 'dashboard'>(
        user.role === 'DOOR' ? 'scan' : ['BAR', 'CONCESSION', 'MERCH'].includes(user.role) ? 'pos' : 'dashboard'
    );

    const handleLogout = async () => {
        await authApi.signOut();
        window.location.reload();
    };

    const tabs = [];

    if (['DOOR', 'MANAGER', 'VENUE_ADMIN', 'ADMIN'].includes(user.role)) {
        tabs.push({ id: 'scan' as const, label: t('staffPortal.scanner'), icon: Target, color: 'cyan' });
    }
    if (['BAR', 'CONCESSION', 'MERCH', 'MANAGER', 'VENUE_ADMIN', 'ADMIN'].includes(user.role)) {
        tabs.push({ id: 'pos' as const, label: t('staffPortal.pointOfSale'), icon: ShoppingCart, color: 'purple' });
    }
    if (['MANAGER', 'VENUE_ADMIN', 'ADMIN'].includes(user.role)) {
        tabs.push({ id: 'dashboard' as const, label: t('staffPortal.dashboard'), icon: BarChart3, color: 'emerald' });
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Top Navbar */}
            <header className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/50">
                            <Store className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white">{t('staffPortal.title')}</h1>
                            <p className="text-[10px] text-cyan-400 uppercase tracking-wider">{user.role}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher showLabel={false} className="sm:hidden" />
                        <LanguageSwitcher showLabel={true} className="hidden sm:flex" />
                        <button
                            onClick={() => { window.location.hash = '#/wallet'; }}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors text-sm font-medium"
                        >
                            <Wallet className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('staffPortal.backToWallet')}</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-colors text-sm font-medium"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('common.logout')}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">

                {/* Navigation Tabs */}
                {tabs.length > 1 && (
                    <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? `bg-${tab.color}-500/20 border border-${tab.color}-500/50 text-${tab.color}-400`
                                            : 'bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Dynamic Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'scan' && (
                        <div className="max-w-lg mx-auto">
                            <GhostPassScanner />
                        </div>
                    )}
                    {activeTab === 'pos' && (
                        <div className="max-w-4xl mx-auto">
                            <StaffPOS user={user} />
                        </div>
                    )}
                    {activeTab === 'dashboard' && (
                        <div className="max-w-6xl mx-auto">
                            <ManagerDashboard user={user} />
                        </div>
                    )}
                </motion.div>

            </main>
        </div>
    );
};

export default StaffDashboardRouter;
