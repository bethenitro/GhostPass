-- Performance Indexes for Entry Scan Endpoint
-- These indexes optimize the most frequently queried columns
-- Note: Most indexes already exist, only adding missing composite indexes

-- Composite index for wallet lookup by binding_id AND device_fingerprint
-- This is the most critical optimization for the entry scan endpoint
CREATE INDEX IF NOT EXISTS idx_wallets_binding_fingerprint 
ON wallets(wallet_binding_id, device_fingerprint);

-- Composite index for entry count queries (wallet + venue)
-- Optimizes the COUNT query in entry/scan endpoint
CREATE INDEX IF NOT EXISTS idx_entry_events_wallet_venue 
ON entry_events(wallet_binding_id, venue_id);

-- Composite index for transactions venue lookup
CREATE INDEX IF NOT EXISTS idx_transactions_venue_id 
ON transactions(venue_id);

-- Add comments
COMMENT ON INDEX idx_wallets_binding_fingerprint IS 'Optimizes wallet lookup by binding_id and fingerprint in entry/scan endpoint';
COMMENT ON INDEX idx_entry_events_wallet_venue IS 'Optimizes entry count queries for re-entry detection';
COMMENT ON INDEX idx_transactions_venue_id IS 'Optimizes transaction queries by venue';
