-- Migration: 0001_init
-- Created: 2025-11-21
-- Description: Initial schema setup for imgstk

-- Sequence table: Global counter for image numbering
CREATE TABLE sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize sequence
INSERT INTO sequence (id, current_number, updated_at)
VALUES (1, 0, datetime('now'));

-- Batches table: Batch upload sessions
CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  image_count INTEGER NOT NULL,
  first_id INTEGER NOT NULL,
  last_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_batches_uploaded_at ON batches(uploaded_at);

-- Images table: Individual image metadata
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  original_filename TEXT,
  bytes INTEGER NOT NULL,
  mime TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_images_batch_id ON images(batch_id);
CREATE INDEX idx_images_filename ON images(filename);

-- View: Batch summary with image details
CREATE VIEW batch_summary AS
SELECT
  b.id,
  b.title,
  b.uploaded_at,
  b.image_count,
  b.first_id,
  b.last_id,
  printf('%08d', b.first_id) as first_filename,
  printf('%08d', b.last_id) as last_filename,
  SUM(i.bytes) as total_bytes
FROM batches b
LEFT JOIN images i ON b.id = i.batch_id
GROUP BY b.id
ORDER BY b.uploaded_at DESC;
