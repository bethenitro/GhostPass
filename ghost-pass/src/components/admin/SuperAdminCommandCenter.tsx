import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Building2, DollarSign, Store, LayoutGrid, FileText, 
  Users, Settings, BarChart3, Shield, Database, Wallet 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventCreator } from './EventCreator';
import { RevenueProfileManager } from './RevenueProfileManager';
import { MenuManager } from './MenuManager';
import { StationManager } from './StationManager';
import { TransactionLedger } from './TransactionLedger';
import { TaxProfileManager } from './TaxProfileManager';
import { UserManagement } from './UserManagement';
import { SystemSettings } from './SystemSettings';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { PayoutsManager } from './PayoutsManager';

export const SuperAdminCommandCenter: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'events' | 'profiles' | 'menu' | 'stations' | 'ledger' | 'tax' | 'users' | 'settings' | 'analytics' | 'payouts'>('analytics');

  const tabs = [
    { id: 'analytics' as const, label: t('analytics.title'), icon: BarChart3, color: 'cyan' },
    { id: 'events' as const, label: t('events.title'), icon: Building2, color: 'purple' },
    { id: 'profiles' as const, label: t('revenueProfiles.title'), icon: DollarSign, color: 'green' },
    { id: 'tax' as const, label: t('taxProfiles.title'), icon: Shield, color: 'amber' },
    { id: 'stations' as const, label: t('stations.title'), icon: Store, color: 'blue' },
    { id: 'menu' as const, label: t('menu.title'), icon: LayoutGrid, color: 'pink' },
    { id: 'ledger' as const, label: t('transactionLedger.title'), icon: FileText, color: 'orange' },
    { id: 'payouts' as const, label: t('payouts.title'), icon: Wallet, color: 'emerald' },
    { id: 'users' as const, label: t('users.title'), icon: Users, color: 'indigo' },
    { id: 'settings' as const, label: t('settings.title'), icon: Settings, color: 'slate' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center justify-center space-x-3 mb-2">
            <Database className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('commandCenter.superAdmin')}</h1>
          </div>
          <p className="text-cyan-400 text-sm">{t('commandCenter.fullSystemAccess')}</p>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
        </motion.div>

        {/* Tab Navigation - Mobile Optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-2"
        >
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-center md:justify-start space-x-2 px-3 py-3 md:py-2 rounded-lg font-medium transition-all duration-300 min-h-[44px]",
                    activeTab === tab.id
                      ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/50`
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  )}
                >
                  <Icon className="w-5 h-5 md:w-4 md:h-4" />
                  <span className="text-xs md:text-sm hidden md:inline">{tab.label}</span>
                  <span className="text-xs md:hidden">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 md:p-6"
        >
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'events' && <EventCreator />}
          {activeTab === 'profiles' && <RevenueProfileManager />}
          {activeTab === 'tax' && <TaxProfileManager />}
          {activeTab === 'stations' && <StationManager venueId="" eventId="" />}
          {activeTab === 'menu' && <MenuManager venueId="" eventId="" />}
          {activeTab === 'ledger' && <TransactionLedger />}
          {activeTab === 'payouts' && <PayoutsManager />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'settings' && <SystemSettings />}
        </motion.div>
      </div>
    </div>
  );
};
