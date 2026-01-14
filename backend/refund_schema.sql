-- Refund Feature Schema Migration
-- Adds refund tracking capabilities to transactions and wallets tables
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD REFUND STATUS ENUM
-- ============================================
DO $$ BEGIN
    CREATE TYPE refund_status AS ENUM ('NONE', 'PARTIAL', 'FULL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. ADD REFUND COLUMNS TO TRANSACTIONS TABLE
-- ============================================
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS refund_status refund_status DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS refund_reference_id TEXT,
ADD COLUMN IF NOT EXISTS provider_tx_id TEXT,
ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 3. ADD REFUND ELIGIBILITY TO WALLETS TABLE
-- ============================================
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS is_refund_eligible BOOLEAN DEFAULT TRUE;

-- ============================================
-- 4. UPDATE TRANSACTION TYPE ENUM TO INCLUDE REFUND
-- ============================================
-- Check if transaction_type enum exists and add REFUND if not present
DO $$ 
BEGIN
    -- Check if the type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        -- Add REFUND value if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = 'transaction_type'::regtype 
            AND enumlabel = 'REFUND'
        ) THEN
            ALTER TYPE transaction_type ADD VALUE 'REFUND';
        END IF;
    ELSE
        -- Create the enum if it doesn't exist
        CREATE TYPE transaction_type AS ENUM ('FUND', 'SPEND', 'FEE', 'REFUND');
    END IF;
END $$;

-- ============================================
-- 5. UPDATE CHECK CONSTRAINT ON TRANSACTIONS TABLE
-- ============================================
-- Drop old constraint and add new one that includes REFUND
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
    CHECK (type IN ('FUND', 'SPEND', 'FEE', 'REFUND'));

-- ============================================
-- 6. CREATE INDEXES FOR REFUND QUERIES
-- ============================================
-- Index for finding eligible funding transactions for refunds
CREATE INDEX IF NOT EXISTS idx_transactions_refund_lookup 
ON transactions(wallet_id, type, refund_status, timestamp DESC)
WHERE type = 'FUND';

-- Index for provider transaction ID lookups (for reconciliation)
CREATE INDEX IF NOT EXISTS idx_transactions_provider_tx_id 
ON transactions(provider_tx_id)
WHERE provider_tx_id IS NOT NULL;

-- Index for refund status queries
CREATE INDEX IF NOT EXISTS idx_transactions_refund_status 
ON transactions(refund_status)
WHERE refund_status != 'NONE';

-- ============================================
-- 7. CREATE ATOMIC REFUND PROCESSING FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION process_wallet_refund(
    p_user_id UUID,
    p_amount_cents INTEGER,
    p_wallet_id UUID,
    p_funding_transaction_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_wallet_balance INTEGER;
    v_funding_tx RECORD;
    v_refund_tx_id UUID;
    v_is_eligible BOOLEAN;
    v_refund_type refund_status;
BEGIN
    -- Step 1: Validate wallet and get balance
    SELECT balance_cents, is_refund_eligible 
    INTO v_wallet_balance, v_is_eligible
    FROM wallets 
    WHERE id = p_wallet_id AND user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;
    
    IF NOT v_is_eligible THEN
        RAISE EXCEPTION 'Wallet is not eligible for refunds';
    END IF;
    
    IF v_wallet_balance < p_amount_cents THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Requested: %', v_wallet_balance, p_amount_cents;
    END IF;
    
    -- Step 2: Get the specified funding transaction and validate it
    SELECT id, amount_cents, gateway_id, provider_tx_id, refund_status
    INTO v_funding_tx
    FROM transactions
    WHERE id = p_funding_transaction_id
      AND wallet_id = p_wallet_id
      AND type = 'FUND'
      AND refund_status IN ('NONE', 'PARTIAL');
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Funding transaction not found or not eligible for refund';
    END IF;
    
    -- Step 3: Validate refund amount against original funding amount
    IF p_amount_cents > v_funding_tx.amount_cents THEN
        RAISE EXCEPTION 'Refund amount (%) exceeds original funding amount (%)', p_amount_cents, v_funding_tx.amount_cents;
    END IF;
    
    -- Step 4: Determine refund type (PARTIAL or FULL)
    IF p_amount_cents = v_funding_tx.amount_cents THEN
        v_refund_type := 'FULL';
    ELSE
        v_refund_type := 'PARTIAL';
    END IF;
    
    -- Step 5: Debit wallet balance (ATOMIC)
    UPDATE wallets 
    SET balance_cents = balance_cents - p_amount_cents,
        updated_at = NOW()
    WHERE id = p_wallet_id;
    
    -- Step 6: Update original funding transaction with refund status
    UPDATE transactions
    SET refund_status = v_refund_type,
        refund_requested_at = NOW()
    WHERE id = v_funding_tx.id;
    
    -- Step 7: Create REFUND transaction ledger entry
    INSERT INTO transactions (
        wallet_id,
        type,
        amount_cents,
        gateway_id,
        balance_before_cents,
        balance_after_cents,
        metadata
    ) VALUES (
        p_wallet_id,
        'REFUND',
        -p_amount_cents,  -- Negative amount for refund
        v_funding_tx.gateway_id,
        v_wallet_balance,
        v_wallet_balance - p_amount_cents,
        jsonb_build_object(
            'original_tx_id', v_funding_tx.id,
            'refund_type', v_refund_type,
            'provider_tx_id', v_funding_tx.provider_tx_id
        )
    )
    RETURNING id INTO v_refund_tx_id;
    
    -- Step 8: Return refund details in an array (for PostgREST compatibility)
    RETURN jsonb_build_array(jsonb_build_object(
        'success', TRUE,
        'refund_transaction_id', v_refund_tx_id,
        'original_transaction_id', v_funding_tx.id,
        'amount_cents', p_amount_cents,
        'refund_type', v_refund_type,
        'payment_provider', v_funding_tx.gateway_id,
        'provider_tx_id', v_funding_tx.provider_tx_id,
        'new_balance_cents', v_wallet_balance - p_amount_cents
    ));
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error details in an array
        RETURN jsonb_build_array(jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM
        ));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE FUNCTION TO GET REFUND HISTORY
-- ============================================
CREATE OR REPLACE FUNCTION get_refund_history(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    original_transaction_id UUID,
    amount_cents INTEGER,
    refund_status refund_status,
    refund_reference_id TEXT,
    requested_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    provider TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        (t.metadata->>'original_tx_id')::UUID as original_transaction_id,
        ABS(t.amount_cents) as amount_cents,
        COALESCE(
            (SELECT refund_status FROM transactions WHERE id = (t.metadata->>'original_tx_id')::UUID),
            'NONE'::refund_status
        ) as refund_status,
        (SELECT refund_reference_id FROM transactions WHERE id = (t.metadata->>'original_tx_id')::UUID) as refund_reference_id,
        t.timestamp as requested_at,
        (SELECT refund_completed_at FROM transactions WHERE id = (t.metadata->>'original_tx_id')::UUID) as completed_at,
        t.gateway_id as provider
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.id
    WHERE w.user_id = p_user_id
      AND t.type = 'REFUND'
    ORDER BY t.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. GRANT PERMISSIONS (if needed)
-- ============================================
-- Ensure authenticated users can execute these functions
-- GRANT EXECUTE ON FUNCTION process_wallet_refund TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_refund_history TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
SELECT 'Refund Schema Migration Complete! ✅' as status;
