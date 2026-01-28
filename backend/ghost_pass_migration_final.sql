-- Ghost Pass Migration SQL - Final Version
-- Based on actual current database structure analysis
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD MISSING COLUMN TO TRANSACTIONS TABLE
-- ============================================
-- The transactions table already has most columns we need!
-- Only missing: vendor_id

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS vendor_id TEXT;

-- ============================================
-- 2. CREATE/FIX CRYPTOGRAPHIC PROOFS TABLE
-- ============================================
-- Table exists but has no columns - need to recreate
DROP TABLE IF EXISTS cryptographic_proofs;

CREATE TABLE cryptographic_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proof_id UUID UNIQUE NOT NULL,
    wallet_binding_id TEXT NOT NULL,
    proof_type TEXT NOT NULL CHECK (proof_type IN ('age_verified', 'medical_credential', 'access_class')),
    proof_value JSONB NOT NULL,
    signature TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    verified BOOLEAN DEFAULT FALSE
);

-- Create indexes for cryptographic proofs
CREATE INDEX IF NOT EXISTS idx_proofs_wallet_binding 
ON cryptographic_proofs(wallet_binding_id);

CREATE INDEX IF NOT EXISTS idx_proofs_type 
ON cryptographic_proofs(proof_type);

CREATE INDEX IF NOT EXISTS idx_proofs_device 
ON cryptographic_proofs(device_fingerprint);

-- ============================================
-- 3. CREATE/FIX GHOST PASS INTERACTIONS TABLE
-- ============================================
-- Table exists but has no columns - need to recreate
DROP TABLE IF EXISTS ghost_pass_interactions;

