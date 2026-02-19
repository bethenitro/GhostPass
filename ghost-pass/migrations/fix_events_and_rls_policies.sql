-- ============================================================================
-- FIX EVENTS TABLE AND RLS POLICIES
-- Ensures all required columns exist and RLS policies are properly configured
-- ============================================================================

-- Add missing columns to events table if they don't exist
DO $$ 
BEGIN
  -- Check and add entry_fee_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'entry_fee_cents'
  ) THEN
    ALTER TABLE events ADD COLUMN entry_fee_cents INTEGER DEFAULT 500;
  END IF;

  -- Check and add re_entry_fee_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 're_entry_fee_cents'
  ) THEN
    ALTER TABLE events ADD COLUMN re_entry_fee_cents INTEGER DEFAULT 200;
  END IF;

  -- Check and add ticket_price_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'ticket_price_cents'
  ) THEN
    ALTER TABLE events ADD COLUMN ticket_price_cents INTEGER DEFAULT 0;
  END IF;

  -- Check and add platform_fee_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'platform_fee_cents'
  ) THEN
    ALTER TABLE events ADD COLUMN platform_fee_cents INTEGER DEFAULT 25;
  END IF;
END $$;

-- Fix RLS policies for entry_point_audit_logs
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Allow admins full access to audit logs" ON entry_point_audit_logs;

-- Create permissive policies
CREATE POLICY "Allow authenticated users to insert audit logs"
  ON entry_point_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read audit logs"
  ON entry_point_audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins full access to audit logs"
  ON entry_point_audit_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  );

-- Fix RLS policies for stations table
DROP POLICY IF EXISTS "Allow authenticated users to manage stations" ON stations;

CREATE POLICY "Allow authenticated users to manage stations"
  ON stations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure revenue_profile_id and tax_profile_id can be NULL in stations
ALTER TABLE stations ALTER COLUMN revenue_profile_id DROP NOT NULL;
ALTER TABLE stations ALTER COLUMN tax_profile_id DROP NOT NULL;

COMMENT ON COLUMN events.entry_fee_cents IS 'Initial entry fee in cents';
COMMENT ON COLUMN events.re_entry_fee_cents IS 'Re-entry fee in cents';
COMMENT ON COLUMN events.ticket_price_cents IS 'Ticket price in cents';
COMMENT ON COLUMN events.platform_fee_cents IS 'Platform fee in cents';
