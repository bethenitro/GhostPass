import React, { useState, useEffect } from 'react';
import CommandCenterPage from './CommandCenterPage';
import { SuperAdminCommandCenter } from './admin/SuperAdminCommandCenter';
import { VenueAdminCommandCenter } from './admin/VenueAdminCommandCenter';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

interface CommandCenterRouterProps {
  onBack: () => void;
  onNavigateToGatewayManager: () => void;
  onNavigateToAuditTrail?: () => void;
}

const CommandCenterRouter: React.FC<CommandCenterRouterProps> = (props) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Check if auth token exists
      const token = authApi.getToken();
      if (!token) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      const currentUser = await authApi.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setAuthError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  // Show authentication required message
  if (authError || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-slate-400 mb-6">
            You need to be logged in to access the Command Center. Please sign in with your admin or venue admin account.
          </p>
          <button
            onClick={() => {
              // Clear any stale tokens
              authApi.signOut();
              // Redirect to login or home
              window.location.href = '/';
            }}
            className="w-full px-6 py-3 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Route based on user role
  if (user?.role === 'VENUE_ADMIN') {
    return (
      <VenueAdminCommandCenter
        venueId={user.venue_id || ''}
        eventId={user.event_id}
      />
    );
  }

  // ADMIN users get full SuperAdminCommandCenter
  if (user?.role === 'ADMIN') {
    return <SuperAdminCommandCenter />;
  }

  // Default to CommandCenterPage
  return (
    <CommandCenterPage
      onBack={props.onBack}
      onNavigateToGatewayManager={props.onNavigateToGatewayManager}
      onNavigateToAuditTrail={props.onNavigateToAuditTrail}
    />
  );
};

export default CommandCenterRouter;
