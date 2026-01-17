-- =====================================================
-- SENSORY CARGO UNIT (SCU) SYSTEM SCHEMA
-- =====================================================
-- This schema provides persistent storage for the SCU system
-- including signal history, Senate evaluations, and audit trails
-- =====================================================

-- =====================================================
-- 1. SENSORY SIGNALS TABLE
-- =====================================================
-- Stores all incoming sensory signals (SCUs and Capsules)
CREATE TABLE IF NOT EXISTS sensory_signals (
    signal_id TEXT PRIMARY KEY,
    payload_type TEXT NOT NULL CHECK (payload_type IN ('scu', 'capsule')),
    
    -- Signal metadata
    source_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Single SCU fields
    sensory_type TEXT,
    signal_data JSONB,
    metadata JSONB,
    
    -- Capsule fields
    capsule_id TEXT,
    scu_count INTEGER,
    sensory_types TEXT[],
    scus JSONB,
    
    -- Validation results
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'unknown')),
    ghost_pass_approved BOOLEAN NOT NULL DEFAULT FALSE,
    validation_result JSONB,
    
    -- Indexes for common queries
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensory_signals_received_at ON sensory_signals(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensory_signals_source_id ON sensory_signals(source_id);
CREATE INDEX IF NOT EXISTS idx_sensory_signals_status ON sensory_signals(status);
CREATE INDEX IF NOT EXISTS idx_sensory_signals_payload_type ON sensory_signals(payload_type);
CREATE INDEX IF NOT EXISTS idx_sensory_signals_ghost_pass ON sensory_signals(ghost_pass_approved);

-- =====================================================
-- 2. SENATE EVALUATIONS TABLE
-- =====================================================
-- Stores pending and completed Senate evaluations
CREATE TABLE IF NOT EXISTS senate_evaluations (
    evaluation_id TEXT PRIMARY KEY,
    signal_id TEXT NOT NULL REFERENCES sensory_signals(signal_id) ON DELETE CASCADE,
    
    -- Evaluation metadata
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'escalated')) DEFAULT 'pending',
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'normal')) DEFAULT 'normal',
    
    -- Signal context
    signal_data JSONB NOT NULL,
    context JSONB NOT NULL,
    
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_senate_evaluations_status ON senate_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_senate_evaluations_priority ON senate_evaluations(priority);
CREATE INDEX IF NOT EXISTS idx_senate_evaluations_signal_id ON senate_evaluations(signal_id);
CREATE INDEX IF NOT EXISTS idx_senate_evaluations_received_at ON senate_evaluations(received_at DESC);

-- =====================================================
-- 3. SENATE DECISIONS TABLE
-- =====================================================
-- Stores all Senate governance decisions
CREATE TABLE IF NOT EXISTS senate_decisions (
    decision_id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL REFERENCES senate_evaluations(evaluation_id) ON DELETE CASCADE,
    signal_id TEXT NOT NULL REFERENCES sensory_signals(signal_id) ON DELETE CASCADE,
    
    -- Decision details
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'escalated', 'request_more_data')),
    reason TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    trust_score DECIMAL(3,2) CHECK (trust_score >= 0 AND trust_score <= 1),
    
    -- Context
    signal_data JSONB,
    context JSONB,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_senate_decisions_decision ON senate_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_senate_decisions_signal_id ON senate_decisions(signal_id);
