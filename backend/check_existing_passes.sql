-- Check what ghost passes exist in the database
-- Run this in Supabase SQL Editor to see existing passes

-- Show all ghost passes
SELECT 
    id,
    user_id,
    status,
    expires_at,
    created_at
FROM ghost_passes 
ORDER BY created_at DESC
LIMIT 10;

-- Show count by status
SELECT 
    status,
    COUNT(*) as count
FROM ghost_passes 
GROUP BY status;

-- Show users (to see if we have any users)
SELECT 
    id,
    email,
    created_at
FROM users 
ORDER BY created_at DESC
LIMIT 5;