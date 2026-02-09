-- Ghost Pass Modes Schema
-- Supports Mode A (pay-per-scan) and Mode B (event pass)

-- Add columns to existing ghost_passes table (Mode B - Event Pass)
-- Note: ghost_passes table already exists in supabase.sql
-- First add wallet_binding_id column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'wallet_binding_id') THEN
        ALTER TABLE ghost_passes ADD COLUMN wallet_binding_id TEXT;
    END IF;
END $$;

-- Add other columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'context') THEN
        ALTER TABLE ghost_passes ADD COLUMN context TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'pass_type') THEN
        ALTER TABLE ghost_passes ADD COLUMN pass_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'pass_name') THEN
        ALTER TABLE ghost_passes ADD COLUMN pass_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'price_cents') THEN
        ALTER TABLE ghost_passes ADD COLUMN price_cents INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'duration_hours') THEN
        ALTER TABLE ghost_passes ADD COLUMN duration_hours INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'duration_days') THEN
        ALTER TABLE ghost_passes ADD COLUMN duration_days INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'purchased_at') THEN
        ALTER TABLE ghost_passes ADD COLUMN purchased_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'metadata') THEN
        ALTER TABLE ghost_passes ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ghost_passes' AND column_name = 'updated_at') THEN
        ALTER TABLE ghost_passes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create index on wallet_binding_id
CREATE INDEX IF NOT EXISTS idx_ghost_passes_wallet_binding ON ghost_passes(wallet_binding_id);

-- Interactions table (tracks both Mode A and Mode B scans)
CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    wallet_binding_id TEXT NOT NULL,
    context TEXT NOT NULL,
    interaction_method TEXT NOT NULL, -- QR, NFC
    gateway_id TEXT NOT NULL,
    ghost_pass_token TEXT, -- NULL for Mode A, populated for Mode B
    mode TEXT NOT NULL, -- pay_per_scan, event
    amount_charged_cents INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Context configurations table (dynamic mode configuration)
CREATE TABLE IF NOT EXISTS context_configs (
    id SERIAL PRIMARY KEY,
    context TEXT UNIQUE NOT NULL,
    pass_required BOOLEAN NOT NULL DEFAULT false,
    per_scan_fee_cents INTEGER DEFAULT 0,
    pass_options JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghost_passes_wallet ON ghost_passes(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_ghost_passes_context ON ghost_passes(context);
CREATE INDEX IF NOT EXISTS idx_ghost_passes_status ON ghost_passes(status);
CREATE INDEX IF NOT EXISTS idx_ghost_passes_expires ON ghost_passes(expires_at);

CREATE INDEX IF NOT EXISTS idx_interactions_wallet ON interactions(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_interactions_context ON interactions(context);
CREATE INDEX IF NOT EXISTS idx_interactions_gateway ON interactions(gateway_id);
CREATE INDEX IF NOT EXISTS idx_interactions_mode ON interactions(mode);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at);

CREATE INDEX IF NOT EXISTS idx_context_configs_context ON context_configs(context);

-- Sample context configurations
INSERT INTO context_configs (context, pass_required, per_scan_fee_cents, pass_options)
VALUES 
    -- Mode A: Pay-per-scan contexts
    ('default', false, 25, '[]'),
    ('club', false, 50, '[]'),
    ('bar', false, 25, '[]'),
    
    -- Mode B: Event pass contexts
    ('event', true, 0, '[
        {"id": "1day", "name": "1-Day Pass", "price_cents": 2500, "duration_hours": 24, "includes": ["entry", "vendors"]},
        {"id": "3day", "name": "3-Day Pass", "price_cents": 6000, "duration_hours": 72, "includes": ["entry", "vendors", "vip_areas"]},
        {"id": "weekend", "name": "Weekend Pass", "price_cents": 4500, "duration_hours": 48, "includes": ["entry", "vendors"]}
    ]'::jsonb),
    
    ('festival', true, 0, '[
        {"id": "single_day", "name": "Single Day", "price_cents": 7500, "duration_hours": 16, "includes": ["entry", "vendors", "stages"]},
        {"id": "full_festival", "name": "Full Festival Pass", "price_cents": 20000, "duration_hours": 96, "includes": ["entry", "vendors", "stages", "vip_areas", "camping"]}
    ]'::jsonb)
ON CONFLICT (context) DO NOTHING;

-- Comments
COMMENT ON TABLE ghost_passes IS 'Ghost Pass tokens for Mode B (event pass) contexts';
COMMENT ON TABLE interactions IS 'Tracks all interactions for both Mode A (pay-per-scan) and Mode B (event pass)';
COMMENT ON TABLE context_configs IS 'Dynamic configuration for context modes';

COMMENT ON COLUMN ghost_passes.id IS 'Ghost Pass token (used for validation)';
COMMENT ON COLUMN ghost_passes.context IS 'Context/venue where pass is valid';
COMMENT ON COLUMN ghost_passes.status IS 'ACTIVE, EXPIRED, or REVOKED';

COMMENT ON COLUMN interactions.mode IS 'pay_per_scan for Mode A, event for Mode B';
COMMENT ON COLUMN interactions.amount_charged_cents IS 'Amount charged (0 for Mode B with valid pass)';
COMMENT ON COLUMN interactions.ghost_pass_token IS 'NULL for Mode A, populated for Mode B';

COMMENT ON COLUMN context_configs.pass_required IS 'false = Mode A (pay-per-scan), true = Mode B (event pass)';
COMMENT ON COLUMN context_configs.per_scan_fee_cents IS 'Fee charged per scan in Mode A (0 for Mode B)';
COMMENT ON COLUMN context_configs.pass_options IS 'Available pass options for Mode B contexts';
