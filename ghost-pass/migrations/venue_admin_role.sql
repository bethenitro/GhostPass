-- Add VENUE_ADMIN role to user_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('USER', 'VENDOR', 'ADMIN', 'VENUE_ADMIN');
    ELSE
        -- Add VENUE_ADMIN to existing enum if not present
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'VENUE_ADMIN';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END;
    END IF;
END $$;

-- Add venue_id and event_id columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS venue_id TEXT,
ADD COLUMN IF NOT EXISTS event_id TEXT;

-- Create index for venue admins
CREATE INDEX IF NOT EXISTS idx_users_venue_id ON users(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add comment
COMMENT ON COLUMN users.venue_id IS 'Venue ID for VENUE_ADMIN users - restricts their access to specific venue';
COMMENT ON COLUMN users.event_id IS 'Optional event ID for VENUE_ADMIN users - further restricts to specific event';
