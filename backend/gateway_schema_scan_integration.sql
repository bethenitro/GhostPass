-- Gateway Scan Integration Schema Update
-- Add gateway tracking fields to transactions table for scan location recording

-- Add gateway tracking columns to transactions table
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS gateway_name TEXT,
  ADD COLUMN IF NOT EXISTS gateway_type gateway_type;

-- Create index for gateway queries
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_id ON transactions(gateway_id);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_type ON transactions(gateway_type);

-- Add comment for documentation
COMMENT ON COLUMN transactions.gateway_name IS 'Human-readable name of the gateway where scan occurred';
COMMENT ON COLUMN transactions.gateway_type IS 'Type of gateway: ENTRY_POINT, INTERNAL_AREA, or TABLE_SEAT';
