-- Update purchase_pass function to include vendor name in transaction

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

-- Update fund_wallet function to include balance snapshots

CREATE OR REPLACE FUNCTION fund_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_gateway_id TEXT
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
    
    -- Add to wallet
    UPDATE wallets
    SET balance_cents = balance_cents + p_amount
    WHERE id = v_wallet_id;
    
    -- Log transaction with balance snapshots and vendor name
    INSERT INTO transactions (
        wallet_id,
        type,
        amount_cents,
        balance_before_cents,
        balance_after_cents,
        vendor_name,
        gateway_id,
        metadata
    ) VALUES (
        v_wallet_id,
        'FUND',
        p_amount,
        v_current_balance,
        v_current_balance + p_amount,
        p_gateway_id,  -- Use gateway name as vendor for funding
        p_gateway_id,
        jsonb_build_object('funding_source', p_gateway_id)
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

SELECT 'Purchase functions updated with vendor names! ✅' as status;
