import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import WalletDashboard from './components/WalletDashboard';
import FastEntryWallet from './components/FastEntryWallet';
import QRCodeView from './components/QRCodeView';
import TrustCenter from './components/TrustCenter';
import TransactionHistory from './components/TransactionHistory';
import GhostPassScanner from './components/GhostPassScanner';
import WalletRecovery from './components/WalletRecovery';
import TicketPurchase from './components/TicketPurchase';
import GhostPassModesTester from './components/GhostPassModesTester';
import CommandCenterRouter from './components/CommandCenterRouter';
import GatewayManagerPage from './components/GatewayManagerPage';
import AuditTrail from './components/AuditTrail';
import OperatorLogin from './components/OperatorLogin';
import EntryTester from './components/EntryTester';
import { AdminDashboard } from './components/admin';
import { ghostPassApi, authApi } from './lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 2,
    },
  },
});

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'wallet' | 'scan' | 'session' | 'trust' | 'history' | 'tickets' | 'modes' | 'entry-test' | 'admin'>('scan'); // Start on scan for new users
  const [purchasingDuration, setPurchasingDuration] = useState<number | null>(null);
  const [fastEntryMode, setFastEntryMode] = useState(false);
  const [fastEntryContext, setFastEntryContext] = useState<{
    venueId?: string;
    eventId?: string;
    venueName?: string;
    eventName?: string;
    entryFee?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showOperatorPortal, setShowOperatorPortal] = useState(false);
  const [showOperatorLogin, setShowOperatorLogin] = useState(false);
  const [showGatewayManager, setShowGatewayManager] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const queryClient = useQueryClient();

  // Initialize app (device fingerprint is handled in API client)
  useEffect(() => {
    setLoading(false);
  }, []);

  // Check for existing wallet session on mount (FAST ENTRY FLOW)
  useEffect(() => {
    const walletSession = localStorage.getItem('ghost_pass_wallet_session');
    if (walletSession) {
      try {
        const session = JSON.parse(walletSession);
        
        // CRITICAL: Always load wallet context if session exists, regardless of expiration
        // User's money is in the wallet, so they must always have access
        if (import.meta.env.DEV) {
          console.log(t('appContent.fastEntry'));
        }
        
        // Load fast entry context if available
        if (session.fast_entry) {
          setFastEntryMode(true);
          setFastEntryContext({
            venueId: session.venue_id,
            eventId: session.event_id,
            venueName: session.venue_name,
            eventName: session.event_name,
            entryFee: session.entry_fee
          });
        }
        
        // Check if session is expired
        const isExpired = session.expires_at && new Date(session.expires_at) <= new Date();
        
        // Only set initial route if no hash is present
        if (!window.location.hash || window.location.hash === '#/') {
          if (isExpired) {
            if (import.meta.env.DEV) {
              console.log(t('appContent.sessionExpired'));
            }
            // Expired session - navigate to scan for re-entry
            window.location.hash = '#/scan';
          } else {
            if (import.meta.env.DEV) {
              console.log(t('appContent.activeSession'));
            }
            // Active session - navigate to wallet
            window.location.hash = '#/wallet';
          }
        }
      } catch (error) {
        console.error(t('appContent.errorParsingSession'), error);
        // Error parsing session - navigate to scanner
        if (!window.location.hash || window.location.hash === '#/') {
          window.location.hash = '#/scan';
        }
      }
    } else {
      // No session - new user, navigate to scanner
      if (import.meta.env.DEV) {
        console.log(t('appContent.noSession'));
      }
      if (!window.location.hash || window.location.hash === '#/') {
        window.location.hash = '#/scan';
      }
    }
  }, [t]);

  // Check if we're on special routes
  const [currentRoute, setCurrentRoute] = useState(window.location.hash);

  // Listen for hash changes and update active tab
  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = window.location.hash;
      setCurrentRoute(newRoute);
      
      // Update active tab based on route
      if (newRoute === '#/wallet' || newRoute === '#/' || newRoute === '') {
        setActiveTab('wallet');
      } else if (newRoute === '#/scan') {
        setActiveTab('scan');
      } else if (newRoute === '#/session') {
        setActiveTab('session');
      } else if (newRoute === '#/trust') {
        setActiveTab('trust');
      } else if (newRoute === '#/history') {
        setActiveTab('history');
      } else if (newRoute === '#/tickets') {
        setActiveTab('tickets');
      } else if (newRoute === '#/modes' && import.meta.env.DEV) {
        // Only allow modes tester in development
        setActiveTab('modes');
      } else if (newRoute === '#/entry-test' && import.meta.env.DEV) {
        // Only allow entry tester in development
        setActiveTab('entry-test');
      } else if (newRoute === '#/admin') {
        // Admin dashboard
        setActiveTab('admin');
      } else if (newRoute === '#/modes' && !import.meta.env.DEV) {
        // Redirect to wallet if trying to access modes in production
        window.location.hash = '#/wallet';
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    // Set initial route
    handleHashChange();
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentRoute]);

  const purchaseMutation = useMutation({
    mutationFn: (duration: number) => ghostPassApi.purchase(duration),
    onMutate: (duration: number) => {
      setPurchasingDuration(duration);
    },
    onSuccess: async () => {
      // Invalidate relevant queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      await queryClient.invalidateQueries({ queryKey: ['ghostpass-status'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // Small delay to ensure backend processing is complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force refetch of ghostpass status to ensure fresh data
      await queryClient.refetchQueries({ queryKey: ['ghostpass-status'] });

      // Switch to QR code view after successful purchase
      setActiveTab('scan');
      setPurchasingDuration(null);
    },
    onError: () => {
      setPurchasingDuration(null);
    },
  });

  const handlePurchase = (duration: number) => {
    // Prevent multiple rapid purchases
    if (purchaseMutation.isPending) {
      return;
    }
    purchaseMutation.mutate(duration);
  };

  const handleRecoverySuccess = () => {
    console.log(t('appContent.walletRecovered'));
    setShowRecovery(false);
    setActiveTab('wallet');
    // Reload the page to refresh wallet data
    window.location.reload();
  };

  const handleOperatorPortal = () => {
    console.log(t('appContent.operatorPortal'));
    setShowRecovery(false);
    
    // Check if already authenticated
    if (authApi.isAuthenticated()) {
      setShowOperatorPortal(true);
    } else {
      setShowOperatorLogin(true);
    }
  };

  const handleOperatorLoginSuccess = (_token: string, user: any) => {
    console.log(t('appContent.operatorLoginSuccess'), user);
    setShowOperatorLogin(false);
    setShowOperatorPortal(true);
  };

  const handleOperatorLoginCancel = () => {
    setShowOperatorLogin(false);
  };

  const handleBackFromOperatorPortal = () => {
    setShowOperatorPortal(false);
    setShowGatewayManager(false);
    setShowAuditTrail(false);
  };

  const handleRequireAuth = () => {
    // User needs to authenticate - show login form
    setShowOperatorPortal(false);
    setShowOperatorLogin(true);
  };

  const handleNavigateToGatewayManager = () => {
    setShowGatewayManager(true);
    setShowAuditTrail(false);
  };

  const handleNavigateToAuditTrail = () => {
    setShowAuditTrail(true);
    setShowGatewayManager(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Show wallet recovery modal if requested
  if (showRecovery) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <WalletRecovery
          onRecoverySuccess={handleRecoverySuccess}
          onCancel={() => setShowRecovery(false)}
          onOperatorPortal={handleOperatorPortal}
        />
      </div>
    );
  }

  // Show Operator Login
  if (showOperatorLogin) {
    return (
      <OperatorLogin
        onLoginSuccess={handleOperatorLoginSuccess}
        onCancel={handleOperatorLoginCancel}
      />
    );
  }

  // Show Operator Portal (Command Center or Gateway Manager or Audit Trail)
  if (showOperatorPortal) {
    if (showGatewayManager) {
      return <GatewayManagerPage onBack={handleBackFromOperatorPortal} />;
    }
    if (showAuditTrail) {
      return <AuditTrail onBack={handleBackFromOperatorPortal} />;
    }
    return (
      <CommandCenterRouter
        onBack={handleBackFromOperatorPortal}
        onNavigateToGatewayManager={handleNavigateToGatewayManager}
        onNavigateToAuditTrail={handleNavigateToAuditTrail}
        onRequireAuth={handleRequireAuth}
      />
    );
  }

  // Go directly to wallet (skip dashboard selector)
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'wallet':
        // Use FastEntryWallet if in fast entry mode, otherwise use regular WalletDashboard
        if (fastEntryMode) {
          return (
            <FastEntryWallet
              venueId={fastEntryContext.venueId}
              eventId={fastEntryContext.eventId}
              venueName={fastEntryContext.venueName}
              eventName={fastEntryContext.eventName}
              entryFee={fastEntryContext.entryFee}
            />
          );
        }
        return <WalletDashboard onPurchase={handlePurchase} isPurchasing={purchaseMutation.isPending} purchasingDuration={purchasingDuration ?? undefined} />;
      case 'scan':
        // Scan tab shows the actual QR scanner for venue entry
        return <GhostPassScanner />;
      case 'session':
        // Session tab shows the Ghost Pass session generator
        return <QRCodeView />;
      case 'trust':
        return <TrustCenter />;
      case 'history':
        return <TransactionHistory />;
      case 'tickets':
        return <TicketPurchase />;
      case 'modes':
        // Only show modes tester in development
        return import.meta.env.DEV ? <GhostPassModesTester /> : <WalletDashboard onPurchase={handlePurchase} isPurchasing={purchaseMutation.isPending} purchasingDuration={purchasingDuration ?? undefined} />;
      case 'entry-test':
        // Only show entry tester in development
        return import.meta.env.DEV ? <EntryTester /> : <WalletDashboard onPurchase={handlePurchase} isPurchasing={purchaseMutation.isPending} purchasingDuration={purchasingDuration ?? undefined} />;
      case 'admin':
        return <AdminDashboard />;
      default:
        if (fastEntryMode) {
          return (
            <FastEntryWallet
              venueId={fastEntryContext.venueId}
              eventId={fastEntryContext.eventId}
              venueName={fastEntryContext.venueName}
              eventName={fastEntryContext.eventName}
              entryFee={fastEntryContext.entryFee}
            />
          );
        }
        return <WalletDashboard onPurchase={handlePurchase} isPurchasing={purchaseMutation.isPending} purchasingDuration={purchasingDuration ?? undefined} />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fastEntryMode={fastEntryMode}
      onRecoverWallet={() => setShowRecovery(true)}
    >
      {renderActiveTab()}
    </Layout>
  );
};

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
