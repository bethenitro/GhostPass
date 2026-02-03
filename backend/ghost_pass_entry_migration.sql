-- Ghost Pass Entry Management Migration
-- Adds all required tables for comprehensive entry management

-- Entry configurations table
CREATE TABLE IF NOT EXISTS entry_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT UNIQUE NOT NULL,
    initial_entry_fee_cents INTEGER NOT NULL DEFAULT 0,
    re_entry_allowed BOOLEAN NOT NULL DEFAULT true,
    venue_re_entry_fee_cents INTEGER NOT NULL DEFAULT 0,
    valid_re_entry_fee_cents INTEGER NOT NULL DEFAULT 25,
    pass_purchase_required BOOLEAN NOT NULL DEFAULT false,
    max_entries_per_day INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entry logs table - tracks every entry event
CREATE TABLE IF NOT EXISTS entry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    venue_id TEXT NOT NULL,
    gateway_id TEXT,
    entry_number INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('INITIAL', 'RE_ENTRY')),
    interaction_method TEXT NOT NULL CHECK (interaction_method IN ('QR', 'NFC')),
    fees_charged JSONB NOT NULL DEFAULT '{}',
    total_fee_cents INTEGER NOT NULL DEFAULT 0,
    wallet_balance_before INTEGER NOT NULL,
    wallet_balance_after INTEGER NOT NULL,
    device_fingerprint TEXT,
    ghost_pass_token TEXT,
    brightness_level INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'APPROVED',
    metadata JSONB DEFAULT '{}'
);

-- Wallet persistence table - manages PWA installation and session persistence
CREATE TABLE IF NOT EXISTS wallet_persistence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_binding_id TEXT NOT NULL,
    venue_id TEXT NOT NULL,
    force_pwa_install BOOLEAN NOT NULL DEFAULT true,
    session_duration_hours INTEGER NOT NULL DEFAULT 24,
    auto_brightness_control BOOLEAN NOT NULL DEFAULT true,
    brightness_override_level INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_binding_id, venue_id)
);

