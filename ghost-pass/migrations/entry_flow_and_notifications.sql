-- Migration: Entry Flow and Push Notifications
-- Description: Adds tables for push subscriptions and notification logs
-- Note: wallet_sessions, entry_logs, entry_events already exist

-- ============================================================================
-- WALLET SESSIONS TABLE (Enhance existing)
-- Add missing columns to existing wallet_sessions table
-- ============================================================================
DO $$ 
BEGIN
  -- Add event_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_sessions' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE wallet_sessions ADD COLUMN event_name TEXT;
  END IF;

  -- Add venue_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_sessions' AND column_name = 'venue_name'
  ) THEN
    ALTER TABLE wallet_sessions ADD COLUMN venue_name TEXT;
  END IF;

  -- Add is_first_scan if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_sessions' AND column_name = 'is_first_scan'
  ) THEN
    ALTER TABLE wallet_sessions ADD COLUMN is_first_scan BOOLEAN DEFAULT false;
  END IF;

  -- Add boarding_pass_mode if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_sessions' AND column_name = 'boarding_pass_mode'
  ) THEN
    ALTER TABLE wallet_sessions ADD COLUMN boarding_pass_mode BOOLEAN DEFAULT true;
  END IF;

  -- Add updated_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE wallet_sessions ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Indexes for wallet_sessions (if not exist)
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_wallet_binding_id ON wallet_sessions(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_expires_at ON wallet_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_is_active ON wallet_sessions(is_active);

-- ============================================================================
-- WALLET SURFACE LOGS TABLE
-- Logs all wallet surfacing events for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_surface_logs (
  log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_binding_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  event_id TEXT,
  venue_id TEXT,
  is_first_scan BOOLEAN DEFAULT false,
  session_id TEXT, -- References wallet_sessions(id) but no FK constraint
  surfaced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for wallet_surface_logs
CREATE INDEX IF NOT EXISTS idx_wallet_surface_logs_wallet_binding_id ON wallet_surface_logs(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_wallet_surface_logs_surfaced_at ON wallet_surface_logs(surfaced_at);
CREATE INDEX IF NOT EXISTS idx_wallet_surface_logs_session_id ON wallet_surface_logs(session_id);

-- ============================================================================
-- PUSH SUBSCRIPTIONS TABLE
-- Stores Web Push API subscriptions for push notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  subscription_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_binding_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP
);

-- Indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_wallet_id ON push_subscriptions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_wallet_binding_id ON push_subscriptions(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- ============================================================================
-- NOTIFICATION LOGS TABLE
-- Logs all push notification attempts for debugging and analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subscription_id UUID REFERENCES push_subscriptions(subscription_id) ON DELETE SET NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_binding_id TEXT,
  notification_type TEXT NOT NULL, -- 'entry_confirmation', 'wallet_update', etc.
  payload JSONB NOT NULL,
  status TEXT NOT NULL, -- 'sent', 'failed', 'pending'
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_wallet_id ON notification_logs(wallet_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_wallet_binding_id ON notification_logs(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_subscription_id ON notification_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- ============================================================================
-- ENTRY LOGS TABLE (Enhance existing)
-- Add columns if they don't exist for entry tracking
-- ============================================================================
DO $$ 
BEGIN
  -- Add pass_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_logs' AND column_name = 'pass_id'
  ) THEN
    ALTER TABLE entry_logs ADD COLUMN pass_id TEXT;
  END IF;

  -- Add receipt_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_logs' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE entry_logs ADD COLUMN receipt_id UUID;
  END IF;

  -- Add wallet_binding_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_logs' AND column_name = 'wallet_binding_id'
  ) THEN
    ALTER TABLE entry_logs ADD COLUMN wallet_binding_id TEXT;
  END IF;
END $$;

-- Indexes for entry_logs
CREATE INDEX IF NOT EXISTS idx_entry_logs_receipt_id ON entry_logs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_wallet_binding_id ON entry_logs(wallet_binding_id);

-- ============================================================================
-- ENTRY EVENTS TABLE (Enhance existing)
-- Add columns if they don't exist
-- ============================================================================
DO $$ 
BEGIN
  -- Add receipt_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_events' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE entry_events ADD COLUMN receipt_id UUID;
  END IF;

  -- Add status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_events' AND column_name = 'status'
  ) THEN
    ALTER TABLE entry_events ADD COLUMN status TEXT DEFAULT 'APPROVED';
  END IF;

  -- Add pass_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_events' AND column_name = 'pass_id'
  ) THEN
    ALTER TABLE entry_events ADD COLUMN pass_id TEXT;
  END IF;
END $$;

-- Indexes for entry_events
CREATE INDEX IF NOT EXISTS idx_entry_events_receipt_id ON entry_events(receipt_id);
CREATE INDEX IF NOT EXISTS idx_entry_events_status ON entry_events(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE wallet_surface_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Wallet Surface Logs Policies
DROP POLICY IF EXISTS "Anyone can view surface logs" ON wallet_surface_logs;
CREATE POLICY "Anyone can view surface logs" ON wallet_surface_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service can create surface logs" ON wallet_surface_logs;
CREATE POLICY "Service can create surface logs" ON wallet_surface_logs
  FOR INSERT WITH CHECK (true);

-- Push Subscriptions Policies
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions" ON push_subscriptions
  FOR SELECT USING (
    wallet_id IN (SELECT id FROM wallets WHERE id = wallet_id)
  );

DROP POLICY IF EXISTS "Users can create their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can create their own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (
    wallet_id IN (SELECT id FROM wallets WHERE id = wallet_id)
  );

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (
    wallet_id IN (SELECT id FROM wallets WHERE id = wallet_id)
  );

-- Notification Logs Policies
DROP POLICY IF EXISTS "Users can view their own notification logs" ON notification_logs;
CREATE POLICY "Users can view their own notification logs" ON notification_logs
  FOR SELECT USING (
    wallet_id IN (SELECT id FROM wallets WHERE id = wallet_id)
  );

DROP POLICY IF EXISTS "Service can create notification logs" ON notification_logs;
CREATE POLICY "Service can create notification logs" ON notification_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS cleanup_expired_wallet_sessions();
DROP FUNCTION IF EXISTS deactivate_invalid_subscriptions();

-- Function to clean up expired wallet sessions
CREATE OR REPLACE FUNCTION cleanup_expired_wallet_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM wallet_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to deactivate invalid push subscriptions
CREATE OR REPLACE FUNCTION deactivate_invalid_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE push_subscriptions
  SET is_active = false
  WHERE subscription_id IN (
    SELECT DISTINCT subscription_id
    FROM notification_logs
    WHERE status = 'failed'
      AND error_message LIKE '%410%'
      AND sent_at > NOW() - INTERVAL '7 days'
  );
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE wallet_sessions IS 'Stores persistent wallet sessions for fast entry flow and boarding pass mode';
COMMENT ON TABLE wallet_surface_logs IS 'Logs all wallet surfacing events for analytics and debugging';
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push API subscriptions for push notifications';
COMMENT ON TABLE notification_logs IS 'Logs all push notification attempts with status and errors';

COMMENT ON COLUMN wallet_sessions.boarding_pass_mode IS 'Indicates if wallet is in boarding pass mode (forced surfacing)';
COMMENT ON COLUMN wallet_sessions.is_first_scan IS 'True if this was the first scan that created the session';
COMMENT ON COLUMN push_subscriptions.is_active IS 'False if subscription is invalid or user unsubscribed';
COMMENT ON COLUMN notification_logs.status IS 'Status of notification: sent, failed, or pending';

-- ============================================================================
-- GRANTS (Conditional)
-- ============================================================================

DO $$ 
BEGIN
  -- Grant access to authenticated users (if role exists)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON wallet_sessions TO authenticated;
    GRANT SELECT, INSERT ON wallet_surface_logs TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON push_subscriptions TO authenticated;
    GRANT SELECT ON notification_logs TO authenticated;
  END IF;

  -- Grant full access to service role (if exists)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON wallet_sessions TO service_role;
    GRANT ALL ON wallet_surface_logs TO service_role;
    GRANT ALL ON push_subscriptions TO service_role;
    GRANT ALL ON notification_logs TO service_role;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully: Entry Flow and Push Notifications';
  RAISE NOTICE 'New tables created: wallet_surface_logs, push_subscriptions, notification_logs';
  RAISE NOTICE 'Enhanced tables: wallet_sessions, entry_logs, entry_events';
  RAISE NOTICE 'Functions created: cleanup_expired_wallet_sessions(), deactivate_invalid_subscriptions()';
END $$;
