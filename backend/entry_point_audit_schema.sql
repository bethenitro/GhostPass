-- Entry Point Audit Trail Schema
-- This creates the audit system for tracking all QR code and entry point actions

-- Create entry_point_audit_logs table
CREATE TABLE IF NOT EXISTS entry_point_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (action_type IN ('SCAN', 'CREATE', 'EDIT', 'DEACTIVATE', 'ACTIVATE', 'DELETE')),
    entry_point_id UUID NOT NULL,
    entry_point_type TEXT NOT NULL CHECK (entry_point_type IN ('ENTRY_POINT', 'INTERNAL_AREA', 'TABLE_SEAT')),
    entry_point_name TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    admin_user_id UUID REFERENCES users(id),
    admin_email TEXT,
    scanner_token TEXT,
    source_location TEXT NOT NULL, -- PCGM, Command Center, Scan UI
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_entry_audit_entry_point_id ON entry_point_audit_logs(entry_point_id);
CREATE INDEX IF NOT EXISTS idx_entry_audit_created_at ON entry_point_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_audit_action_type ON entry_point_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_entry_audit_employee_name ON entry_point_audit_logs(employee_name);
CREATE INDEX IF NOT EXISTS idx_entry_audit_source_location ON entry_point_audit_logs(source_location);

-- Function to automatically log entry point changes
CREATE OR REPLACE FUNCTION log_entry_point_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (CREATE)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO entry_point_audit_logs (
            action_type,
            entry_point_id,
            entry_point_type,
            entry_point_name,
            employee_name,
            employee_id,
            admin_user_id,
            source_location,
            new_values
        ) VALUES (
            'CREATE',
            NEW.id,
            NEW.type,
            NEW.name,
            NEW.employee_name,
            NEW.employee_id,
            NEW.created_by,
            'Command Center', -- Default source for database operations
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;

    -- Handle UPDATE (EDIT)
    IF TG_OP = 'UPDATE' THEN
        -- Only log if there are actual changes to tracked fields
        IF (OLD.name != NEW.name OR 
            OLD.employee_name != NEW.employee_name OR 
            OLD.employee_id != NEW.employee_id OR 
            OLD.type != NEW.type OR
            OLD.status != NEW.status OR
            OLD.accepts_ghostpass != NEW.accepts_ghostpass) THEN
            
            INSERT INTO entry_point_audit_logs (
                action_type,
                entry_point_id,
                entry_point_type,
                entry_point_name,
                employee_name,
                employee_id,
                source_location,
                old_values,
                new_values
            ) VALUES (
                CASE 
                    WHEN OLD.status = 'ENABLED' AND NEW.status = 'DISABLED' THEN 'DEACTIVATE'
                    WHEN OLD.status = 'DISABLED' AND NEW.status = 'ENABLED' THEN 'ACTIVATE'
                    ELSE 'EDIT'
                END,
                NEW.id,
                NEW.type,
                NEW.name,
                NEW.employee_name,
                NEW.employee_id,
                'Command Center', -- Default source for database operations
                to_jsonb(OLD),
                to_jsonb(NEW)
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        INSERT INTO entry_point_audit_logs (
            action_type,
            entry_point_id,
            entry_point_type,
            entry_point_name,
            employee_name,
            employee_id,
            source_location,
            old_values
        ) VALUES (
            'DELETE',
            OLD.id,
            OLD.type,
            OLD.name,
            OLD.employee_name,
            OLD.employee_id,
            'Command Center', -- Default source for database operations
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for gateway_points table
DROP TRIGGER IF EXISTS gateway_points_audit_trigger ON gateway_points;
CREATE TRIGGER gateway_points_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gateway_points
    FOR EACH ROW EXECUTE FUNCTION log_entry_point_audit();

-- Function to log scan events
CREATE OR REPLACE FUNCTION log_scan_audit(
    p_entry_point_id UUID,
    p_scanner_token TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
    v_gateway_info RECORD;
BEGIN
    -- Get gateway information
    SELECT id, type, name, employee_name, employee_id
    INTO v_gateway_info
    FROM gateway_points
    WHERE id = p_entry_point_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gateway point not found: %', p_entry_point_id;
    END IF;

    -- Insert audit log
    INSERT INTO entry_point_audit_logs (
        action_type,
        entry_point_id,
        entry_point_type,
        entry_point_name,
        employee_name,
        employee_id,
        scanner_token,
        source_location,
        metadata
    ) VALUES (
        'SCAN',
        p_entry_point_id,
        v_gateway_info.type,
        v_gateway_info.name,
        v_gateway_info.employee_name,
        v_gateway_info.employee_id,
        p_scanner_token,
        'Scan UI',
        p_metadata
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit logs with filters
CREATE OR REPLACE FUNCTION get_entry_point_audit_logs(
    p_entry_point_id UUID DEFAULT NULL,
    p_employee_name TEXT DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_source_location TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    action_type TEXT,
    entry_point_id UUID,
    entry_point_type TEXT,
    entry_point_name TEXT,
    employee_name TEXT,
    employee_id TEXT,
    admin_user_id UUID,
    admin_email TEXT,
    scanner_token TEXT,
    source_location TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.action_type,
        a.entry_point_id,
        a.entry_point_type,
        a.entry_point_name,
        a.employee_name,
        a.employee_id,
        a.admin_user_id,
        a.admin_email,
        a.scanner_token,
        a.source_location,
        a.old_values,
        a.new_values,
        a.metadata,
        a.created_at
    FROM entry_point_audit_logs a
    WHERE 
        (p_entry_point_id IS NULL OR a.entry_point_id = p_entry_point_id)
        AND (p_employee_name IS NULL OR a.employee_name ILIKE '%' || p_employee_name || '%')
        AND (p_action_type IS NULL OR a.action_type = p_action_type)
        AND (p_start_date IS NULL OR a.created_at >= p_start_date)
        AND (p_end_date IS NULL OR a.created_at <= p_end_date)
        AND (p_source_location IS NULL OR a.source_location = p_source_location)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit summary statistics
CREATE OR REPLACE FUNCTION get_audit_summary_stats(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_actions INTEGER,
    total_scans INTEGER,
    total_edits INTEGER,
    total_creates INTEGER,
    total_deactivates INTEGER,
    unique_entry_points INTEGER,
    unique_employees INTEGER,
    most_active_entry_point TEXT,
    most_active_employee TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total_actions,
            COUNT(*) FILTER (WHERE action_type = 'SCAN') as total_scans,
            COUNT(*) FILTER (WHERE action_type = 'EDIT') as total_edits,
            COUNT(*) FILTER (WHERE action_type = 'CREATE') as total_creates,
            COUNT(*) FILTER (WHERE action_type = 'DEACTIVATE') as total_deactivates,
            COUNT(DISTINCT entry_point_id) as unique_entry_points,
            COUNT(DISTINCT employee_name) as unique_employees
        FROM entry_point_audit_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
    ),
    most_active_entry AS (
        SELECT entry_point_name
        FROM entry_point_audit_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY entry_point_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ),
    most_active_emp AS (
        SELECT employee_name
        FROM entry_point_audit_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY employee_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    )
    SELECT 
        s.total_actions::INTEGER,
        s.total_scans::INTEGER,
        s.total_edits::INTEGER,
        s.total_creates::INTEGER,
        s.total_deactivates::INTEGER,
        s.unique_entry_points::INTEGER,
        s.unique_employees::INTEGER,
        COALESCE(mae.entry_point_name, 'None') as most_active_entry_point,
        COALESCE(maem.employee_name, 'None') as most_active_employee
    FROM stats s
    LEFT JOIN most_active_entry mae ON true
    LEFT JOIN most_active_emp maem ON true;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT ON entry_point_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_scan_audit TO authenticated;
GRANT EXECUTE ON FUNCTION get_entry_point_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_summary_stats TO authenticated;

-- Create RLS policies
ALTER TABLE entry_point_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read audit logs
CREATE POLICY "Users can read audit logs" ON entry_point_audit_logs
    FOR SELECT TO authenticated
    USING (true);

-- Policy for system to insert audit logs
CREATE POLICY "System can insert audit logs" ON entry_point_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);