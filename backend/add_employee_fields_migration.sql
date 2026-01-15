-- Migration to add employee fields to gateway_points table
-- Run this in Supabase SQL Editor to add new required fields

-- Add new columns to gateway_points table
ALTER TABLE gateway_points 
ADD COLUMN IF NOT EXISTS employee_name TEXT,
ADD COLUMN IF NOT EXISTS employee_id TEXT,
ADD COLUMN IF NOT EXISTS visual_identifier TEXT;

-- For existing records, set default values (update these as needed)
UPDATE gateway_points 
SET 
    employee_name = COALESCE(employee_name, 'Unassigned'),
    employee_id = COALESCE(employee_id, 'UNASSIGNED')
WHERE employee_name IS NULL OR employee_id IS NULL;

-- Now make the columns NOT NULL
ALTER TABLE gateway_points 
ALTER COLUMN employee_name SET NOT NULL,
ALTER COLUMN employee_id SET NOT NULL;

-- Add index for employee lookups
CREATE INDEX IF NOT EXISTS idx_gateway_points_employee_id ON gateway_points(employee_id);

-- Add comment to document the fields
COMMENT ON COLUMN gateway_points.employee_name IS 'Name of employee operating this entry point';
COMMENT ON COLUMN gateway_points.employee_id IS 'Alphanumeric ID of employee operating this entry point';
COMMENT ON COLUMN gateway_points.visual_identifier IS 'Icon or image URL for visual identification (optional)';
