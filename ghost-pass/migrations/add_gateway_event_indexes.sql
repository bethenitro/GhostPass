-- Add indexes for improved query performance on gateway_id, venue_id, and event_id
-- These fields are now extracted from QR codes and used for filtering and analytics

-- Index on gateway_id for quick lookups by scanning station
CREATE INDEX IF NOT EXISTS idx_entry_events_gateway_id ON entry_events(gateway_id);

-- Index on event_id for event-specific analytics
CREATE INDEX IF NOT EXISTS idx_entry_events_event_id ON entry_events(event_id);

-- Composite index for venue + event queries
CREATE INDEX IF NOT EXISTS idx_entry_events_venue_event ON entry_events(venue_id, event_id);

-- Index on qr_nfc_assets for event lookups
CREATE INDEX IF NOT EXISTS idx_qr_nfc_assets_event_id ON qr_nfc_assets(event_id);

-- Index on qr_nfc_assets for venue lookups
CREATE INDEX IF NOT EXISTS idx_qr_nfc_assets_venue_id ON qr_nfc_assets(venue_id);

-- Composite index for venue + event on qr_nfc_assets
CREATE INDEX IF NOT EXISTS idx_qr_nfc_assets_venue_event ON qr_nfc_assets(venue_id, event_id);

-- Add comment explaining the gateway_id relationship
COMMENT ON COLUMN entry_events.gateway_id IS 'References qr_nfc_assets.asset_code - the scanning station/QR code used for entry';
