-- ============================================================================
-- FIX EVENTS TABLE FOREIGN KEY CONSTRAINTS
-- Adds proper foreign key relationships for revenue_profile_id, tax_profile_id, and payout_routing_id
-- ============================================================================

-- Add foreign key constraints to events table
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_revenue_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS events_tax_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS events_payout_routing_id_fkey;

ALTER TABLE events
  ADD CONSTRAINT events_revenue_profile_id_fkey 
    FOREIGN KEY (revenue_profile_id) 
    REFERENCES revenue_profiles(id) 
    ON DELETE SET NULL,
  ADD CONSTRAINT events_tax_profile_id_fkey 
    FOREIGN KEY (tax_profile_id) 
    REFERENCES tax_profiles(id) 
    ON DELETE SET NULL,
  ADD CONSTRAINT events_payout_routing_id_fkey 
    FOREIGN KEY (payout_routing_id) 
    REFERENCES payout_routing(id) 
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT events_revenue_profile_id_fkey ON events IS 'Links events to revenue split profiles';
COMMENT ON CONSTRAINT events_tax_profile_id_fkey ON events IS 'Links events to tax calculation profiles';
COMMENT ON CONSTRAINT events_payout_routing_id_fkey ON events IS 'Links events to payout routing configurations';
