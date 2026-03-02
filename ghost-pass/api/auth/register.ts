import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase, adminSupabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, role, venue_id, name, station_type, event_ids } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // --- Create Auth User via admin client (pre-confirmed) ---
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || undefined,
        role: role || 'USER',
        venue_id: venue_id || null, // Pass these to trigger via metadata
      }
    });

    if (authError || !authData?.user) {
      console.error('Auth user creation failed:', authError);
      return res.status(400).json({ detail: authError?.message || 'Registration failed' });
    }

    const user = authData.user;

    // --- Upsert user into public.users (bypass RLS) ---
    // NOTE: handle_new_user() trigger already created the row, we update it.
    const { error: userError } = await adminSupabase.from('users').upsert({
      id: user.id,
      email: user.email,
      role: role || 'USER',
      venue_id: venue_id || null
    }, { onConflict: 'id' });

    if (userError) {
      console.error('Failed to update user record:', userError);
      // Clean up the auth user if the DB insert fails
      await adminSupabase.auth.admin.deleteUser(user.id);
      return res.status(500).json({ detail: 'Failed to create user record' });
    }

    // If it's a staff role or has venue/station mapping, create staff profile
    if (['DOOR', 'BAR', 'CONCESSION', 'MERCH', 'MANAGER', 'ADMIN', 'VENUE_ADMIN'].includes(role)) {
      const { error: staffError } = await adminSupabase.from('staff_profiles').upsert({
        id: user.id,
        name: name || null,
        venue_id: venue_id || null,
        event_ids: event_ids || [],
        role: role,
        station_type: station_type || null,
        is_active: true
      });

      if (staffError) {
        console.error('Failed to create staff profile:', staffError);
        return res.status(500).json({ detail: 'Failed to create staff profile' });
      }
    }

    // --- Audit log (non-fatal) ---
    try {
      await adminSupabase.from('audit_logs').insert({
        admin_user_id: user.id, // The new user
        action: 'STAFF_REGISTRATION',
        resource_type: 'user',
        resource_id: user.id,
        new_value: { role, venue_id, name }
      });
    } catch (e) {
      console.warn('Audit log failed:', e);
    }

    return res.status(201).json({
      status: 'success',
      detail: 'Registration successful.',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ detail: 'Registration failed' });
  }
};
