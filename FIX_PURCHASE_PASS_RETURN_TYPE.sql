-- Fix purchase_pass to return a table (array) instead of scalar UUID
-- This fixes the Supabase Python client compatibility issue

-- Drop existing function
DROP FUNCTION IF EXISTS purchase_pass(UUID, INTEGER, INTEGER);

-- Recreate function to return TABLE instead of scalar UUID
CREATE OR REPLACE FUNCTION purchase_pass(
    p_user_id UUID,
    p_amount INTEGER,
    p_duration_days INTEGER
) RETURNS TABLE(pass_id UUID) AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance INTEGER;
    v_pass_id UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get wallet and current balance
    SELECT id, balance_cents INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;
    
    -- Check balance
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Calculate expiration
    v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;
    
    -- Generate pass ID
    v_pass_id := uuid_generate_v4();
    
    -- Deduct from wallet
    UPDATE wallets
    SET balance_cents = balance_cents - p_amount
    WHERE id = v_wallet_id;
    
    -- Create ghost pass
    INSERT INTO ghost_passes (id, user_id, status, expires_at)
    VALUES (v_pass_id, p_user_id, 'ACTIVE', v_expires_at);
    
    -- Log transaction with balance snapshots and vendor name
    INSERT INTO transactions (
        wallet_id,
        type,
        amount_cents,
        balance_before_cents,
        balance_after_cents,
        vendor_name,
        metadata
    ) VALUES (
        v_wallet_id,
        'SPEND',
        -p_amount,
        v_current_balance,
        v_current_balance - p_amount,
        'GhostPass System',  -- Vendor name for GhostPass purchases
        jsonb_build_object(
            'pass_id', v_pass_id,
            'duration_days', p_duration_days,
            'expires_at', v_expires_at
        )
    );
    
    -- Return the pass_id as a single-row result set
    RETURN QUERY SELECT v_pass_id;
END;
$$ LANGUAGE plpgsql;
