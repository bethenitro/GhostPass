-- Ghost Pass Entry and Re-Entry Tracking Schema
-- Creates tables for comprehensive entry tracking and venue configuration

-- ============================================
-- 1. VENUE ENTRY CONFIGURATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS venue_entry_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT NOT NULL,
    event_id TEXT,
    re_entry_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    initial_entry_fee_cents INTEGER NOT NULL DEFAULT 2500,
    venue_reentry_fee_cents INTEGER NOT NULL DEFAULT 1000,
    valid_reentry_scan_fee_cents INTEGER NOT NULL DEFAULT 25,
    max_reentries INTEGER,
    reentry_time_limit_hours INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(venue_id, event_id)
);

-- Create indexes for venue entry configs
CREATE INDEX IF NOT EXISTS idx_venue_entry_configs_venue 
ON venue_entry_configs(venue_id);

CREATE INDEX IF NOT EXISTS idx_venue_entry_configs_event 
ON venue_entry_configs(event_id);

-- ============================================
-- 2. ENTRY EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS entry_events (
    id TEXT PRIMARY KEY,
    wallet_id UUID NOT NULL,
    wallet_binding_id TEXT NOT NULL,
    event_id TEXT,
    venue_id TEXT NOT NULL,
    entry_number INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('initial', 're_entry')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    gateway_id TEXT,
    gateway_name TEXT,
    initial_entry_fee_cents INTEGER DEFAULT 0,
    venue_reentry_fee_cents INTEGER DEFAULT 0,
    valid_reentry_scan_fee_cents INTEGER DEFAULT 0,
    total_fees_cents INTEGER DEFAULT 0,
    device_fingerprint TEXT,
    interaction_method TEXT DEFAULT 'QR' CHECK (interaction_method IN ('QR', 'NFC')),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for entry events
CREATE INDEX IF NOT EXISTS idx_entry_events_wallet_binding 
ON entry_events(wallet_binding_id);

CREATE INDEX IF NOT EXISTS idx_entry_events_venue 
ON entry_events(venue_id);

CREATE INDEX IF NOT EXISTS idx_entry_events_event 
ON entry_events(event_id);

CREATE INDEX IF NOT EXISTS idx_entry_events_timestamp 
ON entry_events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_entry_events_entry_type 
ON entry_events(entry_type);

-- ============================================
-- 3. WALLET SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_sessions (
    id TEXT PRIMARY KEY,
    wallet_binding_id TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    event_id TEXT,
    venue_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    force_surface BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for wallet sessions
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_binding 
ON wallet_sessions(wallet_binding_id);

CREATE INDEX IF NOT EXISTS idx_wallet_sessions_device 
ON wallet_sessions(device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_wallet_sessions_expires 
ON wallet_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_wallet_sessions_active 
ON wallet_sessions(is_active);

-- ============================================
-- 4. FUNCTIONS FOR ENTRY TRACKING
-- ============================================

-- Function to get entry count for wallet at venue
DROP FUNCTION IF EXISTS get_wallet_entry_count(text, text, text);
CREATE OR REPLACE FUNCTION get_wallet_entry_count(
    p_wallet_binding_id TEXT,
    p_venue_id TEXT,
    p_event_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
BEGIN
    IF p_event_id IS NOT NULL THEN
        RETURN (
            SELECT COUNT(*)
            FROM entry_events
            WHERE wallet_binding_id = p_wallet_binding_id
            AND venue_id = p_venue_id
            AND event_id = p_event_id
        );
    ELSE
        RETURN (
            SELECT COUNT(*)
            FROM entry_events
            WHERE wallet_binding_id = p_wallet_binding_id
            AND venue_id = p_venue_id
            AND event_id IS NULL
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check re-entry permission
DROP FUNCTION IF EXISTS check_reentry_permission(text, text, text);
CREATE OR REPLACE FUNCTION check_reentry_permission(
    p_wallet_binding_id TEXT,
    p_venue_id TEXT,
    p_event_id TEXT DEFAULT NULL
) RETURNS TABLE (
    allowed BOOLEAN,
    entry_type TEXT,
    entry_number INTEGER,
    initial_entry_fee_cents INTEGER,
    venue_reentry_fee_cents INTEGER,
    valid_reentry_scan_fee_cents INTEGER,
    total_fees_cents INTEGER,
    message TEXT,
    reason TEXT
) AS $$
DECLARE
    v_config RECORD;
    v_entry_count INTEGER;
    v_last_entry RECORD;
    v_time_since_last INTERVAL;
BEGIN
    -- Get venue configuration
    SELECT * INTO v_config
    FROM venue_entry_configs
    WHERE venue_id = p_venue_id
    AND (event_id = p_event_id OR (event_id IS NULL AND p_event_id IS NULL))
    LIMIT 1;
    
    -- Use defaults if no config found
    IF v_config IS NULL THEN
        v_config.re_entry_allowed := TRUE;
        v_config.initial_entry_fee_cents := 2500;
        v_config.venue_reentry_fee_cents := 1000;
        v_config.valid_reentry_scan_fee_cents := 25;
        v_config.max_reentries := NULL;
        v_config.reentry_time_limit_hours := NULL;
    END IF;
    
    -- Get current entry count
    v_entry_count := get_wallet_entry_count(p_wallet_binding_id, p_venue_id, p_event_id);
    
    IF v_entry_count = 0 THEN
        -- Initial entry
        RETURN QUERY SELECT 
            TRUE,
            'initial'::TEXT,
            1,
            v_config.initial_entry_fee_cents,
            0,
            0,
            v_config.initial_entry_fee_cents,
            'Initial entry permitted'::TEXT,
            NULL::TEXT;
    ELSE
        -- Re-entry attempt
        IF NOT v_config.re_entry_allowed THEN
            RETURN QUERY SELECT 
                FALSE,
                're_entry'::TEXT,
                v_entry_count + 1,
                0,
                0,
                0,
                0,
                'Re-entry not allowed - See Staff / Manager'::TEXT,
                'RE_ENTRY_DISABLED'::TEXT;
            RETURN;
        END IF;
        
        -- Check max re-entries
        IF v_config.max_reentries IS NOT NULL AND v_entry_count >= v_config.max_reentries THEN
            RETURN QUERY SELECT 
                FALSE,
                're_entry'::TEXT,
                v_entry_count + 1,
                0,
                0,
                0,
                0,
                ('Maximum re-entries (' || v_config.max_reentries || ') exceeded')::TEXT,
                'MAX_REENTRIES_EXCEEDED'::TEXT;
            RETURN;
        END IF;
        
        -- Check time limit
        IF v_config.reentry_time_limit_hours IS NOT NULL THEN
            SELECT * INTO v_last_entry
            FROM entry_events
            WHERE wallet_binding_id = p_wallet_binding_id
            AND venue_id = p_venue_id
            AND (event_id = p_event_id OR (event_id IS NULL AND p_event_id IS NULL))
            ORDER BY timestamp DESC
            LIMIT 1;
            
            IF v_last_entry IS NOT NULL THEN
                v_time_since_last := NOW() - v_last_entry.timestamp;
                IF EXTRACT(EPOCH FROM v_time_since_last) > (v_config.reentry_time_limit_hours * 3600) THEN
                    RETURN QUERY SELECT 
                        FALSE,
                        're_entry'::TEXT,
                        v_entry_count + 1,
                        0,
                        0,
                        0,
                        0,
                        ('Re-entry time limit (' || v_config.reentry_time_limit_hours || 'h) exceeded')::TEXT,
                        'REENTRY_TIME_LIMIT_EXCEEDED'::TEXT;
                    RETURN;
                END IF;
            END IF;
        END IF;
        
        -- Re-entry allowed
        RETURN QUERY SELECT 
            TRUE,
            're_entry'::TEXT,
            v_entry_count + 1,
            0,
            v_config.venue_reentry_fee_cents,
            v_config.valid_reentry_scan_fee_cents,
            v_config.venue_reentry_fee_cents + v_config.valid_reentry_scan_fee_cents,
            ('Re-entry permitted (#' || (v_entry_count + 1) || ')')::TEXT,
            NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to record entry event
DROP FUNCTION IF EXISTS record_entry_event(text, uuid, text, text, text, integer, text, text, text, integer, integer, integer, integer, text, text, jsonb);
CREATE OR REPLACE FUNCTION record_entry_event(
    p_entry_id TEXT,
    p_wallet_id UUID,
    p_wallet_binding_id TEXT,
    p_venue_id TEXT,
    p_event_id TEXT,
    p_entry_number INTEGER,
    p_entry_type TEXT,
    p_gateway_id TEXT,
    p_gateway_name TEXT,
    p_initial_entry_fee_cents INTEGER,
    p_venue_reentry_fee_cents INTEGER,
    p_valid_reentry_scan_fee_cents INTEGER,
    p_total_fees_cents INTEGER,
    p_device_fingerprint TEXT,
    p_interaction_method TEXT,
    p_metadata JSONB
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO entry_events (
        id, wallet_id, wallet_binding_id, venue_id, event_id,
        entry_number, entry_type, gateway_id, gateway_name,
        initial_entry_fee_cents, venue_reentry_fee_cents, 
        valid_reentry_scan_fee_cents, total_fees_cents,
        device_fingerprint, interaction_method, metadata
    ) VALUES (
        p_entry_id, p_wallet_id, p_wallet_binding_id, p_venue_id, p_event_id,
        p_entry_number, p_entry_type, p_gateway_id, p_gateway_name,
        p_initial_entry_fee_cents, p_venue_reentry_fee_cents,
        p_valid_reentry_scan_fee_cents, p_total_fees_cents,
        p_device_fingerprint, p_interaction_method, p_metadata
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. DEFAULT VENUE CONFIGURATIONS
-- ============================================

-- Insert default configurations for common venue types
INSERT INTO venue_entry_configs (venue_id, event_id, re_entry_allowed, initial_entry_fee_cents, venue_reentry_fee_cents, valid_reentry_scan_fee_cents)
VALUES 
    ('default', NULL, TRUE, 2500, 1000, 25),
    ('club', NULL, FALSE, 3000, 0, 0),  -- Clubs typically don't allow re-entry
    ('bar', NULL, TRUE, 1500, 500, 25),
    ('festival', NULL, TRUE, 7500, 2500, 50),
    ('venue_001', NULL, TRUE, 2500, 1000, 25)  -- Default for existing venue
ON CONFLICT (venue_id, event_id) DO NOTHING;

-- ============================================
-- 6. CLEANUP FUNCTIONS
-- ============================================

-- Function to cleanup expired wallet sessions
DROP FUNCTION IF EXISTS cleanup_expired_wallet_sessions();
CREATE OR REPLACE FUNCTION cleanup_expired_wallet_sessions() RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM wallet_sessions
    WHERE expires_at < NOW()
    OR (is_active = FALSE AND last_accessed < NOW() - INTERVAL '24 hours');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. VIEWS FOR REPORTING
-- ============================================

-- Drop existing views first
DROP VIEW IF EXISTS entry_statistics;
DROP VIEW IF EXISTS wallet_entry_summary;

-- Entry statistics view
CREATE OR REPLACE VIEW entry_statistics AS
SELECT 
    venue_id,
    event_id,
    DATE(timestamp) as entry_date,
    entry_type,
    COUNT(*) as entry_count,
    COUNT(DISTINCT wallet_binding_id) as unique_wallets,
    SUM(total_fees_cents) as total_fees_cents,
    SUM(venue_reentry_fee_cents + initial_entry_fee_cents) as venue_fees_cents,
    SUM(valid_reentry_scan_fee_cents) as valid_fees_cents,
    AVG(total_fees_cents) as avg_fee_per_entry
FROM entry_events
GROUP BY venue_id, event_id, DATE(timestamp), entry_type;

-- Wallet entry summary view
CREATE OR REPLACE VIEW wallet_entry_summary AS
SELECT 
    wallet_binding_id,
    venue_id,
    event_id,
    COUNT(*) as total_entries,
    SUM(CASE WHEN entry_type = 'initial' THEN 1 ELSE 0 END) as initial_entries,
    SUM(CASE WHEN entry_type = 're_entry' THEN 1 ELSE 0 END) as re_entries,
    SUM(total_fees_cents) as total_fees_paid_cents,
    MIN(timestamp) as first_entry,
    MAX(timestamp) as last_entry
FROM entry_events
GROUP BY wallet_binding_id, venue_id, event_id;