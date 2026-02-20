import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      event_id,
      venue_id,
      venue_name,
      event_name,
      description,
      start_date,
      end_date,
      ticket_price_cents,
      entry_fee_cents,
      re_entry_fee_cents,
      platform_fee_cents,
      state_tax_percentage,
      local_tax_percentage,
      alcohol_tax_percentage,
      food_tax_percentage,
      valid_percentage,
      vendor_percentage,
      pool_percentage,
      promoter_percentage,
      executive_percentage,
      payout_routing_id
    } = req.body;

    if (!event_id || !venue_id || !event_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use venue_id as venue_name fallback if not provided
    const finalVenueName = venue_name || venue_id;

    const { data, error } = await supabase
      .from('events')
      .insert({
        id: event_id, // Use 'id' column, not 'event_id'
        name: event_name, // Use 'name' column, not 'event_name'
        venue_id,
        venue_name: finalVenueName,
        description: description || null,
        start_date,
        end_date,
        ticket_price_cents: ticket_price_cents || 0,
        entry_fee_cents: entry_fee_cents || 0,
        re_entry_fee_cents: re_entry_fee_cents || 0,
        platform_fee_cents: platform_fee_cents || 25,
        // Store tax percentages and revenue split in metadata
        metadata: {
          payout_routing_id: payout_routing_id || null,
          state_tax_percentage: state_tax_percentage || 0,
          local_tax_percentage: local_tax_percentage || 0,
          alcohol_tax_percentage: alcohol_tax_percentage || 0,
          food_tax_percentage: food_tax_percentage || 0,
          // Revenue split percentages (matching revenue_profiles table)
          valid_percentage: valid_percentage || 0,
          vendor_percentage: vendor_percentage || 0,
          pool_percentage: pool_percentage || 0,
          promoter_percentage: promoter_percentage || 0,
          executive_percentage: executive_percentage || 0,
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Create event error:', error);
      
      // Handle duplicate key error
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        return res.status(409).json({ 
          error: 'Event ID already exists', 
          detail: 'An event with this ID already exists. Please use a different event ID.' 
        });
      }
      
      throw error;
    }

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event', detail: error.message });
  }
};
