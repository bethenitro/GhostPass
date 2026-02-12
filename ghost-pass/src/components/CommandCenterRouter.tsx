import React, { useState, useEffect } from 'react';
import CommandCenterPage from './CommandCenterPage';
import VenueCommandCenter from './VenueCommandCenter';
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

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
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

  // Route based on user role
  if (user?.role === 'VENUE_ADMIN') {
    return (
      <VenueCommandCenter
        onBack={props.onBack}
        venueId={user.venue_id}
        eventId={user.event_id}
      />
    );
  }

  // Default to admin command center for ADMIN role
  return <CommandCenterPage {...props} />;
};

export default CommandCenterRouter;
