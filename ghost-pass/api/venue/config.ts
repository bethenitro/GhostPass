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

      // Get venue entry configuration
      let query = supabase
        .from('venue_entry_configs')
        .select('*')
        .eq('venue_id', targetVenueId);

      if (event_id) {
        query = query.eq('event_id', event_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1).single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      // Return default config if none exists
      if (!data) {
        return res.status(200).json({
          venue_id: targetVenueId,
          event_id: event_id || null,
          re_entry_allowed: true,
          initial_entry_fee_cents: 0,
          venue_reentry_fee_cents: 0,
          valid_reentry_scan_fee_cents: 0,
          max_reentries: null,
          reentry_time_limit_hours: null
        });
      }

      res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching venue config:', error);
      res.status(500).json({ 
        error: 'Failed to fetch venue configuration',
        detail: error.message 
      });
    }
  } else if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const {
        venue_id,
        event_id,
        re_entry_allowed,
        initial_entry_fee_cents,
        venue_reentry_fee_cents,
        valid_reentry_scan_fee_cents,
        max_reentries,
        reentry_time_limit_hours
      } = req.body;

      // For VENUE_ADMIN, use their assigned venue_id
      const targetVenueId = user.role === 'VENUE_ADMIN' ? (user as any).venue_id : venue_id;

      if (!targetVenueId) {
        return res.status(400).json({ error: 'venue_id is required' });
      }

      // For VENUE_ADMIN, enforce limits on pricing
      let finalInitialFee = initial_entry_fee_cents;
      let finalVenueReentryFee = venue_reentry_fee_cents;

      if (user.role === 'VENUE_ADMIN') {
        // Venue admins can only set fees within approved limits
        // These limits should be configured per venue, but for now we'll use defaults
        const MAX_INITIAL_FEE = 5000; // $50
        const MAX_REENTRY_FEE = 2000; // $20

        if (initial_entry_fee_cents > MAX_INITIAL_FEE) {
          return res.status(400).json({ 
            error: 'Initial entry fee exceeds approved limit',
            detail: `Maximum allowed: $${MAX_INITIAL_FEE / 100}` 
          });
        }

        if (venue_reentry_fee_cents > MAX_REENTRY_FEE) {
          return res.status(400).json({ 
            error: 'Re-entry fee exceeds approved limit',
            detail: `Maximum allowed: $${MAX_REENTRY_FEE / 100}` 
          });
        }
      }

      const configData = {
        venue_id: targetVenueId,
        event_id: event_id || null,
        re_entry_allowed: re_entry_allowed !== undefined ? re_entry_allowed : true,
        initial_entry_fee_cents: finalInitialFee || 0,
        venue_reentry_fee_cents: finalVenueReentryFee || 0,
        valid_reentry_scan_fee_cents: valid_reentry_scan_fee_cents || 0,
        max_reentries: max_reentries || null,
        reentry_time_limit_hours: reentry_time_limit_hours || null,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };

      // Upsert configuration
      const { data, error } = await supabase
        .from('venue_entry_configs')
        .upsert(configData, {
          onConflict: 'venue_id,event_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Log the configuration change
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: 'UPDATE_VENUE_CONFIG',
        resource_type: 'venue_entry_config',
        resource_id: targetVenueId,
        new_value: configData
      });

      res.status(200).json({
        status: 'success',
        message: 'Venue configuration updated',
        config: data
      });
    } catch (error: any) {
      console.error('Error updating venue config:', error);
      res.status(500).json({ 
        error: 'Failed to update venue configuration',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
