/**
 * Supabase Real-time Hook
 * 
 * Provides WebSocket-based real-time updates for database changes
 * using Supabase's built-in real-time functionality.
 */

import { useEffect, useRef, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types for our database tables
interface SensorySignal {
  signal_id: string;
  payload_type: 'scu' | 'capsule';
  source_id: string;
  timestamp: string;
  received_at: string;
  status: 'approved' | 'rejected' | 'unknown';
  ghost_pass_approved: boolean;
  sensory_type?: string;
  sensory_types?: string[];
  signal_data?: any;
  metadata?: any;
  validation_result?: any;
  capsule_id?: string;
  scu_count?: number;
  scus?: any[];
}

interface SenateEvaluation {
  evaluation_id: string;
  signal_id: string;
  status: 'pending' | 'completed' | 'escalated';
  priority: 'high' | 'medium' | 'normal';
  signal_data: any;
  context: any;
  received_at: string;
  completed_at?: string;
}

interface SenateDecision {
  decision_id: string;
  evaluation_id: string;
  signal_id: string;
  decision: 'approved' | 'rejected' | 'escalated' | 'request_more_data';
  reason: string;
  reviewer_id: string;
  trust_score?: number;
  timestamp: string;
  signal_data?: any;
  context?: any;
}

type DatabaseEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimeSubscription {
  table: string;
  event: DatabaseEvent;
  callback: (payload: RealtimePostgresChangesPayload<any>) => void;
}

interface UseSupabaseRealtimeOptions {
  enabled?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

export const useSupabaseRealtime = (
  subscriptions: RealtimeSubscription[],
  options: UseSupabaseRealtimeOptions = {}
) => {
  const { enabled = true, onConnectionChange, onError } = options;
  const channelRef = useRef<any>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const isConnectedRef = useRef(false);

  // Initialize Supabase client
  const initializeSupabase = useCallback((): SupabaseClient | null => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[REALTIME] Supabase credentials not found in environment variables');
      console.warn('[REALTIME] URL:', supabaseUrl);
      console.warn('[REALTIME] Key:', supabaseKey ? 'Present' : 'Missing');
      return null;
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      console.log('[REALTIME] Supabase client initialized');
      console.log('[REALTIME] URL:', supabaseUrl);
      console.log('[REALTIME] Key type:', supabaseKey.startsWith('eyJ') ? 'JWT' : 'Other');
      return supabase;
    } catch (error) {
      console.error('[REALTIME] Failed to initialize Supabase client:', error);
      onError?.(error as Error);
      return null;
    }
  }, [onError]);

  // Setup real-time subscriptions
  const setupSubscriptions = useCallback(async () => {
    if (!enabled || subscriptions.length === 0) return;

    const supabase = supabaseRef.current || initializeSupabase();
    if (!supabase) return;

    supabaseRef.current = supabase;

    try {
      // Create a channel for all subscriptions
      const channelName = `sensory-system-${Date.now()}`;
      const channel = supabase.channel(channelName);

      console.log(`[REALTIME] Setting up ${subscriptions.length} subscription(s) on channel: ${channelName}`);

      // Add all subscriptions to the channel
      subscriptions.forEach(({ table, event, callback }) => {
        const handleChange = (payload: RealtimePostgresChangesPayload<any>) => {
          console.log(`[REALTIME] ${event} event on ${table}:`, payload);
          try {
            callback(payload);
          } catch (error) {
            console.error(`[REALTIME] Error in callback for ${table}:`, error);
            onError?.(error as Error);
          }
        };

        (channel as any).on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
          },
          (payload: RealtimePostgresChangesPayload<any>) => handleChange(payload)
        );
      });

      // Subscribe to the channel
      channel.subscribe((status: string) => {
        console.log('[REALTIME] Subscription status:', status);
        
        const connected = status === 'SUBSCRIBED';
        if (connected !== isConnectedRef.current) {
          isConnectedRef.current = connected;
          onConnectionChange?.(connected);
          
          if (connected) {
            console.log('[REALTIME] ✅ Connected to Supabase real-time');
          } else {
            console.log('[REALTIME] ❌ Disconnected from Supabase real-time');
          }
        }
      });

      channelRef.current = channel;

    } catch (error) {
      console.error('[REALTIME] Failed to setup subscriptions:', error);
      onError?.(error as Error);
    }
  }, [enabled, subscriptions, initializeSupabase, onConnectionChange, onError]);

  // Cleanup subscriptions
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('[REALTIME] Cleaning up subscriptions');
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    isConnectedRef.current = false;
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  // Setup effect
  useEffect(() => {
    if (enabled) {
      setupSubscriptions();
    } else {
      cleanup();
    }

    return cleanup;
  }, [enabled, setupSubscriptions, cleanup]);

  // Return connection status and manual controls
  return {
    isConnected: isConnectedRef.current,
    reconnect: setupSubscriptions,
    disconnect: cleanup,
  };
};

// Convenience hooks for specific tables
export const useSensorySignalsRealtime = (
  onSignalChange: (payload: RealtimePostgresChangesPayload<SensorySignal>) => void,
  options: UseSupabaseRealtimeOptions = {}
) => {
  return useSupabaseRealtime([
    {
      table: 'sensory_signals',
      event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
      callback: onSignalChange,
    }
  ], options);
};

export const useSenateEvaluationsRealtime = (
  onEvaluationChange: (payload: RealtimePostgresChangesPayload<SenateEvaluation>) => void,
  options: UseSupabaseRealtimeOptions = {}
) => {
  return useSupabaseRealtime([
    {
      table: 'senate_evaluations',
      event: '*',
      callback: onEvaluationChange,
    }
  ], options);
};

export const useSenateDecisionsRealtime = (
  onDecisionChange: (payload: RealtimePostgresChangesPayload<SenateDecision>) => void,
  options: UseSupabaseRealtimeOptions = {}
) => {
  return useSupabaseRealtime([
    {
      table: 'senate_decisions',
      event: '*',
      callback: onDecisionChange,
    }
  ], options);
};

// Combined hook for all sensory system tables
export const useSensorySystemRealtime = (callbacks: {
  onSignalChange?: (payload: RealtimePostgresChangesPayload<SensorySignal>) => void;
  onEvaluationChange?: (payload: RealtimePostgresChangesPayload<SenateEvaluation>) => void;
  onDecisionChange?: (payload: RealtimePostgresChangesPayload<SenateDecision>) => void;
}, options: UseSupabaseRealtimeOptions = {}) => {
  const subscriptions: RealtimeSubscription[] = [];

  if (callbacks.onSignalChange) {
    subscriptions.push({
      table: 'sensory_signals',
      event: '*',
      callback: callbacks.onSignalChange,
    });
  }

  if (callbacks.onEvaluationChange) {
    subscriptions.push({
      table: 'senate_evaluations',
      event: '*',
      callback: callbacks.onEvaluationChange,
    });
  }

  if (callbacks.onDecisionChange) {
    subscriptions.push({
      table: 'senate_decisions',
      event: '*',
      callback: callbacks.onDecisionChange,
    });
  }

  return useSupabaseRealtime(subscriptions, options);
};