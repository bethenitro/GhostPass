-- Gateway Manager Schema
-- Run this in Supabase SQL Editor to create gateway_points table

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Gateway status enum
DO $$ BEGIN
    CREATE TYPE gateway_status AS ENUM ('ENABLED', 'DISABLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Gateway type enum
DO $$ BEGIN
    CREATE TYPE gateway_type AS ENUM ('ENTRY_POINT', 'INTERNAL_AREA', 'TABLE_SEAT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Gateway points table
CREATE TABLE IF NOT EXISTS gateway_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status gateway_status NOT NULL DEFAULT 'ENABLED',
    type gateway_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(venue_id, name, type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gateway_points_venue_id ON gateway_points(venue_id);
CREATE INDEX IF NOT EXISTS idx_gateway_points_type ON gateway_points(type);
CREATE INDEX IF NOT EXISTS idx_gateway_points_status ON gateway_points(status);

-- Trigger to automatically update timestamp
CREATE OR REPLACE FUNCTION update_gateway_point_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gateway_point_update_timestamp
    BEFORE UPDATE ON gateway_points
    FOR EACH ROW
    EXECUTE FUNCTION update_gateway_point_timestamp();

-- Grant permissions (adjust as needed for your setup)
-- ALTER TABLE gateway_points ENABLE ROW LEVEL SECURITY;
