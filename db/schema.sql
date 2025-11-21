-- imgstk Database Schema
-- Created: 2025-11-21
-- Purpose: Metadata management for imgstk CDN

-- Sequence table: Global counter for image numbering
CREATE TABLE IF NOT EXISTS sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize sequence
INSERT OR IGNORE INTO sequence (id, current_number, updated_at)
VALUES (1, 0, datetime('now'));

-- Batches table: Batch upload sessions
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,                -- UUID
  title TEXT NOT NULL,                -- 'Plant Observation 2025-11-21'
  uploaded_at TEXT NOT NULL,          -- ISO8601 timestamp
  image_count INTEGER NOT NULL,       -- Total images in this batch
  first_id INTEGER NOT NULL,          -- First image ID (e.g., 1)
  last_id INTEGER NOT NULL,           -- Last image ID (e.g., 100)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_batches_uploaded_at ON batches(uploaded_at);

-- Images table: Individual image metadata
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY,             -- Sequential ID (1, 2, 3...)
  batch_id TEXT NOT NULL,             -- FK to batches
  filename TEXT NOT NULL,             -- '00000001.webp'
  url TEXT NOT NULL,                  -- 'https://stk.be2nd.com/00000001.webp'
  original_filename TEXT,             -- Original filename from upload
  bytes INTEGER NOT NULL,             -- File size in bytes
  mime TEXT NOT NULL,                 -- MIME type (e.g., 'image/webp')
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_batch_id ON images(batch_id);
CREATE INDEX IF NOT EXISTS idx_images_filename ON images(filename);

-- View: Batch summary with image details
CREATE VIEW IF NOT EXISTS batch_summary AS
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
