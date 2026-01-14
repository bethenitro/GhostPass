-- Gateway Manager Schema Update for Internal Areas
-- Run this in Supabase SQL Editor to add support for Internal Areas

-- Add new columns to gateway_points table
ALTER TABLE gateway_points 
ADD COLUMN IF NOT EXISTS number INTEGER,
ADD COLUMN IF NOT EXISTS accepts_ghostpass BOOLEAN DEFAULT TRUE;

-- Add comment for documentation
COMMENT ON COLUMN gateway_points.number IS 'Optional area/table number (e.g., Bar 4, Table 12)';
COMMENT ON COLUMN gateway_points.accepts_ghostpass IS 'Whether this location accepts GhostPass payments';
