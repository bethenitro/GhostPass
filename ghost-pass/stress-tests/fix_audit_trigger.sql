-- Fix audit_wallet_changes function to handle NULL user_id for anonymous wallets
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION audit_wallet_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log wallet balance changes to audit trail
    -- Skip audit logging for anonymous wallets (user_id IS NULL)
    IF TG_OP = 'UPDATE' AND OLD.balance_cents != NEW.balance_cents AND NEW.user_id IS NOT NULL THEN
        INSERT INTO audit_logs (
            admin_user_id,
            action,
            resource_type,
            resource_id,
            old_value,
            new_value,
            metadata
        ) VALUES (
            NEW.user_id,
            'WALLET_BALANCE_CHANGE',
            'wallet',
            NEW.id::text,
            jsonb_build_object('balance_cents', OLD.balance_cents),
            jsonb_build_object('balance_cents', NEW.balance_cents),
            jsonb_build_object(
                'change_cents', NEW.balance_cents - OLD.balance_cents,
                'device_bound', NEW.device_bound,
                'wallet_binding_id', NEW.wallet_binding_id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
