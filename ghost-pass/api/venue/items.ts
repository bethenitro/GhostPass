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

  const targetVenueId = user.role === 'VENUE_ADMIN' ? (user as any).venue_id : req.query.venue_id;

  if (!targetVenueId) {
    return res.status(400).json({ error: 'venue_id is required' });
  }

  if (req.method === 'GET') {
    try {
      const { event_id } = req.query;

      let query = supabase
        .from('vendor_items')
        .select('*')
        .eq('venue_id', targetVenueId);

      if (event_id) {
        query = query.eq('event_id', event_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Error fetching vendor items:', error);
      res.status(500).json({ 
        error: 'Failed to fetch vendor items',
        detail: error.message 
      });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, price_cents, category, description, available, event_id } = req.body;

      if (!name || price_cents === undefined || !category) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          detail: 'name, price_cents, and category are required' 
        });
      }

      const itemData = {
        venue_id: targetVenueId,
        event_id: event_id || null,
        name,
        price_cents,
        category,
        description: description || null,
        available: available !== undefined ? available : true,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('vendor_items')
        .insert(itemData)
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: 'CREATE_VENDOR_ITEM',
        resource_type: 'vendor_item',
        resource_id: data.id,
        new_value: itemData
      });

      res.status(201).json(data);
    } catch (error: any) {
      console.error('Error creating vendor item:', error);
      res.status(500).json({ 
        error: 'Failed to create vendor item',
        detail: error.message 
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, name, price_cents, category, description, available } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      // Get existing item
      const { data: existingItem, error: fetchError } = await supabase
        .from('vendor_items')
        .select('*')
        .eq('id', id)
        .eq('venue_id', targetVenueId)
        .single();

      if (fetchError || !existingItem) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (price_cents !== undefined) updateData.price_cents = price_cents;
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (available !== undefined) updateData.available = available;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('vendor_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: 'UPDATE_VENDOR_ITEM',
        resource_type: 'vendor_item',
        resource_id: id,
        old_value: existingItem,
        new_value: data
      });

      res.status(200).json(data);
    } catch (error: any) {
      console.error('Error updating vendor item:', error);
      res.status(500).json({ 
        error: 'Failed to update vendor item',
        detail: error.message 
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      // Get existing item for audit log
      const { data: existingItem } = await supabase
        .from('vendor_items')
        .select('*')
        .eq('id', id as string)
        .eq('venue_id', targetVenueId)
        .single();

      if (!existingItem) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const { error } = await supabase
        .from('vendor_items')
        .delete()
        .eq('id', id as string);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: 'DELETE_VENDOR_ITEM',
        resource_type: 'vendor_item',
        resource_id: id as string,
        old_value: existingItem
      });

      res.status(200).json({ status: 'success', message: 'Item deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting vendor item:', error);
      res.status(500).json({ 
        error: 'Failed to delete vendor item',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
