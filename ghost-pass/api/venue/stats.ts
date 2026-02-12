import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  // Check if user is VENUE_ADMIN or ADMIN
  if (user.role !== 'VENUE_ADMIN' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', detail: 'Venue admin access required' });
  }

  if (req.method === 'GET') {
    try {
      const { venue_id, event_id } = req.query;

      // For VENUE_ADMIN, use their assigned venue_id
      const targetVenueId = user.role === 'VENUE_ADMIN' ? (user as any).venue_id : venue_id;

      if (!targetVenueId) {
        return res.status(400).json({ error: 'venue_id is required' });
      }

      // Build query for entry events
      let entryQuery = supabase
        .from('entry_events')
        .select('*')
        .eq('venue_id', targetVenueId);

      if (event_id) {
        entryQuery = entryQuery.eq('event_id', event_id);
      }

      const { data: entries, error: entriesError } = await entryQuery;

      if (entriesError) throw entriesError;

      // Calculate statistics
      const totalEntries = entries?.length || 0;
      const totalReentries = entries?.filter(e => e.entry_type === 'RE_ENTRY').length || 0;
      const uniqueAttendees = new Set(entries?.map(e => e.wallet_binding_id)).size;

      // Calculate revenue
      let totalRevenue = 0;
      let venueRevenue = 0;
      let validRevenue = 0;

      entries?.forEach(entry => {
        totalRevenue += entry.total_fees_cents || 0;
        venueRevenue += entry.venue_reentry_fee_cents || 0;
        validRevenue += entry.valid_reentry_scan_fee_cents || 0;
      });

      // Get current capacity (active sessions)
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('wallet_sessions')
        .select('id')
        .eq('venue_id', targetVenueId)
        .eq('is_active', true);

      if (sessionsError) throw sessionsError;

      const currentCapacity = activeSessions?.length || 0;

      // Calculate peak capacity (max concurrent sessions in last 24 hours)
      // This would require time-series data, for now we'll use current as peak
      const peakCapacity = currentCapacity;

      // Calculate average entry time (simplified)
      const avgEntryTimeMinutes = 0; // Would need more complex calculation

      const stats = {
        total_entries: totalEntries,
        total_reentries: totalReentries,
        total_revenue_cents: totalRevenue,
        venue_revenue_cents: venueRevenue,
        valid_revenue_cents: validRevenue,
        unique_attendees: uniqueAttendees,
        current_capacity: currentCapacity,
        peak_capacity: peakCapacity,
        avg_entry_time_minutes: avgEntryTimeMinutes
      };

      res.status(200).json(stats);
    } catch (error: any) {
      console.error('Error fetching venue stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch venue statistics',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
