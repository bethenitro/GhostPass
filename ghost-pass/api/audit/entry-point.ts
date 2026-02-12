import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const {
        entry_point_id,
        employee_name,
        action_type,
        start_date,
        end_date,
        source_location,
        limit = '100',
        offset = '0'
      } = req.query;

      // Build query for entry_point_audit_logs table
      let query = supabase
        .from('entry_point_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      // Apply filters
      if (entry_point_id) {
        query = query.eq('entry_point_id', entry_point_id);
      }
      if (employee_name) {
        query = query.ilike('employee_name', `%${employee_name}%`);
      }
      if (action_type) {
        query = query.eq('action_type', action_type);
      }
      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }
      if (source_location) {
        query = query.ilike('source_location', `%${source_location}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ 
        error: 'Failed to fetch audit logs',
        detail: error.message 
      });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        action_type,
        entry_point_id,
        source_location,
        old_values,
        new_values,
        metadata
      } = req.body;

      // Get entry point details
      const { data: gateway, error: gatewayError } = await supabase
        .from('gateway_points')
        .select('*')
        .eq('id', entry_point_id)
        .single();

      if (gatewayError || !gateway) {
        return res.status(404).json({ error: 'Entry point not found' });
      }

      // Get user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, email')
        .eq('id', user.id)
        .single();

      const admin_email = userData?.role === 'ADMIN' ? userData.email : null;

      // Insert audit log
      const auditLog = {
        action_type,
        entry_point_id,
        entry_point_type: gateway.type,
        entry_point_name: gateway.name,
        employee_name: gateway.employee_name,
        employee_id: gateway.employee_id,
        admin_user_id: admin_email ? user.id : null,
        admin_email,
        source_location,
        old_values,
        new_values,
        metadata: metadata || {}
      };

      const { data: result, error: insertError } = await supabase
        .from('entry_point_audit_logs')
        .insert(auditLog)
        .select()
        .single();

      if (insertError) throw insertError;

      res.status(200).json({
        status: 'success',
        audit_id: result.id,
        message: 'Audit log created successfully'
      });
    } catch (error: any) {
      console.error('Error logging entry point action:', error);
      res.status(500).json({ 
        error: 'Failed to log audit action',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
