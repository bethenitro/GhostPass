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
      revenue_profile_id,
      state_tax_percentage,
      local_tax_percentage,
      alcohol_tax_percentage,
      food_tax_percentage,
      payout_routing_id
    } = req.body;

    if (!event_id || !venue_id || !venue_name || !event_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        id: event_id, // Use 'id' column, not 'event_id'
        name: event_name, // Use 'name' column, not 'event_name'
        venue_id,
        venue_name,
        description: description || null,
        start_date,
        end_date,
        ticket_price_cents: ticket_price_cents || 0,
        entry_fee_cents: entry_fee_cents || 0,
        re_entry_fee_cents: re_entry_fee_cents || 0,
        platform_fee_cents: platform_fee_cents || 25,
        // Store tax percentages in metadata
        metadata: {
          revenue_profile_id: revenue_profile_id || null,
          payout_routing_id: payout_routing_id || null,
          state_tax_percentage: state_tax_percentage || 0,
          local_tax_percentage: local_tax_percentage || 0,
          alcohol_tax_percentage: alcohol_tax_percentage || 0,
          food_tax_percentage: food_tax_percentage || 0,
        }
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event', detail: error.message });
  }
};
