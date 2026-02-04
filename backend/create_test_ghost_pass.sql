-- Create a test ghost pass for scanner testing
-- Run this in Supabase SQL Editor

-- Create a test ghost pass with the UUID from the QR code
INSERT INTO ghost_passes (
    id,
    user_id,
    status,
    expires_at,
    created_at
) VALUES (
    '6b6a15ce-65a2-4955-a6bd-8d0f25da67bf',
    'f0ea11d3-d746-4503-b2e9-3bdca489ce5d', -- Use the existing user ID from the database
    'ACTIVE',
    NOW() + INTERVAL '7 days',
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    status = 'ACTIVE',
    expires_at = NOW() + INTERVAL '7 days';

-- Verify the pass was created
SELECT 
    id,
    user_id,
    status,
    expires_at,
    created_at
FROM ghost_passes 
WHERE id = '6b6a15ce-65a2-4955-a6bd-8d0f25da67bf';