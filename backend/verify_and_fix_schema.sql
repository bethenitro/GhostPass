-- Verify if linked_area_id column exists
-- Run this in Supabase SQL Editor to check the table structure

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'gateway_points'
ORDER BY ordinal_position;

-- If linked_area_id is NOT in the list above, run this to add it:
ALTER TABLE gateway_points
ADD COLUMN linked_area_id UUID;

-- Then add the foreign key constraint:
ALTER TABLE gateway_points
DROP CONSTRAINT IF EXISTS gateway_points_linked_area_id_fkey;

ALTER TABLE gateway_points
ADD CONSTRAINT gateway_points_linked_area_id_fkey 
FOREIGN KEY (linked_area_id) 
REFERENCES gateway_points(id) 
ON DELETE CASCADE;

-- Add index:
CREATE INDEX IF NOT EXISTS idx_gateway_points_linked_area ON gateway_points(linked_area_id);

-- Verify the constraint was created:
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
