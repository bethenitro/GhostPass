import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionApi } from '../lib/api';
import type { Session } from '../types';

export const useSession = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const { data: sessionStatus, refetch: refetchSession } = useQuery({
    queryKey: ['session-status'],
    queryFn: sessionApi.getStatus,
    refetchInterval: 1000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sessionStatus?.session && sessionStatus.session.status === 'ACTIVE') {
      setActiveSession(sessionStatus.session);
    } else {
      setActiveSession(null);
    }
  }, [sessionStatus]);

  const getTimeRemaining = (expiresAt: string) => {
    const now = currentTime.getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { hours, minutes, seconds, total: diff };
  };

  const sessionTimeRemaining = activeSession?.vaporizes_at ? getTimeRemaining(activeSession.vaporizes_at) : null;
  const isSessionExpired = activeSession?.status !== 'ACTIVE' || !sessionTimeRemaining;
  const isSessionExpiringSoon = sessionTimeRemaining && sessionTimeRemaining.total < 30000;

  const vaporizeSession = async () => {
    if (!activeSession) return;
    
    try {
      await sessionApi.vaporize();
      setActiveSession(null);
      refetchSession();
    } catch (error) {
      console.error('Failed to vaporize session:', error);
      throw error;
    }
  };

  return {
    activeSession,
    sessionTimeRemaining,
    isSessionExpired,
    isSessionExpiringSoon,
    currentTime,
    refetchSession,
    vaporizeSession,
    sessionStatus
  };
};

export default useSession;