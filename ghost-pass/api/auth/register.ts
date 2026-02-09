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

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError || !authData.user) {
      return res.status(400).json({ detail: 'Registration failed' });
    }

    const user = authData.user;
    const session = authData.session;

    // Create user record
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email
    }, { onConflict: 'id' });

    if (!session) {
      return res.status(201).json({ detail: 'Registration successful. Please check your email for confirmation.' });
    }

    res.status(200).json({
      access_token: session.access_token,
      token_type: 'bearer',
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
