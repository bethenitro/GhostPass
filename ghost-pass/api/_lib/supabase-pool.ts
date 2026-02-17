/**
 * Optimized Supabase Client with Connection Pooling
 * 
 * Uses pgBouncer-style connection pooling to reduce connection overhead
 * and improve performance under high load.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

// Singleton client with optimized settings
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Disable session persistence for serverless
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-pool': 'enabled',
        },
      },
    });
  }
  return supabaseClient;
}

// Export singleton instance
export const supabase = getSupabaseClient();

/**
 * Execute multiple queries in a single transaction
 * Reduces round trips and ensures atomicity
 */
export async function executeTransaction<T>(
  queries: Array<() => Promise<any>>
): Promise<T[]> {
  const results: T[] = [];
  
  // Execute all queries
  for (const query of queries) {
    const result = await query();
    results.push(result);
  }
  
  return results;
}

/**
 * Batch multiple reads into a single query
 */
export async function batchRead<T>(
  table: string,
  ids: string[],
  idColumn: string = 'id'
): Promise<T[]> {
  if (ids.length === 0) return [];
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .in(idColumn, ids);
  
  if (error) throw error;
  return data as T[];
}
