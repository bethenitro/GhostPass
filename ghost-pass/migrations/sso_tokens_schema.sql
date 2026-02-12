-- SSO Tokens Table
-- Stores single sign-on tokens for secure cross-app authentication

CREATE TABLE IF NOT EXISTS sso_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sso_tokens_token ON sso_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sso_tokens_user ON sso_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_tokens_expires ON sso_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_sso_tokens_used ON sso_tokens(used);

-- RLS Policies
ALTER TABLE sso_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow the system to manage SSO tokens (no direct user access)
CREATE POLICY "System can manage SSO tokens"
  ON sso_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sso_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM sso_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE sso_tokens IS 'Single sign-on tokens for secure cross-app authentication';
COMMENT ON COLUMN sso_tokens.token IS 'Base64url encoded SSO token';
COMMENT ON COLUMN sso_tokens.device_fingerprint IS 'Device fingerprint for additional security';
COMMENT ON COLUMN sso_tokens.expires_at IS 'Token expiration time (5 minutes from creation)';
COMMENT ON COLUMN sso_tokens.used IS 'Whether the token has been used';
COMMENT ON COLUMN sso_tokens.used_at IS 'When the token was used';