CREATE INDEX IF NOT EXISTS idx_senate_decisions_evaluation_id ON senate_decisions(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_senate_decisions_reviewer_id ON senate_decisions(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_senate_decisions_timestamp ON senate_decisions(timestamp DESC);

-- =====================================================
-- 4. AUDIT TRAIL TABLE
-- =====================================================
-- Comprehensive audit log for all system events
CREATE TABLE IF NOT EXISTS sensory_audit_trail (
    audit_id SERIAL PRIMARY KEY,
    
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'signal_received', 
        'ghost_pass_validation', 
        'senate_evaluation_created',
        'senate_decision_made',
        'signal_rejected'
    )),
    
    -- Related entities
    signal_id TEXT,
    evaluation_id TEXT,
    decision_id TEXT,
    
    -- Event data
    actor TEXT,
    action TEXT NOT NULL,
    details JSONB,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_event_type ON sensory_audit_trail(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_signal_id ON sensory_audit_trail(signal_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON sensory_audit_trail(timestamp DESC);

-- =====================================================
-- 5. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Recent signals with Senate status
CREATE OR REPLACE VIEW v_signals_with_senate_status AS
SELECT 
    s.signal_id,
    s.payload_type,
    s.source_id,
    s.sensory_type,
    s.sensory_types,
    s.timestamp,
    s.received_at,
    s.status as ghost_pass_status,
    s.ghost_pass_approved,
    e.evaluation_id,
    e.status as senate_status,
    e.priority as senate_priority,
    d.decision as senate_decision,
    d.decision_id,
    d.timestamp as decision_timestamp
FROM sensory_signals s
LEFT JOIN senate_evaluations e ON s.signal_id = e.signal_id
LEFT JOIN senate_decisions d ON e.evaluation_id = d.evaluation_id
ORDER BY s.received_at DESC;

-- View: Senate statistics
CREATE OR REPLACE VIEW v_senate_statistics AS
SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'escalated') as escalated_count,
    COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count,
    COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority_count,
    COUNT(*) FILTER (WHERE priority = 'normal') as normal_priority_count
FROM senate_evaluations;

-- View: Decision statistics
CREATE OR REPLACE VIEW v_decision_statistics AS
SELECT 
    COUNT(*) FILTER (WHERE decision = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE decision = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE decision = 'escalated') as escalated_count,
    COUNT(*) FILTER (WHERE decision = 'request_more_data') as request_more_data_count,
    COUNT(*) as total_decisions
FROM senate_decisions;

-- =====================================================
-- 6. FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function: Add signal to audit trail
CREATE OR REPLACE FUNCTION audit_signal_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO sensory_audit_trail (
        event_type,
        signal_id,
        action,
        details
    ) VALUES (
        'signal_received',
        NEW.signal_id,
        'Signal received and validated',
        jsonb_build_object(
            'payload_type', NEW.payload_type,
            'source_id', NEW.source_id,
            'status', NEW.status,
            'ghost_pass_approved', NEW.ghost_pass_approved
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Audit signal creation
DROP TRIGGER IF EXISTS trigger_audit_signal ON sensory_signals;
CREATE TRIGGER trigger_audit_signal
    AFTER INSERT ON sensory_signals
    FOR EACH ROW
    EXECUTE FUNCTION audit_signal_event();

-- Function: Add decision to audit trail
CREATE OR REPLACE FUNCTION audit_decision_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO sensory_audit_trail (
        event_type,
        signal_id,
        evaluation_id,
        decision_id,
        actor,
        action,
        details
    ) VALUES (
        'senate_decision_made',
        NEW.signal_id,
        NEW.evaluation_id,
        NEW.decision_id,
        NEW.reviewer_id,
        'Senate decision recorded',
        jsonb_build_object(
            'decision', NEW.decision,
            'reason', NEW.reason,
            'trust_score', NEW.trust_score
        )
    );
    
    -- Update evaluation status
    UPDATE senate_evaluations
    SET status = 'completed',
        completed_at = NEW.timestamp
    WHERE evaluation_id = NEW.evaluation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Audit decision creation
DROP TRIGGER IF EXISTS trigger_audit_decision ON senate_decisions;
CREATE TRIGGER trigger_audit_decision
    AFTER INSERT ON senate_decisions
    FOR EACH ROW
    EXECUTE FUNCTION audit_decision_event();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE sensory_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE senate_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE senate_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensory_audit_trail ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to sensory_signals"
    ON sensory_signals FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to senate_evaluations"
    ON senate_evaluations FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to senate_decisions"
    ON senate_decisions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to sensory_audit_trail"
    ON sensory_audit_trail FOR ALL
    USING (auth.role() = 'service_role');

-- Policy: Authenticated users can read
CREATE POLICY "Authenticated users can read sensory_signals"
    ON sensory_signals FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read senate_evaluations"
    ON senate_evaluations FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read senate_decisions"
    ON senate_decisions FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read sensory_audit_trail"
    ON sensory_audit_trail FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================
-- Run this script in your Supabase SQL editor to create
-- all tables, indexes, views, functions, and policies
-- =====================================================
