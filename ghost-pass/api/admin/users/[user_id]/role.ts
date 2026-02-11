import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../../_lib/cors.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { supabase } from '../../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin authentication
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  try {
    const { user_id } = req.query;
    const { role } = req.body;

    if (!user_id) {
      return res.status(400).json({ detail: 'user_id is required' });
    }

    if (!role || !['USER', 'VENDOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ detail: 'Invalid role. Must be USER, VENDOR, or ADMIN' });
    }

    // Get current user data
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (fetchError || !currentUser) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const oldValue = currentUser;

    // Update user role
    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', user_id);

    if (updateError) throw updateError;

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'UPDATE_USER_ROLE',
      resource_type: 'user',
      resource_id: user_id as string,
      old_value: oldValue,
      new_value: { ...oldValue, role }
    });

    res.status(200).json({
      status: 'success',
      message: `User role updated to ${role}`
    });
  } catch (error: any) {
    console.error('Update user role error:', error);
    res.status(500).json({ detail: 'Failed to update user role' });
  }
};
