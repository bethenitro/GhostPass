import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase';

export const verifyToken = async (token: string) => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch (error) {
    return null;
  }
};

export const getCurrentUser = async (req: VercelRequest) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const user = await verifyToken(token);
  
  if (!user) return null;

  // Get user role from database
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    return {
      ...user,
      role: userData?.role || 'USER'
    };
  } catch (error) {
    return {
      ...user,
      role: 'USER'
    };
  }
};

export const requireAuth = async (req: VercelRequest, res: VercelResponse) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', detail: 'Authentication required' });
    return null;
  }
  return user;
};

export const requireAdmin = async (req: VercelRequest, res: VercelResponse) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', detail: 'Authentication required' });
    return null;
  }

  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden', detail: 'Admin access required' });
    return null;
  }

  return user;
};
