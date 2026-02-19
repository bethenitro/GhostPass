import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Building2, DollarSign, Store, LayoutGrid, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RevenueProfileManager } from './RevenueProfileManager';
import { EventCreator } from './EventCreator';
import { MenuManager } from './MenuManager';
import { StationManager } from './StationManager';
import { TransactionLedger } from './TransactionLedger';

export const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'events' | 'profiles' | 'menu' | 'stations' | 'ledger'>('events');
  const selectedVenue = 'venue_001';
  const selectedEvent = '';

  const tabs = [
    { id: 'events' as const, label: t('events.title'), icon: Building2 },
    { id: 'profiles' as const, label: t('revenueProfiles.title'), icon: DollarSign },
    { id: 'stations' as const, label: t('stations.title'), icon: Store },
    { id: 'menu' as const, label: t('menu.title'), icon: LayoutGrid },
    { id: 'ledger' as const, label: t('transactionLedger.title'), icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">{t('commandCenter.title')}</h1>
        <p className="text-cyan-400 text-sm">{t('commandCenter.subtitle')}</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-2"
      >
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300",
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{tab.label}</span>
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
        className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-6"
      >
        {activeTab === 'events' && <EventCreator />}
        {activeTab === 'profiles' && <RevenueProfileManager />}
        {activeTab === 'stations' && <StationManager venueId={selectedVenue} eventId={selectedEvent} />}
        {activeTab === 'menu' && <MenuManager venueId={selectedVenue} eventId={selectedEvent} />}
        {activeTab === 'ledger' && <TransactionLedger />}
      </motion.div>
    </div>
  );
};
