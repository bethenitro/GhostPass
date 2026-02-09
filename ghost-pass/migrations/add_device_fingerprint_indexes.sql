-- Add indexes for device_fingerprint lookups (performance optimization)
-- These indexes are needed for fast anonymous wallet lookups

-- Index on wallets.device_fingerprint for fast wallet lookups
CREATE INDEX IF NOT EXISTS idx_wallets_device_fingerprint 
ON wallets(device_fingerprint);

-- Index on wallet_sessions.device_fingerprint for fast session lookups
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_device_fingerprint 
ON wallet_sessions(device_fingerprint);

-- Index on wallet_sessions.wallet_binding_id for fast session lookups
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_wallet_binding_id 
ON wallet_sessions(wallet_binding_id);

-- Index on wallets.wallet_binding_id for fast wallet lookups
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_binding_id 
ON wallets(wallet_binding_id);

-- Ensure user_id is nullable in wallets table (for anonymous wallets)
-- This should already be the case, but adding for safety
ALTER TABLE wallets ALTER COLUMN user_id DROP NOT NULL;

-- Add recovery_code_hash column for wallet recovery
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT;

-- Add comment to document anonymous wallet support
COMMENT ON COLUMN wallets.device_fingerprint IS 'Device fingerprint for anonymous wallet identification';
COMMENT ON COLUMN wallets.wallet_binding_id IS 'Human-readable wallet identifier';
COMMENT ON COLUMN wallets.user_id IS 'Optional user ID - null for anonymous wallets';
COMMENT ON COLUMN wallets.recovery_code_hash IS 'SHA256 hash of recovery code for cross-device wallet access';
