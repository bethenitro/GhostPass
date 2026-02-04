-- Create demo gateway for scanner testing
-- Run this in Supabase SQL Editor to create a demo gateway entry

INSERT INTO gateway_points (
    id,
    venue_id,
    name,
    status,
    type,
    employee_name,
    employee_id,
    visual_identifier,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'venue_001',
    'Demo Scanner Gateway',
    'ENABLED',
    'ENTRY_POINT',
    'Demo Scanner',
    'SCANNER_001',
    '🚪',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    employee_name = EXCLUDED.employee_name,
    employee_id = EXCLUDED.employee_id,
    updated_at = NOW();