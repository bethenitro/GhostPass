-- Add fp_id column to wallets table for anonymous wallet verification
-- This allows anonymous wallets to store Footprint verification status

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS fp_id TEXT;

COMMENT ON COLUMN wallets.fp_id IS 'Footprint ID from identity verification - stored at wallet level for anonymous users';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_fp_id ON wallets(fp_id);
