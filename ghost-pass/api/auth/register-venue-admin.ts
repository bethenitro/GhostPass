import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method === 'POST') {
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

      // Validate required fields
      if (!email || !password || !venue_id || !venue_name || !contact_name) {
        return res.status(400).json({
          error: 'Missing required fields',
          detail: 'email, password, venue_id, venue_name, and contact_name are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format'
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long'
        });
      }

      // Check if user with this email already exists in users table
      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({
          error: 'Email already registered',
          detail: 'An account with this email already exists. Please sign in instead.'
        });
      }

      // Check if venue admin already exists for this venue
      const { data: existingVenueAdmin, error: checkError } = await supabase
        .from('users')
        .select('id, email')
        .eq('venue_id', venue_id)
        .eq('role', 'VENUE_ADMIN');

      if (checkError) {
        console.error('Error checking existing venue admin:', checkError);
      }

      // If venue admin exists, return info (but don't block - multiple admins per venue is ok)
      if (existingVenueAdmin && existingVenueAdmin.length > 0) {
        console.log(`Note: Venue ${venue_id} already has ${existingVenueAdmin.length} admin(s)`);
      }

      // Create auth user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'VENUE_ADMIN',
            venue_id,
            event_id,
            venue_name,
            contact_name,
            contact_phone
          }
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        return res.status(400).json({
          error: 'Failed to create account',
          detail: authError.message
        });
      }

      if (!authData.user) {
        return res.status(400).json({
          error: 'Failed to create account',
          detail: 'No user returned from signup'
        });
      }

      // Create or update user record in users table with VENUE_ADMIN role
      // Use upsert to handle case where user already exists
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: email,
          role: 'VENUE_ADMIN',
          venue_id: venue_id,
          event_id: event_id || null,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (userError) {
        console.error('User table upsert error:', userError);
        // Try to clean up auth user if user table upsert fails
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
        return res.status(500).json({
          error: 'Failed to create user record',
          detail: userError.message
        });
      }

      // Create initial venue configuration if it doesn't exist
      const { data: existingConfig } = await supabase
        .from('venue_entry_configs')
        .select('id')
        .eq('venue_id', venue_id)
        .eq('event_id', event_id || null)
        .single();

      if (!existingConfig) {
        await supabase.from('venue_entry_configs').insert({
          venue_id: venue_id,
          event_id: event_id || null,
          re_entry_allowed: true,
          initial_entry_fee_cents: 0,
          venue_reentry_fee_cents: 0,
          valid_reentry_scan_fee_cents: 0,
          created_by: authData.user.id
        });
      }

      // Log the registration
      await supabase.from('audit_logs').insert({
        admin_user_id: authData.user.id,
        admin_email: email,
        action: 'VENUE_ADMIN_REGISTRATION',
        resource_type: 'user',
        resource_id: authData.user.id,
        new_value: {
          venue_id,
          event_id,
          venue_name,
          contact_name
        }
      });

      // Return success with session
      res.status(201).json({
        status: 'success',
        message: 'Venue admin account created successfully',
        user: {
          id: authData.user.id,
          email: email,
          role: 'VENUE_ADMIN',
          venue_id: venue_id,
          event_id: event_id
        },
        session: authData.session,
        access_token: authData.session?.access_token
      });
    } catch (error: any) {
      console.error('Venue admin registration error:', error);
      res.status(500).json({
        error: 'Failed to register venue admin',
        detail: error.message
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
