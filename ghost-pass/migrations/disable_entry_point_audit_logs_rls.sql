-- Disable RLS on entry_point_audit_logs to allow audit logging from API
-- RLS is causing issues with authenticated users trying to create audit logs

ALTER TABLE entry_point_audit_logs DISABLE ROW LEVEL SECURITY;

-- Drop existing policies since RLS is disabled
DROP POLICY IF EXISTS "Admins can insert audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Allow admins full access to audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON entry_point_audit_logs;
DROP POLICY IF EXISTS "Users can read audit logs" ON entry_point_audit_logs;
