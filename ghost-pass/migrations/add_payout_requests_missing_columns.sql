-- Add missing columns to payout_requests table
-- This migration adds vendor_user_id, requested_at, and notes columns

-- Add vendor_user_id column (UUID reference to users table)
ALTER TABLE payout_requests 
ADD COLUMN IF NOT EXISTS vendor_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add requested_at column
ALTER TABLE payout_requests 
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add notes column
ALTER TABLE payout_requests 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for vendor_user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor_user_id ON payout_requests(vendor_user_id);

-- Update existing records to populate vendor_user_id from vendor_id if it's a valid UUID
UPDATE payout_requests 
SET vendor_user_id = vendor_id::uuid
WHERE vendor_user_id IS NULL 
  AND vendor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Set requested_at to created_at for existing records
UPDATE payout_requests 
SET requested_at = created_at
WHERE requested_at IS NULL;

-- Add comment to clarify the columns
COMMENT ON COLUMN payout_requests.vendor_user_id IS 'UUID of the vendor user requesting payout';
COMMENT ON COLUMN payout_requests.requested_at IS 'Timestamp when payout was requested';
COMMENT ON COLUMN payout_requests.notes IS 'Additional notes about the payout request';
