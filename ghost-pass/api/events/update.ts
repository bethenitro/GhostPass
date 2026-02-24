import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const {
      event_id,
      venue_id,
      event_name,
      description,
      start_date,
      end_date,
      ticket_price_cents,
      entry_fee_cents,
      re_entry_fee_cents,
      platform_fee_cents,
      revenue_profile_id,
      tax_profile_id
    } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: 'event_id is required' });
    }

    // Check if event exists and user has permission
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id) // Use 'id' column, not 'event_id'
      .single();

    if (fetchError || !existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is admin or venue admin for this venue
    if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (user.role === 'VENUE_ADMIN' && existingEvent.venue_id !== (user as any).venue_id) {
      return res.status(403).json({ error: 'You can only update events for your venue' });
    }

    // Update event
    const updateData: any = {};
    if (venue_id !== undefined) updateData.venue_id = venue_id;
    if (event_name !== undefined) updateData.name = event_name; // Use 'name' column, not 'event_name'
    if (description !== undefined) updateData.description = description;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (ticket_price_cents !== undefined) updateData.ticket_price_cents = ticket_price_cents;
    if (entry_fee_cents !== undefined) updateData.entry_fee_cents = entry_fee_cents;
    if (re_entry_fee_cents !== undefined) updateData.re_entry_fee_cents = re_entry_fee_cents;
    if (platform_fee_cents !== undefined) updateData.platform_fee_cents = platform_fee_cents;
    if (revenue_profile_id !== undefined) updateData.revenue_profile_id = revenue_profile_id;
    if (tax_profile_id !== undefined) updateData.tax_profile_id = tax_profile_id;

    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', event_id) // Use 'id' column, not 'event_id'
      .select()
      .single();

    if (updateError) {
      console.error('Event update error:', updateError);
      return res.status(500).json({ error: 'Failed to update event' });
    }

    // Log audit trail if user is admin
    if (user.role === 'ADMIN' || user.role === 'VENUE_ADMIN') {
      try {
        await supabase.from('audit_logs').insert({
          admin_user_id: user.id,
          action: 'UPDATE_EVENT',
          resource_type: 'event',
          resource_id: event_id,
          old_value: existingEvent,
          new_value: updatedEvent
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }
    }

    res.status(200).json({
      message: 'Event updated successfully',
      event: updatedEvent
    });
  } catch (error: any) {
    console.error('Event update error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};
