// User Sync Library for Ghost Pass
// Syncs users between ghost-pass and be-valid-prototyper databases

import { createClient } from '@supabase/supabase-js';
import { supabase as ghostPassSupabase } from './supabase.js';

// Initialize be-valid Supabase client
const beValidSupabase = createClient(
  process.env.BEVALID_SUPABASE_URL || 'https://csfwfxkuyapfakrmhgjh.supabase.co',
  process.env.BEVALID_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZndmeGt1eWFwZmFrcm1oZ2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MjcyNzEsImV4cCI6MjA4MDIwMzI3MX0.t2oafGgjKev-wXudmTe5QGU6q7G7H2ztqHNP06FqUJc'
);

export interface SyncedUser {
  id: string;
  email: string;
  role: string;
  venue_id?: string;
  event_id?: string;
  created_at: string;
  synced_at: string;
}

/**
 * Sync user from ghost-pass to be-valid database
 * Called when user registers or logs in on ghost-pass
 */
export const syncUserToBeValid = async (
  ghostPassUserId: string,
  userData: any
): Promise<SyncedUser | null> => {
  try {
    if (!beValidSupabase) {
      console.warn('Be-Valid Supabase client not configured');
      return null;
    }

    // Check if user already exists in be-valid database
    const { data: existingUser, error: checkError } = await beValidSupabase
      .from('profiles')
      .select('*')
      .eq('user_id', ghostPassUserId)
      .single();

    if (!checkError && existingUser) {
      // User already exists, just update sync timestamp
      const { error: updateError } = await beValidSupabase
        .from('profiles')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', ghostPassUserId);
      
      if (updateError) {
        console.error('Error updating user sync timestamp:', updateError);
      }

      return {
        id: ghostPassUserId,
        email: userData.email,
        role: userData.role || 'USER',
        venue_id: userData.venue_id,
        event_id: userData.event_id,
        created_at: userData.created_at,
        synced_at: new Date().toISOString(),
      };
    }

    // Create new user profile in be-valid database
    const { error: insertError } = await beValidSupabase
      .from('profiles')
      .insert({
        user_id: ghostPassUserId,
        email: userData.email,
        role: userData.role || 'USER',
        venue_id: userData.venue_id,
        event_id: userData.event_id,
        created_at: userData.created_at,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(`Failed to create user profile in be-valid: ${insertError.message}`);
      return null;
    }

    // Log the sync event
    await logUserSync(ghostPassUserId, 'GHOST_PASS_TO_BEVALID', userData.email);

    return {
      id: ghostPassUserId,
      email: userData.email,
      role: userData.role || 'USER',
      venue_id: userData.venue_id,
      event_id: userData.event_id,
      created_at: userData.created_at,
      synced_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('Error syncing user to be-valid:', error);
    return null;
  }
};

/**
 * Sync user from be-valid to ghost-pass database
 * Called when user creates account on be-valid
 */
export const syncUserToGhostPass = async (
  beValidUserId: string,
  userData: any
): Promise<SyncedUser | null> => {
  try {
    // Check if user already exists in ghost-pass database
    const { data: existingUser, error: checkError } = await ghostPassSupabase
      .from('users')
      .select('*')
      .eq('id', beValidUserId)
      .single();

    if (!checkError && existingUser) {
      // User already exists, just update sync timestamp
      const { error: updateError } = await ghostPassSupabase
        .from('users')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', beValidUserId);
      
      if (updateError) {
        console.error('Error updating user sync timestamp in ghost-pass:', updateError);
      }

      return {
        id: beValidUserId,
        email: userData.email,
        role: userData.role || 'USER',
        venue_id: userData.venue_id,
        event_id: userData.event_id,
        created_at: userData.created_at,
        synced_at: new Date().toISOString(),
      };
    }

    // Create new user in ghost-pass database
    const { error: insertError } = await ghostPassSupabase
      .from('users')
      .insert({
        id: beValidUserId,
        email: userData.email,
        role: userData.role || 'USER',
        venue_id: userData.venue_id,
        event_id: userData.event_id,
        created_at: userData.created_at,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(`Failed to create user in ghost-pass: ${insertError.message}`);
      return null;
    }

    // Log the sync event
    await logUserSync(beValidUserId, 'BEVALID_TO_GHOST_PASS', userData.email);

    return {
      id: beValidUserId,
      email: userData.email,
      role: userData.role || 'USER',
      venue_id: userData.venue_id,
      event_id: userData.event_id,
      created_at: userData.created_at,
      synced_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('Error syncing user to ghost-pass:', error);
    return null;
  }
};

/**
 * Log user sync events for audit trail
 */
const logUserSync = async (
  userId: string,
  syncDirection: 'GHOST_PASS_TO_BEVALID' | 'BEVALID_TO_GHOST_PASS',
  email: string
) => {
  try {
    // Log in ghost-pass audit logs
    const { error } = await ghostPassSupabase.from('audit_logs').insert({
      action_type: 'USER_SYNC',
      status: 'success',
      metadata: {
        user_id: userId,
        email: email,
        sync_direction: syncDirection,
        synced_at: new Date().toISOString(),
      },
    });
    
    if (error) {
      console.error('Error logging user sync:', error);
    }
  } catch (error) {
    console.error('Error logging user sync:', error);
  }
};
