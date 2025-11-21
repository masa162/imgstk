/**
 * Type definitions for imgstk
 */

export interface Env {
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  BASIC_AUTH_USER: string;
  BASIC_AUTH_PASS: string;
}

export interface Batch {
  id: string;
  title: string;
  uploaded_at: string;
  image_count: number;
  first_id: number;
  last_id: number;
  created_at: string;
}

export interface Image {
  id: number;
  batch_id: string;
  filename: string;
  url: string;
  original_filename: string | null;
  bytes: number;
  mime: string;
  uploaded_at: string;
}

export interface BatchSummary extends Batch {
  first_filename: string;
  last_filename: string;
  total_bytes: number;
}

export interface UploadRequest {
  batchTitle: string;
  files: UploadFile[];
}

export interface UploadFile {
  name: string;
  data: string; // Base64 encoded
  size: number;
  type: string;
}

export interface UploadResponse {
  batch: Batch;
  images: Image[];
}
