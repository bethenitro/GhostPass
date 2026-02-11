import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabase } from '../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;

  // PUT /api/gateway/points/[id] (update point)
  if (req.method === 'PUT') {
    try {
      // Get existing point
      const { data: existing, error: fetchError } = await supabase
        .from('gateway_points')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ detail: 'Gateway point not found' });
      }

      const oldPoint = existing;
      const updates = req.body;

      // Build update data
      const updateData: any = {};

      if (updates.name !== undefined) {
        // Check for duplicate name if name is being changed
        if (updates.name !== oldPoint.name) {
          const { data: duplicate } = await supabase
            .from('gateway_points')
            .select('id')
            .eq('venue_id', oldPoint.venue_id)
            .eq('name', updates.name)
            .eq('type', oldPoint.type);

          if (duplicate && duplicate.length > 0) {
            return res.status(400).json({
              detail: `A ${oldPoint.type.toLowerCase().replace('_', ' ')} with name '${updates.name}' already exists`
            });
          }
        }
        updateData.name = updates.name;
      }

      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }

      if (updates.number !== undefined) {
        updateData.number = updates.number;
      }

      if (updates.accepts_ghostpass !== undefined) {
        updateData.accepts_ghostpass = updates.accepts_ghostpass;
      }

      if (updates.employee_name !== undefined) {
        updateData.employee_name = updates.employee_name;
      }

      if (updates.employee_id !== undefined) {
        updateData.employee_id = updates.employee_id;
      }

      if (updates.visual_identifier !== undefined) {
        updateData.visual_identifier = updates.visual_identifier;
      }

      if (updates.linked_area_id !== undefined) {
        // Verify the linked area exists and is an INTERNAL_AREA
        const { data: linkedArea } = await supabase
          .from('gateway_points')
          .select('id, type')
          .eq('id', updates.linked_area_id)
          .single();

        if (!linkedArea) {
          return res.status(400).json({ detail: 'Linked area not found' });
        }

        if (linkedArea.type !== 'INTERNAL_AREA') {
          return res.status(400).json({
            detail: 'linked_area_id must reference an INTERNAL_AREA'
          });
        }

        updateData.linked_area_id = updates.linked_area_id;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(200).json(oldPoint);
      }

      // Update gateway point
      const { data, error } = await supabase
        .from('gateway_points')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        action: 'UPDATE_GATEWAY_POINT',
        resource_type: 'gateway_point',
        resource_id: id as string,
        old_value: oldPoint,
        new_value: data
      });

      // Also log detailed entry point audit for tracking changes
      const actionType = 
        updates.status && oldPoint.status === 'ENABLED' && updates.status === 'DISABLED' ? 'DEACTIVATE' :
        updates.status && oldPoint.status === 'DISABLED' && updates.status === 'ENABLED' ? 'ACTIVATE' :
        'EDIT';

      const changes: any = {};
      if (updates.name && updates.name !== oldPoint.name) {
        changes.name = { old: oldPoint.name, new: updates.name };
      }
      if (updates.employee_name && updates.employee_name !== oldPoint.employee_name) {
        changes.employee_name = { old: oldPoint.employee_name, new: updates.employee_name };
      }
      if (updates.employee_id && updates.employee_id !== oldPoint.employee_id) {
        changes.employee_id = { old: oldPoint.employee_id, new: updates.employee_id };
      }
      if (updates.status && updates.status !== oldPoint.status) {
        changes.status = { old: oldPoint.status, new: updates.status };
      }

      await supabase.from('entry_point_audit_logs').insert({
        action_type: actionType,
        entry_point_id: id,
        entry_point_type: data.type,
        entry_point_name: data.name,
        employee_name: data.employee_name,
        employee_id: data.employee_id,
        admin_user_id: user.id,
        admin_email: user.email || 'unknown',
        source_location: 'Command Center',
        old_values: oldPoint,
        new_values: data,
        metadata: { changes, admin_action: true }
      });

      res.status(200).json(data);
    } catch (error) {
      console.error('Update gateway point error:', error);
      res.status(500).json({ detail: 'Failed to update gateway point' });
    }
  }
  // DELETE /api/gateway/points/[id] (delete point)
  else if (req.method === 'DELETE') {
    try {
      // Get existing point for audit log
      const { data: existing, error: fetchError } = await supabase
        .from('gateway_points')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ detail: 'Gateway point not found' });
      }

      const oldPoint = existing;

      // Delete gateway point
      const { error } = await supabase
        .from('gateway_points')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log admin action
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        action: 'DELETE_GATEWAY_POINT',
        resource_type: 'gateway_point',
        resource_id: id as string,
        old_value: oldPoint,
        new_value: null
      });

      res.status(200).json({ status: 'success', message: 'Gateway point deleted successfully' });
    } catch (error) {
      console.error('Delete gateway point error:', error);
      res.status(500).json({ detail: 'Failed to delete gateway point' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
