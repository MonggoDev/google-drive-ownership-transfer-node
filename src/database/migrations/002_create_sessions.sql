-- Migration: 002_create_sessions.sql
-- Description: Create session tables for transfer sessions and OAuth flow

-- Create transfer_sessions table
CREATE TABLE transfer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    sender_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'authenticated', 'file_selected', 'transferring', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    metadata JSONB
);

-- Create oauth_sessions table
CREATE TABLE oauth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(255) NOT NULL,
    code_verifier VARCHAR(255),
    redirect_uri TEXT,
    scope TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false
);

-- Create indexes for transfer_sessions
CREATE INDEX idx_transfer_sessions_token ON transfer_sessions(session_token);
CREATE INDEX idx_transfer_sessions_sender ON transfer_sessions(sender_user_id);
CREATE INDEX idx_transfer_sessions_receiver ON transfer_sessions(receiver_user_id);
CREATE INDEX idx_transfer_sessions_status ON transfer_sessions(status);
CREATE INDEX idx_transfer_sessions_expires ON transfer_sessions(expires_at);

-- Create indexes for oauth_sessions
CREATE INDEX idx_oauth_sessions_token ON oauth_sessions(session_token);
CREATE INDEX idx_oauth_sessions_user ON oauth_sessions(user_id);
CREATE INDEX idx_oauth_sessions_expires ON oauth_sessions(expires_at);
CREATE INDEX idx_oauth_sessions_state ON oauth_sessions(state);

-- Create triggers for updated_at
CREATE TRIGGER update_transfer_sessions_updated_at 
    BEFORE UPDATE ON transfer_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE transfer_sessions IS 'Manages transfer sessions between sender and receiver';
COMMENT ON COLUMN transfer_sessions.session_token IS 'Unique token for identifying the transfer session';
COMMENT ON COLUMN transfer_sessions.status IS 'Current status of the transfer session';
COMMENT ON COLUMN transfer_sessions.metadata IS 'Additional session data in JSON format';

COMMENT ON TABLE oauth_sessions IS 'Manages OAuth flow sessions for secure authentication';
COMMENT ON COLUMN oauth_sessions.state IS 'OAuth state parameter for CSRF protection';
COMMENT ON COLUMN oauth_sessions.code_verifier IS 'PKCE code verifier for enhanced security'; 