-- Fix duplicate purchase_pass functions by dropping all versions and recreating

-- Drop all versions of purchase_pass function
DROP FUNCTION IF EXISTS purchase_pass(UUID, BIGINT, INTEGER);
DROP FUNCTION IF EXISTS purchase_pass(UUID, INTEGER, INTEGER);

-- Recreate with the correct signature including vendor name support
CREATE OR REPLACE FUNCTION purchase_pass(
    p_user_id UUID,
    p_amount INTEGER,
    p_duration_days INTEGER
) RETURNS UUID AS $$
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
    
    RETURN v_pass_id;
END;
$$ LANGUAGE plpgsql;


-- Drop all versions of fund_wallet function
DROP FUNCTION IF EXISTS fund_wallet(UUID, INTEGER, TEXT);

-- Recreate fund_wallet with vendor name support
CREATE OR REPLACE FUNCTION fund_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_gateway TEXT
) RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get or create wallet
    SELECT id, balance_cents INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance_cents)
        VALUES (p_user_id, 0)
        RETURNING id, balance_cents INTO v_wallet_id, v_current_balance;
    END IF;
    
    -- Update wallet balance
    UPDATE wallets
    SET balance_cents = balance_cents + p_amount
    WHERE id = v_wallet_id;
    
    -- Generate transaction ID
    v_transaction_id := uuid_generate_v4();
    
    -- Log transaction with balance snapshots and vendor name (gateway ID)
    INSERT INTO transactions (
        id,
        wallet_id,
        type,
        amount_cents,
        gateway_id,
        balance_before_cents,
        balance_after_cents,
        vendor_name,
        metadata
    ) VALUES (
        v_transaction_id,
        v_wallet_id,
        'FUND',
        p_amount,
        p_gateway,
        v_current_balance,
        v_current_balance + p_amount,
        p_gateway,  -- Use gateway as vendor name for funding
        jsonb_build_object('source', 'funding', 'gateway', p_gateway)
    );
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;
