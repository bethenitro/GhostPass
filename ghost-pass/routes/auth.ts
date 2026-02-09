import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../database.ts';
import { getCurrentUser } from '../auth.ts';
import type { UserRole } from '../types.ts';

const router = express.Router();

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    role?: UserRole;
    created_at?: string;
  };
}

interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

router.post('/login', async (req: Request, res: Response) => {
  const { email, password }: LoginRequest = req.body;

  try {
    const db = getDb();
    const authResponse = await db.auth.signInWithPassword({
      email,
      password
    });

    if (!authResponse.data.user || !authResponse.data.session) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const user = authResponse.data.user;
    const session = authResponse.data.session;

    // Ensure user exists
    await db.from('users').upsert({
      id: user.id,
      email: user.email
    }, { onConflict: 'id' });

    // Get role
    const userRecord = await db.from('users').select('role').eq('id', user.id).single();
    const userRole = userRecord.data?.role || 'USER';

    const response: AuthResponse = {
      access_token: session.access_token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        role: userRole,
        created_at: user.created_at
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Login error:', error);
    if (error.message?.includes('Invalid login credentials')) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }
    res.status(500).json({ detail: 'Login failed' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  const { email, password }: RegisterRequest = req.body;

  try {
    const db = getDb();
    const authResponse = await db.auth.signUp({
      email,
      password
    });

    if (!authResponse.data.user) {
      return res.status(400).json({ detail: 'Registration failed' });
    }

    const user = authResponse.data.user;
    const session = authResponse.data.session;

    // Create user record
    await db.from('users').upsert({
      id: user.id,
      email: user.email
    }, { onConflict: 'id' });

    if (!session) {
      return res.status(201).json({ detail: 'Registration successful. Please check your email for confirmation.' });
    }

    const response: AuthResponse = {
      access_token: session.access_token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Registration error:', error);
    const errorMsg = error.message?.toLowerCase() || '';
    if (errorMsg.includes('email address') && errorMsg.includes('invalid')) {
      return res.status(400).json({ detail: 'Invalid email address format' });
    } else if (errorMsg.includes('already registered')) {
      return res.status(409).json({ detail: 'An account with this email already exists' });
    } else if (errorMsg.includes('password')) {
      return res.status(400).json({ detail: 'Password does not meet requirements' });
    }
    res.status(500).json({ detail: 'Registration failed' });
  }
});

router.post('/logout', getCurrentUser, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.auth.signOut();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ detail: 'Logout failed' });
  }
});

router.get('/me', getCurrentUser, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json(user);
});

router.post('/refresh', getCurrentUser, (req: Request, res: Response) => {
  // Simple refresh - in real implementation, generate new token
  res.json({ message: 'Token refreshed' });
});

export default router;