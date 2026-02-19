import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Calendar, Store, LayoutGrid, FileText, 
  BarChart3, Users, DollarSign, Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VenueEventManager } from './VenueEventManager';
import { StationManager } from './StationManager';
import { MenuManager } from './MenuManager';
import { VenueTransactionLedger } from './VenueTransactionLedger';
import { VenueAnalytics } from './VenueAnalytics';
import { VenueStaffManager } from './VenueStaffManager';
import { VenuePayouts } from './VenuePayouts';
import { VenueEntryConfig } from './VenueEntryConfig';

interface VenueAdminCommandCenterProps {
  venueId: string;
  eventId?: string;
}

export const VenueAdminCommandCenter: React.FC<VenueAdminCommandCenterProps> = ({ 
  venueId, 
  eventId 
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'analytics' | 'events' | 'stations' | 'menu' | 'ledger' | 'staff' | 'payouts' | 'config'>('analytics');

  const tabs = [
    { id: 'analytics' as const, label: t('analytics.title'), icon: BarChart3, color: 'cyan' },
    { id: 'events' as const, label: t('events.myEvents'), icon: Calendar, color: 'purple' },
    { id: 'config' as const, label: 'Entry Config', icon: Settings, color: 'amber' },
    { id: 'stations' as const, label: t('stations.title'), icon: Store, color: 'blue' },
    { id: 'menu' as const, label: t('menu.title'), icon: LayoutGrid, color: 'pink' },
    { id: 'ledger' as const, label: t('transactionLedger.title'), icon: FileText, color: 'orange' },
    { id: 'staff' as const, label: t('staff.title'), icon: Users, color: 'indigo' },
    { id: 'payouts' as const, label: t('payouts.title'), icon: DollarSign, color: 'green' },
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
            <Store className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('commandCenter.venueAdmin')}</h1>
          </div>
          <p className="text-purple-400 text-sm">{t('commandCenter.manageYourVenue')}</p>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent mx-auto mt-4"></div>
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
          {activeTab === 'analytics' && <VenueAnalytics venueId={venueId} eventId={eventId} />}
          {activeTab === 'events' && <VenueEventManager venueId={venueId} />}
          {activeTab === 'config' && <VenueEntryConfig venueId={venueId} eventId={eventId} />}
          {activeTab === 'stations' && <StationManager venueId={venueId} eventId={eventId || ''} />}
          {activeTab === 'menu' && <MenuManager venueId={venueId} eventId={eventId || ''} />}
          {activeTab === 'ledger' && <VenueTransactionLedger venueId={venueId} eventId={eventId} />}
          {activeTab === 'staff' && <VenueStaffManager venueId={venueId} />}
          {activeTab === 'payouts' && <VenuePayouts venueId={venueId} />}
        </motion.div>
      </div>
    </div>
  );
};
