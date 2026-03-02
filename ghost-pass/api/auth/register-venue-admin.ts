import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { adminSupabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      email,
      password,
      venue_id,
      event_id,
      venue_name,
      contact_name,
      contact_phone
    } = req.body;

    // --- Validation ---
    if (!email || !password || !venue_id || !venue_name || !contact_name) {
      return res.status(400).json({
        error: 'Missing required fields',
        detail: 'email, password, venue_id, venue_name, and contact_name are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // --- Check if email already registered in users table (use adminSupabase to bypass RLS) ---
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        error: 'Email already registered',
        detail: 'An account with this email already exists. Please sign in instead.'
      });
    }

    // Log how many admins already exist for this venue (informational only)
    const { data: existingVenueAdmins } = await adminSupabase
      .from('users')
      .select('id')
      .eq('venue_id', venue_id)
      .eq('role', 'VENUE_ADMIN');

    if (existingVenueAdmins && existingVenueAdmins.length > 0) {
      console.log(`Note: Venue ${venue_id} already has ${existingVenueAdmins.length} admin(s). Adding another.`);
    }

    // --- Create Supabase Auth user using Admin API (bypasses email confirmation) ---
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: {
        role: 'VENUE_ADMIN',
        venue_id,
        event_id: event_id || null,
        venue_name,
        contact_name,
        contact_phone: contact_phone || null
      }
    });

    if (authError || !authData.user) {
      console.error('Auth admin.createUser error:', authError);
      return res.status(400).json({
        error: 'Failed to create account',
        detail: authError?.message || 'No user returned from signup'
      });
    }

    const userId = authData.user.id;

    // --- Upsert user into public.users table using adminSupabase (bypasses RLS) ---
    // NOTE: The handle_new_user() trigger already inserts a row when the auth user is created.
    // We upsert here to ensure the correct role, venue_id, and event_id are set.
    const { error: userError } = await adminSupabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        role: 'VENUE_ADMIN',
        venue_id: venue_id,
        event_id: event_id || null,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (userError) {
      console.error('User table insert error:', userError);
      // Rollback: delete the auth user we just created
      await adminSupabase.auth.admin.deleteUser(userId).catch(e =>
        console.error('Failed to rollback auth user:', e)
      );
      return res.status(500).json({
        error: 'Failed to create user record',
        detail: userError.message
      });
    }

    // --- Create initial venue entry config if none exists ---
    const { data: existingConfig } = await adminSupabase
      .from('venue_entry_configs')
      .select('id')
      .eq('venue_id', venue_id)
      .maybeSingle();

    if (!existingConfig) {
      const { error: configError } = await adminSupabase.from('venue_entry_configs').insert({
        venue_id: venue_id,
        event_id: event_id || null,
        re_entry_allowed: true,
        initial_entry_fee_cents: 0,
        venue_reentry_fee_cents: 0,
        valid_reentry_scan_fee_cents: 0,
        created_by: userId
      });
      if (configError) {
        // Non-fatal: log but don't fail registration
        console.warn('Could not create venue entry config:', configError.message);
      }
    }

    // --- Audit log (non-fatal) ---
    try {
      await adminSupabase.from('audit_logs').insert({
        admin_user_id: userId,
        action: 'VENUE_ADMIN_REGISTRATION',
        resource_type: 'user',
        resource_id: userId,
        new_value: {
          venue_id,
          event_id: event_id || null,
          venue_name,
          contact_name,
        }
      });
    } catch (auditErr) {
      console.warn('Audit log failed (non-fatal):', auditErr);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Venue admin account created successfully. You can now sign in.',
      user: {
        id: userId,
        email: email,
        role: 'VENUE_ADMIN',
        venue_id: venue_id,
        event_id: event_id || null
      }
    });

  } catch (error: any) {
    console.error('Venue admin registration error:', error);
    return res.status(500).json({
      error: 'Failed to register venue admin',
      detail: error.message
    });
  }
};