CREATE TABLE ghost_pass_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID UNIQUE NOT NULL,
    wallet_binding_id TEXT NOT NULL,
    ghost_pass_token TEXT NOT NULL,
    interaction_method TEXT NOT NULL CHECK (interaction_method IN ('QR', 'NFC')),
    gateway_id TEXT NOT NULL,
    item_amount_cents INTEGER NOT NULL DEFAULT 0,
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    vendor_payout_cents INTEGER NOT NULL DEFAULT 0,
    total_charged_cents INTEGER NOT NULL DEFAULT 0,
    context TEXT NOT NULL DEFAULT 'general',
    device_fingerprint TEXT NOT NULL,
    proofs_verified INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('APPROVED', 'DENIED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for ghost pass interactions
CREATE INDEX IF NOT EXISTS idx_interactions_wallet 
ON ghost_pass_interactions(wallet_binding_id);

CREATE INDEX IF NOT EXISTS idx_interactions_gateway 
ON ghost_pass_interactions(gateway_id);

CREATE INDEX IF NOT EXISTS idx_interactions_timestamp 
ON ghost_pass_interactions(created_at DESC);

-- ============================================
-- 4. CREATE/FIX GHOST PASS REVOCATIONS TABLE
-- ============================================
-- Table exists but has no columns - need to recreate
DROP TABLE IF EXISTS ghost_pass_revocations;

CREATE TABLE ghost_pass_revocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revocation_id UUID UNIQUE NOT NULL,
    ghost_pass_token TEXT NOT NULL,
    revocation_type TEXT NOT NULL DEFAULT 'TOKEN',
    reason TEXT NOT NULL,
    revoked_by UUID NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for revocations
CREATE INDEX IF NOT EXISTS idx_revocations_token 
ON ghost_pass_revocations(ghost_pass_token);

CREATE INDEX IF NOT EXISTS idx_revocations_revoked_by 
ON ghost_pass_revocations(revoked_by);

-- ============================================
-- 5. FIX PAYOUT REQUESTS TABLE
-- ============================================
-- Table exists but has no columns - need to recreate
DROP TABLE IF EXISTS payout_requests;

CREATE TABLE payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    transaction_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')) DEFAULT 'PENDING',
    payout_method TEXT DEFAULT 'ACH_TRANSFER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for payout requests
CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor 
ON payout_requests(vendor_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_status 
ON payout_requests(status);

CREATE INDEX IF NOT EXISTS idx_payout_requests_created 
ON payout_requests(created_at DESC);

-- ============================================
-- 6. CREATE GHOST PASS INTERACTION LOGGING FUNCTION
-- ============================================
-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS log_ghost_pass_interaction CASCADE;

CREATE OR REPLACE FUNCTION log_ghost_pass_interaction(
    p_interaction_id UUID,
    p_wallet_binding_id TEXT,
    p_ghost_pass_token TEXT,
    p_interaction_method TEXT,
    p_gateway_id TEXT,
    p_item_amount_cents INTEGER,
    p_platform_fee_cents INTEGER,
    p_vendor_payout_cents INTEGER,
    p_total_charged_cents INTEGER,
    p_context TEXT,
    p_device_fingerprint TEXT,
    p_proofs_verified INTEGER,
    p_status TEXT,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
BEGIN
    INSERT INTO ghost_pass_interactions (
        interaction_id,
        wallet_binding_id,
        ghost_pass_token,
        interaction_method,
        gateway_id,
        item_amount_cents,
        platform_fee_cents,
        vendor_payout_cents,
        total_charged_cents,
        context,
        device_fingerprint,
        proofs_verified,
        status,
        metadata
    ) VALUES (
        p_interaction_id,
        p_wallet_binding_id,
        p_ghost_pass_token,
        p_interaction_method::TEXT,
        p_gateway_id,
        p_item_amount_cents,
        p_platform_fee_cents,
        p_vendor_payout_cents,
        p_total_charged_cents,
        p_context,
        p_device_fingerprint,
        p_proofs_verified,
        p_status,
        p_metadata
    );
    
    RETURN p_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE REVOCATION CHECK FUNCTION
-- ============================================
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_ghost_pass_revoked CASCADE;

CREATE OR REPLACE FUNCTION is_ghost_pass_revoked(p_ghost_pass_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM ghost_pass_revocations 
        WHERE ghost_pass_token = p_ghost_pass_token
        AND revocation_type = 'TOKEN'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. CREATE PROOF VERIFICATION FUNCTION
-- ============================================
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS verify_cryptographic_proof CASCADE;

CREATE OR REPLACE FUNCTION verify_cryptographic_proof(
    p_proof_id UUID,
    p_device_fingerprint TEXT
) RETURNS TABLE (
    is_valid BOOLEAN,
    proof_type TEXT,
    proof_data JSONB,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (cp.device_fingerprint = p_device_fingerprint AND cp.verified = TRUE) as is_valid,
        cp.proof_type,
        cp.proof_value as proof_data,
        cp.expires_at
    FROM cryptographic_proofs cp
    WHERE cp.proof_id = p_proof_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. CREATE ATOMIC TRANSACTION WITH FEE DISTRIBUTION
-- ============================================
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_atomic_ghost_pass_transaction_with_distribution CASCADE;

CREATE OR REPLACE FUNCTION process_atomic_ghost_pass_transaction_with_distribution(
    p_user_id UUID,
    p_item_amount_cents INTEGER,
    p_platform_fee_cents INTEGER,
    p_vendor_payout_cents INTEGER,
    p_total_charged_cents INTEGER,
    p_gateway_id TEXT,
    p_context TEXT,
    p_vendor_id TEXT DEFAULT NULL,
    p_fee_distribution JSONB DEFAULT '{}'
) RETURNS TABLE (
    transaction_id UUID,
    balance_after_cents INTEGER,
    created_timestamp TIMESTAMPTZ,
    payout_scheduled BOOLEAN
) AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
    v_fee_transaction_id UUID;
    v_payout_id UUID;
BEGIN
    -- Lock wallet for update
    SELECT id, balance_cents INTO v_wallet_id, v_current_balance
    FROM wallets 
    WHERE user_id = p_user_id 
    FOR UPDATE;
    
    -- Check if wallet exists
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
    
    -- Check sufficient balance
    IF v_current_balance < p_total_charged_cents THEN
        RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', 
            p_total_charged_cents, v_current_balance;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - p_total_charged_cents;
    
    -- Update wallet balance
    UPDATE wallets 
    SET balance_cents = v_new_balance, updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Create main transaction (SPEND)
    v_transaction_id := gen_random_uuid();
    INSERT INTO transactions (
        id, wallet_id, type, amount_cents, 
        balance_before_cents, balance_after_cents,
        gateway_id, context, platform_fee_cents, vendor_payout_cents, vendor_id
    ) VALUES (
        v_transaction_id, v_wallet_id, 'SPEND', p_item_amount_cents,
        v_current_balance, v_new_balance,
        p_gateway_id, p_context, p_platform_fee_cents, p_vendor_payout_cents, p_vendor_id
    );
    
    -- Create platform fee transaction (FEE)
    IF p_platform_fee_cents > 0 THEN
        v_fee_transaction_id := gen_random_uuid();
        INSERT INTO transactions (
            id, wallet_id, type, amount_cents,
            balance_before_cents, balance_after_cents,
            vendor_name, gateway_id, context, platform_fee_cents, vendor_id
        ) VALUES (
            v_fee_transaction_id, v_wallet_id, 'FEE', p_platform_fee_cents,
            v_current_balance, v_new_balance,
            'VALID Platform Fee', p_gateway_id, p_context, p_platform_fee_cents, p_vendor_id
        );
    END IF;
    
    -- Schedule vendor payout if vendor_id provided
    IF p_vendor_id IS NOT NULL AND p_vendor_payout_cents > 0 THEN
        v_payout_id := gen_random_uuid();
        INSERT INTO payout_requests (
            id, vendor_id, amount_cents, transaction_id, metadata
        ) VALUES (
            v_payout_id, p_vendor_id, p_vendor_payout_cents, v_transaction_id, p_fee_distribution
        );
    END IF;
    
    -- Return transaction details
    RETURN QUERY SELECT 
        v_transaction_id,
        v_new_balance,
        NOW(),
        (p_vendor_id IS NOT NULL AND p_vendor_payout_cents > 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. CREATE COMPLIANCE AUDIT VIEWS
-- ============================================
-- Drop existing views if they exist
DROP VIEW IF EXISTS compliance_audit_summary CASCADE;
DROP VIEW IF EXISTS ghost_pass_interaction_summary CASCADE;

CREATE OR REPLACE VIEW compliance_audit_summary AS
SELECT 
    DATE(timestamp) as audit_date,
    action,
    COUNT(*) as action_count,
    COUNT(DISTINCT admin_user_id) as unique_admins,
    MIN(timestamp) as first_action,
    MAX(timestamp) as last_action
FROM audit_logs
GROUP BY DATE(timestamp), action
ORDER BY audit_date DESC, action_count DESC;

CREATE OR REPLACE VIEW ghost_pass_interaction_summary AS
SELECT 
    DATE(created_at) as interaction_date,
    interaction_method,
    context,
    status,
    COUNT(*) as interaction_count,
    SUM(platform_fee_cents) as total_platform_fees_cents,
    SUM(vendor_payout_cents) as total_vendor_payouts_cents,
    AVG(platform_fee_cents) as avg_platform_fee_cents
FROM ghost_pass_interactions
GROUP BY DATE(created_at), interaction_method, context, status
ORDER BY interaction_date DESC, interaction_count DESC;

-- ============================================
-- 11. CREATE ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for transactions table new columns
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_id 
ON transactions(vendor_id) WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_context 
ON transactions(context);

CREATE INDEX IF NOT EXISTS idx_transactions_interaction_method 
ON transactions(interaction_method);

-- Composite index for fee analysis
CREATE INDEX IF NOT EXISTS idx_transactions_fee_analysis 
ON transactions(type, context, platform_fee_cents) 
WHERE platform_fee_cents > 0;

-- ============================================
-- 12. GRANT PERMISSIONS
-- ============================================
-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION log_ghost_pass_interaction TO authenticated;
GRANT EXECUTE ON FUNCTION is_ghost_pass_revoked TO authenticated;
GRANT EXECUTE ON FUNCTION verify_cryptographic_proof TO authenticated;
GRANT EXECUTE ON FUNCTION process_atomic_ghost_pass_transaction_with_distribution TO authenticated;

-- Grant select permissions on views
GRANT SELECT ON compliance_audit_summary TO authenticated;
GRANT SELECT ON ghost_pass_interaction_summary TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- This migration adds:
-- ✅ Missing vendor_id column to transactions
-- ✅ Complete cryptographic proofs system
-- ✅ Ghost Pass interactions tracking
-- ✅ Real-time revocation system
-- ✅ Vendor payout scheduling
-- ✅ Atomic transaction processing
-- ✅ Compliance reporting views
-- ✅ Performance indexes
-- ✅ All required database functions