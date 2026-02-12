-- Entry Point Audit Logs Table
-- Tracks all actions performed on entry points for compliance and security

CREATE TABLE IF NOT EXISTS entry_point_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('SCAN', 'CREATE', 'EDIT', 'DEACTIVATE', 'ACTIVATE', 'DELETE')),
  entry_point_id UUID NOT NULL,
  entry_point_type TEXT,
  entry_point_name TEXT,
  employee_name TEXT,
  employee_id TEXT,
  admin_user_id UUID REFERENCES auth.users(id),
  admin_email TEXT,
  source_location TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_entry_point ON entry_point_audit_logs(entry_point_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON entry_point_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_employee ON entry_point_audit_logs(employee_name);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON entry_point_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON entry_point_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_source ON entry_point_audit_logs(source_location);

-- RLS Policies
ALTER TABLE entry_point_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins and venue admins to view audit logs
CREATE POLICY "Admins can view all audit logs"
  ON entry_point_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  );

-- Allow admins to insert audit logs
CREATE POLICY "Admins can insert audit logs"
  ON entry_point_audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('ADMIN', 'VENUE_ADMIN')
    )
  );

-- Comments
COMMENT ON TABLE entry_point_audit_logs IS 'Audit trail for all entry point actions';
COMMENT ON COLUMN entry_point_audit_logs.action_type IS 'Type of action performed';
COMMENT ON COLUMN entry_point_audit_logs.entry_point_id IS 'ID of the entry point affected';
COMMENT ON COLUMN entry_point_audit_logs.source_location IS 'Where the action was performed (e.g., Command Center, Mobile App)';
COMMENT ON COLUMN entry_point_audit_logs.old_values IS 'Previous values before change';
COMMENT ON COLUMN entry_point_audit_logs.new_values IS 'New values after change';
COMMENT ON COLUMN entry_point_audit_logs.metadata IS 'Additional context about the action';
