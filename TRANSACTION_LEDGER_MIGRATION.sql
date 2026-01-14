-- Transaction Ledger Enhancement
-- Add balance tracking and vendor names to transactions table

-- 1. Add new columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS balance_before_cents INTEGER,
ADD COLUMN IF NOT EXISTS balance_after_cents INTEGER,
ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- 2. Create index for vendor name lookups
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_name ON transactions(vendor_name);

-- 3. Create index for timestamp + type for transaction history queries
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp_type ON transactions(timestamp DESC, type);

-- 4. Create a function to get transaction with balance snapshots
CREATE OR REPLACE FUNCTION record_transaction_with_balance(
    p_wallet_id UUID,
    p_type TEXT,
    p_amount_cents INTEGER,
    p_vendor_name TEXT DEFAULT NULL,
    p_gateway_id TEXT DEFAULT NULL,
    p_venue_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get current balance
    SELECT balance_cents INTO v_current_balance 
    FROM wallets 
    WHERE id = p_wallet_id 
    FOR UPDATE;
    
    -- Calculate new balance
    IF p_type = 'FUND' THEN
        v_new_balance := v_current_balance + p_amount_cents;
    ELSE
        v_new_balance := v_current_balance + p_amount_cents; -- amount_cents is already negative for SPEND
    END IF;
    
    -- Update wallet balance
    UPDATE wallets 
    SET balance_cents = v_new_balance 
    WHERE id = p_wallet_id;
    
    -- Insert transaction with balance snapshots
    INSERT INTO transactions (
        wallet_id,
        type,
        amount_cents,
        balance_before_cents,
        balance_after_cents,
        vendor_name,
        gateway_id,
        venue_id,
        metadata
    ) VALUES (
        p_wallet_id,
        p_type,
        p_amount_cents,
        v_current_balance,
        v_new_balance,
        p_vendor_name,
        p_gateway_id,
        p_venue_id,
        p_metadata
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Create view for transaction ledger with full details
CREATE OR REPLACE VIEW transaction_ledger AS
SELECT 
    t.id,
    t.wallet_id,
    t.type,
    t.amount_cents,
    t.balance_before_cents,
    t.balance_after_cents,
    t.vendor_name,
    t.gateway_id,
    t.venue_id,
    t.timestamp,
    t.metadata,
    w.user_id,
    u.email as user_email
FROM transactions t
JOIN wallets w ON t.wallet_id = w.id
JOIN users u ON w.user_id = u.id
ORDER BY t.timestamp DESC;

-- 6. Add constraint to require vendor_name for SPEND and FEE transactions
-- Note: This is a soft constraint via application logic, not database constraint
-- to allow flexibility for FUND transactions

SELECT 'Transaction Ledger Enhancement Complete! ✅' as status;
