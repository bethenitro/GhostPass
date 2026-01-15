import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './components/AuthProvider';
import LoginScreen from './components/LoginScreen';
import Layout from './components/Layout';
import WalletDashboard from './components/WalletDashboard';
import QRCodeView from './components/QRCodeView';
import TrustCenter from './components/TrustCenter';
import TransactionHistory from './components/TransactionHistory';
import CommandCenterPage from './components/CommandCenterPage';
import GatewayManagerPage from './components/GatewayManagerPage';
import AuditTrail from './components/AuditTrail';
import { ghostPassApi } from './lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 2,
    },
  },
});

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'wallet' | 'scan' | 'trust' | 'history'>('wallet');
  const [purchasingDuration, setPurchasingDuration] = useState<number | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [previousRoute, setPreviousRoute] = useState<string>('');
  const queryClient = useQueryClient();

  // Check if we're on special routes
  const [currentRoute, setCurrentRoute] = useState(window.location.hash);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = window.location.hash;
      setPreviousRoute(currentRoute);
      setCurrentRoute(newRoute);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentRoute]);

  // Listen for audit trail navigation event
  useEffect(() => {
    const handleAuditTrailNavigation = () => {
      window.location.hash = '#/audit-trail';
    };
    window.addEventListener('navigate-to-audit-trail', handleAuditTrailNavigation);
    return () => window.removeEventListener('navigate-to-audit-trail', handleAuditTrailNavigation);
  }, []);

  const isGatewayManagerRoute = currentRoute === '#/gateway-manager';
  const isAuditTrailRoute = currentRoute === '#/audit-trail';
  const isCommandCenterRoute = currentRoute === '#/command-center';

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

  const handleAdminModeToggle = () => {
    setIsAdminMode(!isAdminMode);
    if (!isAdminMode) {
      // Navigate to command center page instead of opening modal
      window.location.hash = '#/command-center';
    }
  };

  const handleNavigateToGatewayManager = () => {
    window.location.hash = '#/gateway-manager';
  };

  const handleBackToMain = () => {
    window.location.hash = '#/';
    setIsAdminMode(false);
  };

  const handleBackFromGatewayManager = () => {
    // If we came from command center, go back there, otherwise go to main
    if (previousRoute === '#/command-center') {
      window.location.hash = '#/command-center';
    } else {
      handleBackToMain();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400">Loading GhostPass...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'wallet':
        return <WalletDashboard onPurchase={handlePurchase} isPurchasing={purchaseMutation.isPending} purchasingDuration={purchasingDuration ?? undefined} />;
      case 'scan':
        return <QRCodeView />;
      case 'trust':
        return <TrustCenter />;
      case 'history':
        return <TransactionHistory />;
      default:
        return <WalletDashboard onPurchase={handlePurchase} isPurchasing={purchaseMutation.isPending} purchasingDuration={purchasingDuration ?? undefined} />;
    }
  };

  // Show Gateway Manager page if on gateway-manager route
  if (isGatewayManagerRoute) {
    return <GatewayManagerPage onBack={handleBackFromGatewayManager} />;
  }

  // Show Audit Trail page if on audit-trail route
  if (isAuditTrailRoute) {
    return <AuditTrail onBack={handleBackToMain} />;
  }

  // Show Command Center page if on command-center route
  if (isCommandCenterRoute) {
    return <CommandCenterPage onBack={handleBackToMain} onNavigateToGatewayManager={handleNavigateToGatewayManager} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userRole={user.role}
      isAdminMode={isAdminMode}
      onAdminModeToggle={handleAdminModeToggle}
    >
      {renderActiveTab()}
    </Layout>
  );
};

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