-- Brightness logs table - tracks brightness adjustments for QR scanning
CREATE TABLE IF NOT EXISTS brightness_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_binding_id TEXT NOT NULL,
    brightness_level INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trigger TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entry_logs_wallet_venue ON entry_logs(wallet_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_timestamp ON entry_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_entry_logs_venue_timestamp ON entry_logs(venue_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_entry_logs_entry_type ON entry_logs(entry_type);
CREATE INDEX IF NOT EXISTS idx_wallet_persistence_binding ON wallet_persistence(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_wallet_persistence_venue ON wallet_persistence(venue_id);
CREATE INDEX IF NOT EXISTS idx_wallet_persistence_expires ON wallet_persistence(expires_at);
CREATE INDEX IF NOT EXISTS idx_brightness_logs_binding ON brightness_logs(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_brightness_logs_timestamp ON brightness_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_entry_configurations_venue ON entry_configurations(venue_id);

-- Insert default entry configurations for existing venues
INSERT INTO entry_configurations (venue_id, initial_entry_fee_cents, re_entry_allowed, venue_re_entry_fee_cents, valid_re_entry_fee_cents, pass_purchase_required)
VALUES 
    ('venue_001', 0, true, 0, 25, false),
    ('default', 0, true, 0, 25, false)
ON CONFLICT (venue_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE entry_configurations IS 'Configuration settings for venue entry management including fees and re-entry permissions';
COMMENT ON TABLE entry_logs IS 'Complete audit trail of all entry events with fee tracking and entry counting';
COMMENT ON TABLE wallet_persistence IS 'Manages Ghost Pass wallet persistence and PWA installation requirements';
COMMENT ON TABLE brightness_logs IS 'Tracks QR code brightness adjustments for optimal scanning in low-light venues';

COMMENT ON COLUMN entry_logs.entry_number IS 'Sequential entry number for this wallet at this venue (1, 2, 3, etc.)';
COMMENT ON COLUMN entry_logs.entry_type IS 'INITIAL for first entry, RE_ENTRY for subsequent entries';
COMMENT ON COLUMN entry_logs.fees_charged IS 'JSON breakdown of all fees charged for this entry';
COMMENT ON COLUMN entry_logs.brightness_level IS 'Screen brightness level used for QR scanning (50-100)';

COMMENT ON COLUMN wallet_persistence.force_pwa_install IS 'Whether to force PWA installation after first successful scan';
COMMENT ON COLUMN wallet_persistence.auto_brightness_control IS 'Whether to automatically control screen brightness for QR codes';
COMMENT ON COLUMN wallet_persistence.brightness_override_level IS 'Default brightness level for QR scanning (50-100)';

-- Create function to automatically update entry numbers
CREATE OR REPLACE FUNCTION update_entry_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set entry_number if not already provided
    IF NEW.entry_number IS NULL THEN
        -- Calculate the next entry number for this wallet at this venue
        SELECT COALESCE(MAX(entry_number), 0) + 1
        INTO NEW.entry_number
        FROM entry_logs
        WHERE wallet_id = NEW.wallet_id AND venue_id = NEW.venue_id;
    END IF;
    
    -- Set entry type based on entry number if not already set
    IF NEW.entry_type IS NULL THEN
        IF NEW.entry_number = 1 THEN
            NEW.entry_type = 'INITIAL';
        ELSE
            NEW.entry_type = 'RE_ENTRY';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set entry numbers
DROP TRIGGER IF EXISTS trigger_update_entry_number ON entry_logs;
CREATE TRIGGER trigger_update_entry_number
    BEFORE INSERT ON entry_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_entry_number();

-- Create function to clean up expired wallet persistence records
CREATE OR REPLACE FUNCTION cleanup_expired_persistence()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM wallet_persistence
    WHERE expires_at < NOW() AND status = 'ACTIVE';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Update status instead of deleting for audit purposes
    UPDATE wallet_persistence
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE expires_at < NOW() AND status = 'ACTIVE';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get entry statistics for a venue
CREATE OR REPLACE FUNCTION get_venue_entry_stats(
    p_venue_id TEXT,
    p_date_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE,
    p_date_to TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH entry_data AS (
        SELECT 
            entry_type,
            total_fee_cents,
            fees_charged,
            wallet_id,
            EXTRACT(HOUR FROM timestamp) as entry_hour
        FROM entry_logs
        WHERE venue_id = p_venue_id
        AND timestamp >= p_date_from
        AND timestamp < p_date_to
    ),
    summary_stats AS (
        SELECT 
            COUNT(*) as total_entries,
            COUNT(*) FILTER (WHERE entry_type = 'INITIAL') as initial_entries,
            COUNT(*) FILTER (WHERE entry_type = 'RE_ENTRY') as re_entries,
            COUNT(DISTINCT wallet_id) as unique_wallets,
            COALESCE(SUM(total_fee_cents), 0) as total_fees_collected,
            COALESCE(SUM(CASE 
                WHEN fees_charged ? 'venue_re_entry_fee' 
                THEN (fees_charged->>'venue_re_entry_fee')::INTEGER 
                ELSE 0 
            END), 0) as venue_fees,
            COALESCE(SUM(CASE 
                WHEN fees_charged ? 'platform_re_entry_fee' 
                THEN (fees_charged->>'platform_re_entry_fee')::INTEGER 
                WHEN fees_charged ? 'initial_entry_fee'
                THEN (fees_charged->>'initial_entry_fee')::INTEGER
                ELSE 0 
            END), 0) as platform_fees
        FROM entry_data
    ),
    hourly_pattern AS (
        SELECT 
            COALESCE(
                JSON_OBJECT_AGG(entry_hour::TEXT, entry_count) FILTER (WHERE entry_hour IS NOT NULL),
                '{}'::JSON
            ) as entries_by_hour
        FROM (
            SELECT 
                entry_hour,
                COUNT(*) as entry_count
            FROM entry_data
            WHERE entry_hour IS NOT NULL
            GROUP BY entry_hour
            ORDER BY entry_hour
        ) hourly
    )
    SELECT JSON_BUILD_OBJECT(
        'summary', JSON_BUILD_OBJECT(
            'total_entries', s.total_entries,
            'initial_entries', s.initial_entries,
            're_entries', s.re_entries,
            'unique_wallets', s.unique_wallets,
            're_entry_rate', CASE WHEN s.total_entries > 0 THEN (s.re_entries::FLOAT / s.total_entries * 100) ELSE 0 END
        ),
        'fees', JSON_BUILD_OBJECT(
            'total_collected_cents', s.total_fees_collected,
            'venue_fees_cents', s.venue_fees,
            'platform_fees_cents', s.platform_fees,
            'total_collected_dollars', s.total_fees_collected / 100.0,
            'venue_fees_dollars', s.venue_fees / 100.0,
            'platform_fees_dollars', s.platform_fees / 100.0
        ),
        'patterns', JSON_BUILD_OBJECT(
            'entries_by_hour', h.entries_by_hour
        )
    )
    INTO result
    FROM summary_stats s
    CROSS JOIN hourly_pattern h;
    
    RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON entry_configurations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON entry_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_persistence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON brightness_logs TO authenticated;

-- Enable RLS (Row Level Security) if needed
ALTER TABLE entry_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_persistence ENABLE ROW LEVEL SECURITY;
ALTER TABLE brightness_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth system)
CREATE POLICY "Users can manage their own entry data" ON entry_logs
    FOR ALL USING (
        wallet_id IN (
            SELECT id FROM wallets WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all entry configurations" ON entry_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Users can manage their own wallet persistence" ON wallet_persistence
    FOR ALL USING (
        wallet_binding_id IN (
            SELECT wallet_binding_id FROM wallets WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own brightness logs" ON brightness_logs
    FOR ALL USING (
        wallet_binding_id IN (
            SELECT wallet_binding_id FROM wallets WHERE user_id = auth.uid()
        )
    );

-- Drop existing view if it exists to avoid conflicts
DROP VIEW IF EXISTS entry_statistics;

-- Create a view for easy entry statistics
CREATE VIEW entry_statistics AS
SELECT 
    venue_id,
    DATE(timestamp) as entry_date,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE entry_type = 'INITIAL') as initial_entries,
    COUNT(*) FILTER (WHERE entry_type = 'RE_ENTRY') as re_entries,
    COUNT(DISTINCT wallet_id) as unique_wallets,
    SUM(total_fee_cents) as total_fees_collected,
    AVG(total_fee_cents) as avg_fee_per_entry
FROM entry_logs
GROUP BY venue_id, DATE(timestamp)
ORDER BY venue_id, entry_date DESC;

GRANT SELECT ON entry_statistics TO authenticated;