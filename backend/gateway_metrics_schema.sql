-- Gateway Metrics Schema
-- Real-time metrics tracking for entry points

-- Create metrics table for tracking gateway activity
CREATE TABLE IF NOT EXISTS gateway_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_point_id UUID NOT NULL REFERENCES gateway_points(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'QR_SCAN', 'TRANSACTION', 'SALE'
    metric_value NUMERIC DEFAULT 1, -- count or amount
    amount_cents INTEGER DEFAULT 0, -- for transactions/sales
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gateway_metrics_point_id ON gateway_metrics(gateway_point_id);
CREATE INDEX IF NOT EXISTS idx_gateway_metrics_type ON gateway_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_gateway_metrics_timestamp ON gateway_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_metrics_point_type ON gateway_metrics(gateway_point_id, metric_type);

-- Create materialized view for aggregated metrics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS gateway_metrics_summary AS
SELECT 
    gp.id as gateway_point_id,
    gp.name as gateway_name,
    gp.type as gateway_type,
    gp.status as gateway_status,
    
    -- QR Scan metrics (for ENTRY_POINT)
    COUNT(CASE WHEN gm.metric_type = 'QR_SCAN' THEN 1 END) as total_qr_scans,
    MAX(CASE WHEN gm.metric_type = 'QR_SCAN' THEN gm.timestamp END) as last_qr_scan,
    COUNT(CASE WHEN gm.metric_type = 'QR_SCAN' AND gm.timestamp > NOW() - INTERVAL '1 hour' THEN 1 END) as qr_scans_last_hour,
    COUNT(CASE WHEN gm.metric_type = 'QR_SCAN' AND gm.timestamp > NOW() - INTERVAL '24 hours' THEN 1 END) as qr_scans_today,
    
    -- Transaction metrics (for TABLE_SEAT and INTERNAL_AREA)
    COUNT(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') THEN 1 END) as total_transactions,
    MAX(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') THEN gm.timestamp END) as last_transaction,
    COUNT(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '1 hour' THEN 1 END) as transactions_last_hour,
    COUNT(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '24 hours' THEN 1 END) as transactions_today,
    
    -- Sales value metrics
    COALESCE(SUM(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') THEN gm.amount_cents END), 0) as total_sales_cents,
    COALESCE(SUM(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '1 hour' THEN gm.amount_cents END), 0) as sales_last_hour_cents,
    COALESCE(SUM(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '24 hours' THEN gm.amount_cents END), 0) as sales_today_cents,
    
    NOW() as last_updated
FROM gateway_points gp
LEFT JOIN gateway_metrics gm ON gp.id = gm.gateway_point_id
GROUP BY gp.id, gp.name, gp.type, gp.status;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_metrics_summary_point_id 
ON gateway_metrics_summary(gateway_point_id);

-- Function to refresh metrics summary
CREATE OR REPLACE FUNCTION refresh_gateway_metrics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY gateway_metrics_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to record a metric event
CREATE OR REPLACE FUNCTION record_gateway_metric(
    p_gateway_point_id UUID,
    p_metric_type TEXT,
    p_amount_cents INTEGER DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_metric_id UUID;
BEGIN
    INSERT INTO gateway_metrics (
        gateway_point_id,
        metric_type,
        amount_cents,
        metadata
    ) VALUES (
        p_gateway_point_id,
        p_metric_type,
        p_amount_cents,
        p_metadata
    )
    RETURNING id INTO v_metric_id;
    
    RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get real-time metrics for a gateway point
CREATE OR REPLACE FUNCTION get_gateway_realtime_metrics(p_gateway_point_id UUID)
RETURNS TABLE (
    gateway_point_id UUID,
    gateway_name TEXT,
    gateway_type TEXT,
    gateway_status TEXT,
    total_qr_scans BIGINT,
    last_qr_scan TIMESTAMP WITH TIME ZONE,
    qr_scans_last_hour BIGINT,
    qr_scans_today BIGINT,
    total_transactions BIGINT,
    last_transaction TIMESTAMP WITH TIME ZONE,
    transactions_last_hour BIGINT,
    transactions_today BIGINT,
    total_sales_cents BIGINT,
    sales_last_hour_cents BIGINT,
    sales_today_cents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gp.id,
        gp.name,
        gp.type::TEXT,
        gp.status::TEXT,
        
        -- QR Scan metrics
        COUNT(CASE WHEN gm.metric_type = 'QR_SCAN' THEN 1 END)::BIGINT,
        MAX(CASE WHEN gm.metric_type = 'QR_SCAN' THEN gm.timestamp END),
        COUNT(CASE WHEN gm.metric_type = 'QR_SCAN' AND gm.timestamp > NOW() - INTERVAL '1 hour' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN gm.metric_type = 'QR_SCAN' AND gm.timestamp > NOW() - INTERVAL '24 hours' THEN 1 END)::BIGINT,
        
        -- Transaction metrics
        COUNT(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') THEN 1 END)::BIGINT,
        MAX(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') THEN gm.timestamp END),
        COUNT(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '1 hour' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '24 hours' THEN 1 END)::BIGINT,
        
        -- Sales value metrics
        COALESCE(SUM(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') THEN gm.amount_cents END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '1 hour' THEN gm.amount_cents END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN gm.metric_type IN ('TRANSACTION', 'SALE') AND gm.timestamp > NOW() - INTERVAL '24 hours' THEN gm.amount_cents END), 0)::BIGINT
    FROM gateway_points gp
    LEFT JOIN gateway_metrics gm ON gp.id = gm.gateway_point_id
    WHERE gp.id = p_gateway_point_id
    GROUP BY gp.id, gp.name, gp.type, gp.status;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-refresh summary periodically (optional)
-- Note: In production, you might want to refresh this via a cron job or scheduled task
-- For now, we'll rely on manual refresh or real-time queries

COMMENT ON TABLE gateway_metrics IS 'Tracks real-time metrics for gateway points including QR scans and transactions';
COMMENT ON MATERIALIZED VIEW gateway_metrics_summary IS 'Aggregated metrics summary for all gateway points, refreshed periodically';
COMMENT ON FUNCTION record_gateway_metric IS 'Records a metric event for a gateway point';
COMMENT ON FUNCTION get_gateway_realtime_metrics IS 'Gets real-time metrics for a specific gateway point';
