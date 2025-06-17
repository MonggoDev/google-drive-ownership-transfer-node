-- Migration: 003_create_transfers.sql
-- Description: Create file_transfers table for tracking individual file transfer operations

-- Create file_transfers table
CREATE TABLE file_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES transfer_sessions(id) ON DELETE CASCADE,
    google_file_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    original_owner_id UUID REFERENCES users(id),
    new_owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'transferring', 'completed', 'failed', 'skipped')),
    transfer_started_at TIMESTAMP,
    transfer_completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for file_transfers
CREATE INDEX idx_file_transfers_session ON file_transfers(session_id);
CREATE INDEX idx_file_transfers_google_id ON file_transfers(google_file_id);
CREATE INDEX idx_file_transfers_status ON file_transfers(status);
CREATE INDEX idx_file_transfers_owners ON file_transfers(original_owner_id, new_owner_id);
CREATE INDEX idx_file_transfers_created ON file_transfers(created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_file_transfers_updated_at 
    BEFORE UPDATE ON file_transfers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE file_transfers IS 'Tracks individual file transfer operations within a session';
COMMENT ON COLUMN file_transfers.google_file_id IS 'Google Drive file ID';
COMMENT ON COLUMN file_transfers.file_type IS 'MIME type of the file';
COMMENT ON COLUMN file_transfers.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN file_transfers.retry_count IS 'Number of retry attempts for failed transfers';
COMMENT ON COLUMN file_transfers.error_message IS 'Error details if transfer failed'; 