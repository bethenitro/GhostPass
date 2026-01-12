-- GhostPass Admin Schema Setup
-- Run this SQL in Supabase Dashboard > SQL Editor

-- 1. Create user_role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('USER', 'VENDOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add role column to users table (if not exists)
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'USER';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Create fee_configs table (CRITICAL for admin functionality)
CREATE TABLE IF NOT EXISTS fee_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id TEXT NOT NULL UNIQUE,
    valid_pct DECIMAL(5,2) NOT NULL CHECK (valid_pct >= 0 AND valid_pct <= 100),
    vendor_pct DECIMAL(5,2) NOT NULL CHECK (vendor_pct >= 0 AND vendor_pct <= 100),
    pool_pct DECIMAL(5,2) NOT NULL CHECK (pool_pct >= 0 AND pool_pct <= 100),
    promoter_pct DECIMAL(5,2) NOT NULL CHECK (promoter_pct >= 0 AND promoter_pct <= 100),
    CHECK (valid_pct + vendor_pct + pool_pct + promoter_pct = 100)
);

-- 5. Create system_configs table
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor_user_id ON payout_requests(vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- 7. Create get_total_balance function
CREATE OR REPLACE FUNCTION get_total_balance() RETURNS INTEGER AS $$
DECLARE
    v_total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(balance_cents), 0) INTO v_total_balance FROM wallets;
    RETURN v_total_balance;
END;
$$ LANGUAGE plpgsql;

-- 8. Insert default system configurations
INSERT INTO system_configs (config_key, config_value) VALUES
('ghostpass_pricing', '{"1": 1000, "3": 2000, "7": 5000}'),
('scan_fees', '{"default": 10}'),
('data_retention', '{"retention_days": 60}')
ON CONFLICT (config_key) DO NOTHING;

-- 9. Show completion message
SELECT 'GhostPass Admin Schema Setup Complete! ✅' as status;