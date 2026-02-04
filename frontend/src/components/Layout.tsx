import React from 'react';
import { Wallet, Scan, Shield, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminModeToggle from './AdminModeToggle';
import SessionPill from './SessionPill';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'wallet' | 'scan' | 'trust' | 'history';
  onTabChange: (tab: 'wallet' | 'scan' | 'trust' | 'history') => void;
  userRole?: string;
  isAdminMode?: boolean;
  onAdminModeToggle?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  userRole = 'USER',
  isAdminMode = false,
  onAdminModeToggle = () => {}
}) => {
  const tabs = [
    { id: 'wallet' as const, icon: Wallet, label: 'Wallet' },
    { id: 'scan' as const, icon: Scan, label: 'Scan' },
    { id: 'trust' as const, icon: Shield, label: 'TopUp' },
    { id: 'history' as const, icon: History, label: 'History' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-white relative">
      {/* Session Pill - Shows when session is active (Desktop only) */}
      <div className="hidden md:block">
        <SessionPill />
      </div>

      {/* Mobile Top Navigation */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            {/* Mobile Admin Toggle - Left of GHOSTPASS */}
            {userRole === 'ADMIN' && (
              <div className="mr-2 relative">
                <AdminModeToggle
                  isAdminMode={isAdminMode}
                  onToggle={onAdminModeToggle}
                  userRole={userRole}
                  compact={true}
                />
              </div>
            )}
            
            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/50">
              <div className="w-4 h-4 bg-cyan-400 rounded-sm"></div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">GHOSTPASS</h1>
            </div>
          </div>
          
          {/* Mobile Session Pill - Integrated as part of navbar */}
          <div className="md:hidden">
            <SessionPill className="!relative !top-0 !right-0 !w-auto !max-w-[100px] !z-auto !shadow-none" />
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 z-50">
        <div className="flex">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
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
              <h1 className="text-lg font-bold text-white">GHOSTPASS</h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Secure Access</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 lg:p-6 space-y-2">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
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
          {/* Admin Mode Toggle */}
          <AdminModeToggle
            isAdminMode={isAdminMode}
            onToggle={onAdminModeToggle}
            userRole={userRole}
          />
          
          <div className="hidden lg:block text-xs text-slate-500 text-center">
            <p>Secure • Encrypted • Private</p>
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