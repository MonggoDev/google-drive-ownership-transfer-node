-- Migration: 004_create_audit_logs.sql
-- Description: Create audit_logs table for comprehensive security and operation logging

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES transfer_sessions(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);

-- Add comments
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for security and debugging';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (login, transfer, etc.)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (user, file, session)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_logs.details IS 'Additional action details in JSON format';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the request origin';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request'; 