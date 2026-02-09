/**
 * List Events API
 * 
 * Returns all active events available for ticket purchase.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_lib/cors';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (eventsError) {
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    return res.status(200).json({
      events: events || [],
      count: events?.length || 0,
    });

  } catch (error) {
    console.error('List events error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
