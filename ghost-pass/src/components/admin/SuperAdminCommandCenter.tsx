import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Building2, DollarSign, Store, LayoutGrid, FileText, 
  Users, Settings, BarChart3, Shield, Database, Wallet, LogOut, MapPin, ArrowLeft, ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authApi } from '@/lib/api';
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
import { GatewayManager } from './GatewayManager';
import { AuditTrailViewer } from './AuditTrailViewer';
import { QRCodeGenerator } from './QRCodeGenerator';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface SuperAdminCommandCenterProps {
  onBack?: () => void;
}

export const SuperAdminCommandCenter: React.FC<SuperAdminCommandCenterProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'events' | 'profiles' | 'menu' | 'stations' | 'ledger' | 'tax' | 'users' | 'settings' | 'analytics' | 'payouts' | 'gateway' | 'audit' | 'qr'>('analytics');

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await authApi.signOut();
      window.location.reload();
    }
  };

  const tabs = [
    { id: 'analytics' as const, label: t('analytics.title'), icon: BarChart3, color: 'cyan' },
    { id: 'events' as const, label: t('events.title'), icon: Building2, color: 'purple' },
    { id: 'gateway' as const, label: 'Gateway', icon: MapPin, color: 'blue' },
    { id: 'qr' as const, label: 'QR Codes', icon: Shield, color: 'indigo' },
    { id: 'profiles' as const, label: t('revenueProfiles.title'), icon: DollarSign, color: 'green' },
    { id: 'tax' as const, label: t('taxProfiles.title'), icon: Shield, color: 'amber' },
    { id: 'stations' as const, label: t('stations.title'), icon: Store, color: 'blue' },
    { id: 'menu' as const, label: t('menu.title'), icon: LayoutGrid, color: 'pink' },
    { id: 'ledger' as const, label: t('transactionLedger.title'), icon: FileText, color: 'orange' },
    { id: 'payouts' as const, label: t('payouts.title'), icon: Wallet, color: 'emerald' },
    { id: 'audit' as const, label: 'Audit Trail', icon: Database, color: 'red' },
    { id: 'users' as const, label: t('users.title'), icon: Users, color: 'indigo' },
    { id: 'settings' as const, label: t('settings.title'), icon: Settings, color: 'slate' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-2">
            <Database className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{t('commandCenter.superAdmin')}</h1>
          </div>
          <p className="text-cyan-400 text-xs sm:text-sm">{t('commandCenter.fullSystemAccess')}</p>
          <div className="w-12 sm:w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-3 sm:mt-4"></div>
        </motion.div>

        {/* Action Buttons - Mobile Friendly */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-between items-center gap-2"
        >
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-all duration-300 min-h-[44px] text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Scan</span>
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <LanguageSwitcher showLabel={false} className="sm:hidden" />
            <LanguageSwitcher showLabel={true} className="hidden sm:flex" />
            <button
              onClick={async () => {
                try {
                  const deviceFingerprint = localStorage.getItem('device_fingerprint') || '';
                  const ssoData = await authApi.generateSSOToken(deviceFingerprint);
                  window.open(ssoData.bevalid_url, '_blank');
                } catch (error) {
                  console.error('Error generating SSO token:', error);
                  alert('Failed to open beVALID. Please try again.');
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all duration-300 min-h-[44px] text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">beVALID</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300 min-h-[44px] text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.logout')}</span>
              <span className="sm:hidden">Logout</span>
            </button>
          </div>
        </motion.div>

        {/* Tab Navigation - Mobile Optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-1.5 sm:p-2 overflow-x-auto"
        >
          <div className="flex md:grid md:grid-cols-5 gap-1.5 sm:gap-2 min-w-max md:min-w-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all duration-300 min-h-[44px] whitespace-nowrap text-xs sm:text-sm",
                    activeTab === tab.id
                      ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/50`
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  )}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>{tab.label}</span>
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
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-3 sm:p-4 md:p-6"
        >
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'events' && <EventCreator />}
          {activeTab === 'gateway' && <GatewayManager />}
          {activeTab === 'qr' && <QRCodeGenerator />}
          {activeTab === 'profiles' && <RevenueProfileManager />}
          {activeTab === 'tax' && <TaxProfileManager />}
          {activeTab === 'stations' && <StationManager venueId="" eventId="" />}
          {activeTab === 'menu' && <MenuManager venueId="" eventId="" />}
          {activeTab === 'ledger' && <TransactionLedger />}
          {activeTab === 'payouts' && <PayoutsManager />}
          {activeTab === 'audit' && <AuditTrailViewer />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'settings' && <SystemSettings />}
        </motion.div>
      </div>
    </div>
  );
};
