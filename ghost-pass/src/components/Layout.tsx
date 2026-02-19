import React from 'react';
import { Wallet, Scan, Shield, History, Zap, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'wallet' | 'scan' | 'session' | 'trust' | 'history' | 'tickets' | 'modes' | 'entry-test' | 'admin';
  onTabChange: (tab: 'wallet' | 'scan' | 'session' | 'trust' | 'history' | 'tickets' | 'modes' | 'entry-test' | 'admin') => void;
  fastEntryMode?: boolean; // Hide TopUp tab in fast entry mode
  onRecoverWallet?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  fastEntryMode = false,
  onRecoverWallet
}) => {
  const { t } = useTranslation();
  
  const tabs = [
    { id: 'wallet' as const, icon: Wallet, label: t('nav.wallet') },
    { id: 'scan' as const, icon: Scan, label: t('nav.scan') },
    { id: 'tickets' as const, icon: Ticket, label: t('nav.tickets') },
    { id: 'session' as const, icon: Zap, label: t('nav.session') },
    // Hide TopUp tab in fast entry mode (funding is integrated in wallet)
    ...(!fastEntryMode ? [{ id: 'trust' as const, icon: Shield, label: t('nav.topup') }] : []),
    { id: 'history' as const, icon: History, label: t('nav.history') },
  ];

  const handleTabChange = (tabId: 'wallet' | 'scan' | 'session' | 'trust' | 'history' | 'tickets' | 'modes' | 'entry-test' | 'admin') => {
    // Navigate to the proper URL
    const routes = {
      wallet: '#/wallet',
      scan: '#/scan',
      session: '#/session',
      trust: '#/trust',
      history: '#/history',
      tickets: '#/tickets',
      modes: '#/modes',
      'entry-test': '#/entry-test',
      admin: '#/admin',
    };
    window.location.hash = routes[tabId];
    onTabChange(tabId);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-white relative">

      {/* Mobile Top Navigation */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 z-50">
        <div className="flex items-center justify-between p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/50 flex-shrink-0">
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-cyan-400 rounded-sm"></div>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">{t('app.title')}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Language Selector - Mobile */}
            <div className="scale-90 sm:scale-100">
              <LanguageSelector />
            </div>
            
            {/* Recover Wallet / Operator Access Button - Mobile */}
            {onRecoverWallet && (
              <button
                onClick={onRecoverWallet}
                className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 min-h-[44px] min-w-[44px]"
                title={t('nav.walletAccess')}
              >
                <Shield size={18} className="sm:w-5 sm:h-5" />
                <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 hidden xs:block">{t('nav.walletAccess')}</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 z-50">
        <div className="flex">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                "flex-1 flex flex-col items-center py-3 px-2 transition-all duration-300",
                activeTab === id
                  ? 'bg-cyan-500/20 text-cyan-400 border-t-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
            >
              <Icon size={20} className="mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700 z-50 flex-col">
        {/* Logo/Brand */}
        <div className="p-4 lg:p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/50">
              <div className="w-4 h-4 lg:w-5 lg:h-5 bg-cyan-400 rounded-sm"></div>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-lg font-bold text-white">{t('app.title')}</h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider">{t('app.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 lg:p-6 space-y-2">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                "w-full flex items-center space-x-3 p-3 lg:p-4 rounded-lg transition-all duration-300 group",
                activeTab === id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
              style={
                activeTab === id
                  ? { filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }
                  : {}
              }
            >
              <Icon size={24} className="flex-shrink-0" />
              <span className="hidden lg:block font-medium text-left">{label}</span>
              {activeTab === id && (
                <div className="hidden lg:block ml-auto w-2 h-2 bg-cyan-400 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 lg:p-6 border-t border-slate-700 space-y-3">
          {/* Language Selector */}
          <LanguageSelector />
          
          {/* Recover Wallet / Operator Access Button */}
          {onRecoverWallet && (
            <button
              onClick={onRecoverWallet}
              className="w-full flex items-center justify-center space-x-2 p-3 lg:p-4 rounded-lg transition-all duration-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400"
            >
              <Shield size={20} />
              <span className="hidden lg:block font-medium">{t('nav.walletAccess')}</span>
            </button>
          )}
          
          <div className="hidden lg:block text-xs text-slate-500 text-center">
            <p>{t('nav.secure')}</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pt-28 pb-24 md:pt-0 md:pb-0 md:ml-20 lg:ml-64 overflow-y-auto">
        <div className="container mx-auto max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl px-4 py-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;