import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) return;

  // GET /api/gateway/points?type=ENTRY_POINT (or INTERNAL_AREA or TABLE_SEAT)
  if (req.method === 'GET') {
    try {
      const { type, status } = req.query;
      
      // TODO: Get actual venue_id from user context
      const venueId = 'venue_001';

      let query = supabase
        .from('gateway_points')
        .select('id, venue_id, name, number, accepts_ghostpass, status, type, employee_name, employee_id, visual_identifier, linked_area_id, created_at, updated_at, created_by')
        .eq('venue_id', venueId);

      if (type) {
        query = query.eq('type', (type as string).toUpperCase());
      }

      if (status) {
        query = query.eq('status', (status as string).toUpperCase());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error) {
      console.error('Get gateway points error:', error);
      res.status(500).json({ detail: 'Failed to fetch gateway points' });
    }
  }
  // POST /api/gateway/points (create new point)
  else if (req.method === 'POST') {
    try {
      const {
        type,
        name,
        status,
        employee_name,
        employee_id,
        visual_identifier,
        number,
        accepts_ghostpass = true,
        linked_area_id
      } = req.body;

      // TODO: Get actual venue_id from user context
      const venueId = 'venue_001';

      // Check for duplicate name within same venue and type
      const { data: existing } = await supabase
        .from('gateway_points')
        .select('id')
        .eq('venue_id', venueId)
        .eq('name', name)
        .eq('type', type);

      if (existing && existing.length > 0) {
        return res.status(400).json({
          detail: `A ${type.toLowerCase().replace('_', ' ')} with name '${name}' already exists`
        });
      }

      // Build new point object
      const newPoint: any = {
        venue_id: venueId,
        name,
        status,
        type,
        employee_name,
        employee_id,
        accepts_ghostpass,
        created_by: user.id
      };

      if (number !== undefined && number !== null) {
        newPoint.number = number;
      }

      if (visual_identifier) {
        newPoint.visual_identifier = visual_identifier;
      }

      // Handle linked_area_id for TABLE_SEAT type
      if (type === 'TABLE_SEAT') {
        if (!linked_area_id) {
          return res.status(400).json({
            detail: 'linked_area_id is required for TABLE_SEAT type'
          });
        }

        // Verify the linked area exists and is an INTERNAL_AREA
        const { data: linkedArea } = await supabase
          .from('gateway_points')
          .select('id, type')
          .eq('id', linked_area_id)
          .single();

        if (!linkedArea) {
          return res.status(400).json({ detail: 'Linked area not found' });
        }

        if (linkedArea.type !== 'INTERNAL_AREA') {
          return res.status(400).json({
            detail: 'linked_area_id must reference an INTERNAL_AREA'
          });
        }

        newPoint.linked_area_id = linked_area_id;
      } else if (linked_area_id) {
        newPoint.linked_area_id = linked_area_id;
      }

      const { data, error } = await supabase
        .from('gateway_points')
        .insert(newPoint)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        action: 'CREATE_GATEWAY_POINT',
        resource_type: 'gateway_point',
        resource_id: data.id,
        old_value: null,
        new_value: data
      });

      res.status(201).json(data);
    } catch (error) {
      console.error('Create gateway point error:', error);
      res.status(500).json({ detail: 'Failed to create gateway point' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
