-- Migration: Fix foreign key constraints to allow CASCADE delete
-- This allows users to be deleted even if they have related records

-- Drop existing foreign key constraint on wallets
ALTER TABLE wallets 
DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- Re-add with CASCADE delete
ALTER TABLE wallets
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Also fix other tables that reference users
-- This ensures when a user is deleted, all their data is cleaned up

-- Fix ghost_passes
ALTER TABLE ghost_passes 
DROP CONSTRAINT IF EXISTS ghost_passes_user_id_fkey;

ALTER TABLE ghost_passes
ADD CONSTRAINT ghost_passes_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Fix sessions
ALTER TABLE sessions 
DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

ALTER TABLE sessions
ADD CONSTRAINT sessions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT wallets_user_id_fkey ON wallets IS 
'Cascade delete wallets when user is deleted';

COMMENT ON CONSTRAINT ghost_passes_user_id_fkey ON ghost_passes IS 
'Cascade delete ghost passes when user is deleted';

COMMENT ON CONSTRAINT sessions_user_id_fkey ON sessions IS 
'Cascade delete sessions when user is deleted';
