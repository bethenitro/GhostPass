-- Add Footprint ID column to users table for Tier-3 verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS fp_id TEXT UNIQUE;
COMMENT ON COLUMN users.fp_id IS 'Footprint ID from Footprint identity verification service';

-- Update verification tier check constraints to include tier 3
ALTER TABLE stations DROP CONSTRAINT IF EXISTS stations_id_verification_level_check;
ALTER TABLE stations ADD CONSTRAINT stations_id_verification_level_check CHECK (id_verification_level IN (1, 2, 3));

ALTER TABLE qr_nfc_assets DROP CONSTRAINT IF EXISTS qr_nfc_assets_id_verification_level_check;
ALTER TABLE qr_nfc_assets ADD CONSTRAINT qr_nfc_assets_id_verification_level_check CHECK (id_verification_level IN (1, 2, 3));

-- Update entry_tracking verification_tier constraint
ALTER TABLE entry_tracking DROP CONSTRAINT IF EXISTS entry_tracking_verification_tier_check;
ALTER TABLE entry_tracking ADD CONSTRAINT entry_tracking_verification_tier_check CHECK (verification_tier IN (1, 2, 3));

-- Update id_verification_logs verification_tier constraint
ALTER TABLE id_verification_logs DROP CONSTRAINT IF EXISTS id_verification_logs_verification_tier_check;
ALTER TABLE id_verification_logs ADD CONSTRAINT id_verification_logs_verification_tier_check CHECK (verification_tier IN (1, 2, 3));

-- Add footprint_verified column to id_verification_logs
ALTER TABLE id_verification_logs ADD COLUMN IF NOT EXISTS footprint_verified BOOLEAN DEFAULT false;
ALTER TABLE id_verification_logs ADD COLUMN IF NOT EXISTS footprint_onboarding_id TEXT;
COMMENT ON COLUMN id_verification_logs.footprint_verified IS 'Whether user completed Footprint ID verification';
COMMENT ON COLUMN id_verification_logs.footprint_onboarding_id IS 'Footprint onboarding ID for audit trail';
