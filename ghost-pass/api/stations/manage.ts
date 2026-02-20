import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const { venue_id, event_id, station_type } = req.query;

      let query = supabase
        .from('stations')
        .select(`
          *,
          revenue_profiles:revenue_profile_id(*),
          tax_profiles:tax_profile_id(*)
        `);

      if (venue_id) query = query.eq('venue_id', venue_id);
      if (event_id) query = query.eq('event_id', event_id);
      if (station_type) query = query.eq('station_type', station_type);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Get stations error:', error);
      res.status(500).json({ error: 'Failed to get stations', detail: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        station_id,
        venue_id,
        event_id,
        station_name,
        station_type,
        revenue_profile_id,
        tax_profile_id,
        employee_id,
        employee_name,
        fee_logic,
        re_entry_rules,
        id_verification_level
      } = req.body;

      if (!station_id || !venue_id || !station_name || !station_type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('stations')
        .insert({
          station_id,
          venue_id,
          event_id: event_id || null,
          station_name,
          station_type,
          revenue_profile_id: revenue_profile_id || null,
          tax_profile_id: tax_profile_id || null,
          employee_id: employee_id || null,
          employee_name: employee_name || null,
          fee_logic: fee_logic || {},
          re_entry_rules: re_entry_rules || {},
          id_verification_level: id_verification_level || 1
        })
        .select()
        .single();

      if (error) throw error;

      // Log station creation (only if audit log table exists and user has permission)
      try {
        await supabase.from('entry_point_audit_logs').insert({
          action_type: 'CREATE',
          entry_point_id: data.id,
          entry_point_type: station_type,
          entry_point_name: station_name,
          employee_name: employee_name || 'N/A',
          employee_id: employee_id || 'N/A',
          admin_user_id: user.id,
          admin_email: user.email,
          source_location: 'API',
          new_values: data
        });
      } catch (auditError) {
        // Log audit error but don't fail the station creation
        console.warn('Failed to create audit log:', auditError);
      }

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Create station error:', error);
      res.status(500).json({ error: 'Failed to create station', detail: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const {
        station_name,
        station_type,
        revenue_profile_id,
        tax_profile_id,
        employee_id,
        employee_name,
        fee_logic,
        re_entry_rules,
        id_verification_level,
        status
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Station ID is required' });
      }

      const updateData: any = {};
      if (station_name !== undefined) updateData.station_name = station_name;
      if (station_type !== undefined) updateData.station_type = station_type;
      if (revenue_profile_id !== undefined) updateData.revenue_profile_id = revenue_profile_id || null;
      if (tax_profile_id !== undefined) updateData.tax_profile_id = tax_profile_id || null;
      if (employee_id !== undefined) updateData.employee_id = employee_id || null;
      if (employee_name !== undefined) updateData.employee_name = employee_name || null;
      if (fee_logic !== undefined) updateData.fee_logic = fee_logic;
      if (re_entry_rules !== undefined) updateData.re_entry_rules = re_entry_rules;
      if (id_verification_level !== undefined) updateData.id_verification_level = id_verification_level;
      if (status !== undefined) updateData.status = status;

      const { data, error } = await supabase
        .from('stations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json(data);
    } catch (error: any) {
      console.error('Update station error:', error);
      res.status(500).json({ error: 'Failed to update station', detail: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Station ID is required' });
      }

      const { error } = await supabase
        .from('stations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({ message: 'Station deleted successfully' });
    } catch (error: any) {
      console.error('Delete station error:', error);
      res.status(500).json({ error: 'Failed to delete station', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
