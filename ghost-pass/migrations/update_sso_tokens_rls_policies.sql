-- Update SSO Tokens RLS Policies
-- This migration updates the RLS policies to allow authenticated admins to create and manage SSO tokens

-- Drop all existing policies
DROP POLICY IF EXISTS "System can manage SSO tokens" ON sso_tokens;
DROP POLICY IF EXISTS "Admins can create their own SSO tokens" ON sso_tokens;
DROP POLICY IF EXISTS "Admins can read their own SSO tokens" ON sso_tokens;
DROP POLICY IF EXISTS "Admins can update their own SSO tokens" ON sso_tokens;
DROP POLICY IF EXISTS "Public can read SSO tokens for validation" ON sso_tokens;
DROP POLICY IF EXISTS "Public can mark SSO tokens as used" ON sso_tokens;

-- Allow authenticated admins to create SSO tokens for themselves
CREATE POLICY "Admins can create their own SSO tokens"
  ON sso_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  );

-- Allow authenticated admins to read their own SSO tokens
CREATE POLICY "Admins can read their own SSO tokens"
  ON sso_tokens
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  );

-- Allow authenticated admins to update their own SSO tokens (for marking as used)
CREATE POLICY "Admins can update their own SSO tokens"
  ON sso_tokens
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  );

-- Allow public read access for SSO token validation (beVALID needs to read tokens)
CREATE POLICY "Public can read SSO tokens for validation"
  ON sso_tokens
  FOR SELECT
  TO anon
  USING (true);

-- Allow public update for marking tokens as used during SSO authentication
CREATE POLICY "Public can mark SSO tokens as used"
  ON sso_tokens
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (used = true);

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'sso_tokens'
ORDER BY policyname;
