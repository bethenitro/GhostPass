import os
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional
import logging

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

logger = logging.getLogger(__name__)

class SupabaseManager:
    client: Optional[Client] = None

    @classmethod
    def get_client(cls) -> Client:
        if cls.client is None:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
            
            try:
                # Create client with minimal options to avoid compatibility issues
                cls.client = create_client(
                    supabase_url=SUPABASE_URL,
                    supabase_key=SUPABASE_KEY
                )
                logger.info("Supabase client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                raise
        return cls.client

    @classmethod
    def close_client(cls):
        if cls.client:
            cls.client = None

# Dependency for FastAPI
def get_db() -> Client:
    try:
        return SupabaseManager.get_client()
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise

# Database Schema SQL - Run this in Supabase SQL Editor
SCHEMA_SQL = """
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM ('USER', 'VENDOR', 'ADMIN');

-- Users table (Supabase Auth handles this, but we can extend)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Transaction types
CREATE TYPE transaction_type AS ENUM ('FUND', 'SPEND', 'FEE');

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount_cents INTEGER NOT NULL,
    gateway_id TEXT,
    venue_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Ghost pass status
CREATE TYPE pass_status AS ENUM ('ACTIVE', 'EXPIRED');

-- Ghost passes table
CREATE TABLE IF NOT EXISTS ghost_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status pass_status NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fee configurations table
CREATE TABLE IF NOT EXISTS fee_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id TEXT NOT NULL UNIQUE,
    valid_pct DECIMAL(5,2) NOT NULL CHECK (valid_pct >= 0 AND valid_pct <= 100),
    vendor_pct DECIMAL(5,2) NOT NULL CHECK (vendor_pct >= 0 AND vendor_pct <= 100),
    pool_pct DECIMAL(5,2) NOT NULL CHECK (pool_pct >= 0 AND pool_pct <= 100),
    promoter_pct DECIMAL(5,2) NOT NULL CHECK (promoter_pct >= 0 AND promoter_pct <= 100),
    CHECK (valid_pct + vendor_pct + pool_pct + promoter_pct = 100)
);

-- Admin audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Global system configurations
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor payout requests
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_passes_user_id ON ghost_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_ghost_passes_expires_at ON ghost_passes(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor_user_id ON payout_requests(vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- Atomic wallet funding function
CREATE OR REPLACE FUNCTION fund_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_gateway_id TEXT
) RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
    v_transaction_id UUID;
BEGIN
    -- Get or create wallet
    INSERT INTO wallets (user_id, balance_cents)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
    
    -- Update balance atomically
    UPDATE wallets 
    SET balance_cents = balance_cents + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Log transaction
    INSERT INTO transactions (wallet_id, type, amount_cents, gateway_id)
    VALUES (v_wallet_id, 'FUND', p_amount, p_gateway_id)
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic pass purchase function
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
    -- Get wallet and check balance
    SELECT id, balance_cents INTO v_wallet_id, v_current_balance
    FROM wallets WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;
    
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', p_amount, v_current_balance;
    END IF;
    
    -- Calculate expiration
    v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;
    
    -- Deduct from wallet
    UPDATE wallets 
    SET balance_cents = balance_cents - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Create pass
    INSERT INTO ghost_passes (user_id, expires_at)
    VALUES (p_user_id, v_expires_at)
    RETURNING id INTO v_pass_id;
    
    -- Log transaction
    INSERT INTO transactions (wallet_id, type, amount_cents, metadata)
    VALUES (v_wallet_id, 'SPEND', -p_amount, jsonb_build_object('pass_id', v_pass_id, 'duration_days', p_duration_days));
    
    RETURN v_pass_id;
END;
$$ LANGUAGE plpgsql;

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
CREATE OR REPLACE FUNCTION get_total_balance() RETURNS INTEGER AS $
DECLARE
    v_total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(balance_cents), 0) INTO v_total_balance FROM wallets;
    RETURN v_total_balance;
END;
$ LANGUAGE plpgsql;

-- Trigger to automatically update wallet timestamp
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_update_timestamp
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_timestamp();
"""
