-- Create missing database functions
-- Run this in Supabase SQL Editor to add missing functions

-- Function to update expired passes
CREATE OR REPLACE FUNCTION update_expired_passes() RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE ghost_passes 
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND expires_at < NOW();
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get total balance across all wallets
CREATE OR REPLACE FUNCTION get_total_balance() RETURNS INTEGER AS $$
DECLARE
    v_total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(balance_cents), 0) INTO v_total_balance FROM wallets;
    RETURN v_total_balance;
END;
$$ LANGUAGE plpgsql;