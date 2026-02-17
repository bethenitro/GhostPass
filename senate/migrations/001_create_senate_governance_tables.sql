-- Senate Governance Decision Logging Tables
-- HARDENING REQUIREMENT 1: Deterministic Decision Logging
-- Migration: 001_create_senate_governance_tables
-- Created: 2026-02-18

-- Main decision log table - immutable audit trail
CREATE TABLE IF NOT EXISTS senate_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL UNIQUE,
    input_hash TEXT NOT NULL, -- SHA-256 hash only, NO raw prompts
    
    -- Senator votes (raw JSON array)
    all_senator_votes JSONB NOT NULL,
    senator_abstentions INTEGER NOT NULL DEFAULT 0,
    
    -- Executive Secretary decision
    executive_secretary_decision TEXT CHECK (executive_secretary_decision IN ('APPROVE', 'DENY', 'ESCALATE')),
    executive_secretary_confidence INTEGER CHECK (executive_secretary_confidence BETWEEN 0 AND 100),
    
    -- Judge invocation
    judge_invoked BOOLEAN NOT NULL DEFAULT FALSE,
    judge_decision TEXT CHECK (judge_decision IN ('APPROVE', 'DENY', NULL)),
    judge_confidence INTEGER CHECK (judge_confidence BETWEEN 0 AND 100 OR judge_confidence IS NULL),
    escalation_reason TEXT,
    
    -- Final verdict
    final_verdict TEXT NOT NULL CHECK (final_verdict IN ('APPROVE', 'DENY')),
    decision_source TEXT NOT NULL CHECK (decision_source IN ('SENATE', 'JUDGE', 'VETO')),
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    
    -- Risk flags
    risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    protected_risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Veto tracking
    veto_applied BOOLEAN NOT NULL DEFAULT FALSE,
    veto_timestamp TIMESTAMPTZ,
    veto_reason TEXT,
    original_decision TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast transaction lookups
CREATE INDEX IF NOT EXISTS idx_senate_decision_log_transaction_id ON senate_decision_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_senate_decision_log_created_at ON senate_decision_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_senate_decision_log_final_verdict ON senate_decision_log(final_verdict);
CREATE INDEX IF NOT EXISTS idx_senate_decision_log_decision_source ON senate_decision_log(decision_source);
CREATE INDEX IF NOT EXISTS idx_senate_decision_log_judge_invoked ON senate_decision_log(judge_invoked);

-- Protected risk flag triggers table
CREATE TABLE IF NOT EXISTS senate_protected_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL UNIQUE,
    description TEXT,
    auto_deny BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default protected risk flags
INSERT INTO senate_protected_flags (flag_name, description, auto_deny) VALUES
    ('security_vulnerability', 'Security vulnerability detected', TRUE),
    ('data_breach_risk', 'Potential data breach risk', TRUE),
    ('regulatory_violation', 'Regulatory compliance violation', TRUE),
    ('compliance_failure', 'Compliance check failure', TRUE),
    ('systemic_exposure', 'Systemic risk exposure', TRUE)
ON CONFLICT (flag_name) DO NOTHING;

-- Senate execution metrics for monitoring
CREATE TABLE IF NOT EXISTS senate_execution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL,
    
    -- Execution timing
    execution_time_ms INTEGER NOT NULL,
    senator_dispatch_time_ms INTEGER,
    executive_secretary_time_ms INTEGER,
    judge_time_ms INTEGER,
    
    -- Senator performance
    senators_total INTEGER NOT NULL,
    senators_responded INTEGER NOT NULL,
    senators_abstained INTEGER NOT NULL,
    senators_timeout INTEGER NOT NULL DEFAULT 0,
    
    -- Decision flow
    judge_invoked BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_trigger TEXT,
    
    -- Variance metrics
    vote_variance NUMERIC,
    confidence_variance NUMERIC,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (transaction_id) REFERENCES senate_decision_log(transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_senate_metrics_created_at ON senate_execution_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_senate_metrics_judge_invoked ON senate_execution_metrics(judge_invoked);

-- Alert thresholds configuration
CREATE TABLE IF NOT EXISTS senate_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL UNIQUE,
    threshold_value NUMERIC NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default alert thresholds
INSERT INTO senate_alert_config (alert_type, threshold_value, description) VALUES
    ('judge_invocation_rate', 0.3, 'Alert if judge invocation rate exceeds 30%'),
    ('abstention_rate', 0.4, 'Alert if abstention rate exceeds 40%'),
    ('variance_rate', 0.5, 'Alert if vote variance exceeds 50%'),
    ('execution_time_ms', 5000, 'Alert if execution time exceeds 5 seconds'),
    ('protected_flag_rate', 0.1, 'Alert if protected flags exceed 10%')
ON CONFLICT (alert_type) DO NOTHING;

-- Veto audit trail
CREATE TABLE IF NOT EXISTS senate_veto_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL,
    original_decision TEXT NOT NULL,
    new_decision TEXT NOT NULL CHECK (new_decision IN ('APPROVE', 'DENY')),
    veto_reason TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    veto_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (transaction_id) REFERENCES senate_decision_log(transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_senate_veto_log_transaction_id ON senate_veto_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_senate_veto_log_timestamp ON senate_veto_log(veto_timestamp DESC);

COMMENT ON TABLE senate_decision_log IS 'Immutable audit trail of all Senate governance decisions - stores only hashes and verdicts, NO raw prompts';
COMMENT ON TABLE senate_execution_metrics IS 'Performance and execution metrics for monitoring Senate system health';
COMMENT ON TABLE senate_protected_flags IS 'Protected risk flags that trigger automatic Judge escalation';
COMMENT ON TABLE senate_alert_config IS 'Alert threshold configuration for monitoring';
COMMENT ON TABLE senate_veto_log IS 'Audit trail of human veto actions';
