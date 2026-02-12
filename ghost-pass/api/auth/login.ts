import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const user = authData.user;
    const session = authData.session;

    // Ensure user exists in users table
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email
    }, { onConflict: 'id' });

    // Get user role and venue info
    const { data: userData } = await supabase
      .from('users')
      .select('role, venue_id, event_id')
      .eq('id', user.id)
      .single();

    const userRole = userData?.role || 'USER';

    res.status(200).json({
      access_token: session.access_token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        role: userRole,
        venue_id: userData?.venue_id,
        event_id: userData?.event_id,
        created_at: user.created_at
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Login failed' });
  }
};
