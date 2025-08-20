-- Create file_storage table for storing documents in production
-- This replaces filesystem storage in Cloud Run

CREATE TABLE IF NOT EXISTS file_storage (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_content TEXT NOT NULL, -- Base64 encoded file content
  file_size INTEGER NOT NULL,
  file_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key to deals table
  CONSTRAINT fk_file_storage_deal
    FOREIGN KEY (deal_id) 
    REFERENCES deals(id) 
    ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX idx_file_storage_deal_id ON file_storage(deal_id);
CREATE INDEX idx_file_storage_created_at ON file_storage(created_at);

-- Add comment explaining the purpose
COMMENT ON TABLE file_storage IS 'Stores file content in database for Cloud Run production deployment where filesystem is ephemeral';