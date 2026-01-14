-- Gateway Manager Schema Update for Tables & Seats
-- Run this in Supabase SQL Editor to add linked_area_id support

-- First, drop the existing constraint if it exists
ALTER TABLE gateway_points
DROP CONSTRAINT IF EXISTS gateway_points_linked_area_id_fkey;

-- Add linked_area_id column to gateway_points table with CASCADE delete
-- When an internal area is deleted, all tables/seats linked to it will also be deleted
ALTER TABLE gateway_points
ADD COLUMN IF NOT EXISTS linked_area_id UUID;

-- Add foreign key constraint with CASCADE delete
ALTER TABLE gateway_points
ADD CONSTRAINT gateway_points_linked_area_id_fkey 
FOREIGN KEY (linked_area_id) 
REFERENCES gateway_points(id) 
ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_gateway_points_linked_area ON gateway_points(linked_area_id);

-- Add constraint to ensure TABLE_SEAT types have a linked_area_id
-- This is a soft constraint - we'll enforce it in the application layer
-- because we want to allow flexibility for future use cases

-- Add check constraint to ensure linked_area_id only references INTERNAL_AREA types
-- This will be enforced in the application layer for better error messages

COMMENT ON COLUMN gateway_points.linked_area_id IS 'For TABLE_SEAT type: references the INTERNAL_AREA this table/seat belongs to';
