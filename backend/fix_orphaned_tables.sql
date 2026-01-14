-- Fix for orphaned tables issue
-- This script will:
-- 1. Delete any existing orphaned tables (tables with null linked_area_id)
-- 2. Update the foreign key constraint to CASCADE delete

-- Step 1: Clean up existing orphaned tables
DELETE FROM gateway_points 
WHERE type = 'TABLE_SEAT' 
AND linked_area_id IS NULL;

-- Step 2: Drop the existing foreign key constraint
ALTER TABLE gateway_points
DROP CONSTRAINT IF EXISTS gateway_points_linked_area_id_fkey;

-- Step 3: Recreate the constraint with CASCADE delete
ALTER TABLE gateway_points
ADD CONSTRAINT gateway_points_linked_area_id_fkey 
FOREIGN KEY (linked_area_id) 
REFERENCES gateway_points(id) 
ON DELETE CASCADE;

-- Verify the constraint
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'gateway_points' 
    AND kcu.column_name = 'linked_area_id';
