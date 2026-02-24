-- Add verification_tier column to entry_events table
-- This column tracks the ID verification level used during entry

ALTER TABLE entry_events 
ADD COLUMN IF NOT EXISTS verification_tier INTEGER DEFAULT 1 CHECK (verification_tier IN (1, 2, 3));

COMMENT ON COLUMN entry_events.verification_tier IS 'ID verification tier: 1=Manual Log, 2=Footprint Real ID, 3=Footprint Deep Check';

-- Create index for faster queries by verification tier
CREATE INDEX IF NOT EXISTS idx_entry_events_verification_tier ON entry_events(verification_tier);
