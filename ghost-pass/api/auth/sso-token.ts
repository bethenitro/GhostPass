import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  // Only allow ADMIN and VENUE_ADMIN roles
  if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden', detail: 'Admin access required' });
  }

  if (req.method === 'POST') {
    try {
      const { device_fingerprint } = req.body;

      if (!device_fingerprint) {
        return res.status(400).json({ error: 'device_fingerprint is required' });
      }

      // Get the user's JWT token from the Authorization header
      const authHeader = req.headers.authorization;
      const userToken = authHeader?.substring(7); // Remove 'Bearer ' prefix

      if (!userToken) {
        return res.status(401).json({ error: 'Missing authentication token' });
      }

      // Create an authenticated Supabase client with the user's JWT token
      const authenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        }
      });

      // Generate a secure SSO token
      // Format: userId:deviceFingerprint:timestamp:randomBytes
      const timestamp = Date.now();
      const randomBytes = crypto.randomBytes(32).toString('hex');
      
      // Create a hash of the combination for security
      const tokenData = `${user.id}:${device_fingerprint}:${timestamp}:${randomBytes}`;
      const tokenHash = crypto.createHash('sha256').update(tokenData).digest('hex');
      
      // Create the SSO token (base64 encoded for URL safety)
      const ssoToken = Buffer.from(`${user.id}:${device_fingerprint}:${timestamp}:${tokenHash}`).toString('base64url');

      // Store the SSO token in database with expiration (5 minutes)
      const expiresAt = new Date(timestamp + 5 * 60 * 1000); // 5 minutes from now

      const { data: tokenRecord, error: insertError } = await authenticatedSupabase
        .from('sso_tokens')
        .insert({
          token: ssoToken,
          user_id: user.id,
          device_fingerprint: device_fingerprint,
          expires_at: expiresAt.toISOString(),
          used: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log the SSO token generation (using authenticated client)
      await authenticatedSupabase.from('audit_logs').insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: 'SSO_TOKEN_GENERATED',
        resource_type: 'sso_token',
        resource_id: tokenRecord.id,
        metadata: {
          device_fingerprint: device_fingerprint.substring(0, 8) + '...',
          expires_at: expiresAt.toISOString()
        }
      });

      res.status(200).json({
        sso_token: ssoToken,
        expires_at: expiresAt.toISOString(),
        bevalid_url: `https://www.bevalid.app/sso/${ssoToken}`
      });
    } catch (error: any) {
      console.error('Error generating SSO token:', error);
      res.status(500).json({ 
        error: 'Failed to generate SSO token',
        detail: error.message 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
