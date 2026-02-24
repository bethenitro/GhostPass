import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { event_id } = req.query;

    if (!event_id || typeof event_id !== 'string') {
      return res.status(400).json({ error: 'event_id is required' });
    }

    // Check if event exists and user has permission
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id) // Use 'id' column, not 'event_id'
      .single();

    console.log('Delete event - Looking for id:', event_id);
    console.log('Delete event - Found event:', existingEvent);
    console.log('Delete event - Fetch error:', fetchError);

    if (fetchError || !existingEvent) {
      console.error('Event not found:', { event_id, fetchError });
      return res.status(404).json({ error: 'Event not found', event_id, details: fetchError?.message });
    }

    // Check if user is admin or venue admin for this venue
    if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // If venue admin, verify they own this venue
    if (user.role === 'VENUE_ADMIN') {
      const userVenueId = (user as any).venue_id;
      if (userVenueId && userVenueId !== existingEvent.venue_id) {
        return res.status(403).json({ error: 'You can only delete events for your venue' });
      }
    }

    // Delete the event
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', event_id); // Use 'id' column, not 'event_id'

    if (deleteError) {
      throw deleteError;
    }

    res.status(200).json({ 
      success: true, 
      message: 'Event deleted successfully',
      event_id 
    });
  } catch (error: any) {
    console.error('Delete event error:', error);
    res.status(500).json({ 
      error: 'Failed to delete event', 
      detail: error.message 
    });
  }
};
