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
  return await verifyToken(token);
};

export const requireAuth = async (req: VercelRequest, res: VercelResponse) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
};
