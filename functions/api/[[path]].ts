/**
 * imgstk API - Hono Integration
 * All API routes handled by Hono router
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, UploadRequest, Batch, Image } from '../types';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: ['https://admin-stk.be2nd.com', 'http://localhost:8788'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'imgstk-api' });
});

// Diagnostic endpoint
app.get('/debug', (c) => {
  const hasDB = !!c.env.DB;
  const hasR2 = !!c.env.R2_BUCKET;
  const hasAuthUser = !!c.env.BASIC_AUTH_USER;
  const hasAuthPass = !!c.env.BASIC_AUTH_PASS;

  return c.json({
    bindings: {
      DB: hasDB ? 'configured' : 'MISSING',
      R2_BUCKET: hasR2 ? 'configured' : 'MISSING',
    },
    env: {
      BASIC_AUTH_USER: hasAuthUser ? 'configured' : 'MISSING',
      BASIC_AUTH_PASS: hasAuthPass ? 'configured' : 'MISSING',
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get next sequence number (with transaction safety)
 */
async function getNextSequence(db: D1Database, count: number): Promise<number> {
  // Get current sequence
  const result = await db.prepare('SELECT current_number FROM sequence WHERE id = 1').first<{ current_number: number }>();

  if (!result) {
    throw new Error('Sequence not initialized');
  }

  const firstId = result.current_number + 1;
  const lastId = firstId + count - 1;

  // Update sequence
  await db.prepare('UPDATE sequence SET current_number = ?, updated_at = datetime(\'now\') WHERE id = 1')
    .bind(lastId)
    .run();

  return firstId;
}

/**
 * Format number to 8-digit filename
 */
function formatFilename(id: number, extension: string = 'webp'): string {
  return `${String(id).padStart(8, '0')}.${extension}`;
}

/**
 * Generate UUID (simple version)
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * POST /api/upload
 * Batch upload images
 */
app.post('/upload', async (c) => {
  try {
    const body = await c.req.json<UploadRequest>();
    const { batchTitle, files } = body;

    if (!batchTitle || !files || files.length === 0) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    if (files.length > 500) {
      return c.json({ error: 'Too many files (max 500)' }, 400);
    }

    const db = c.env.DB;
    const r2 = c.env.R2_BUCKET;

    // Get next sequence numbers
    const firstId = await getNextSequence(db, files.length);
    const lastId = firstId + files.length - 1;

    // Create batch record
    const batchId = generateUUID();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO batches (id, title, uploaded_at, image_count, first_id, last_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(batchId, batchTitle, now, files.length, firstId, lastId, now).run();

    // Upload files and create image records
    const images: Image[] = [];
    const uploadPromises = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageId = firstId + i;

      // Determine file extension from MIME type
      let ext = 'webp';
      if (file.type.includes('jpeg') || file.type.includes('jpg')) ext = 'jpg';
      else if (file.type.includes('png')) ext = 'png';
      else if (file.type.includes('gif')) ext = 'gif';

      const filename = formatFilename(imageId, ext);
      const url = `https://stk.be2nd.com/${filename}`;

      // Decode base64 data
      const base64Data = file.data.split(',')[1] || file.data;
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Upload to R2
      uploadPromises.push(
        r2.put(filename, binaryData, {
          httpMetadata: {
            contentType: file.type,
          },
        })
      );

      // Insert image record
      await db.prepare(`
        INSERT INTO images (id, batch_id, filename, url, original_filename, bytes, mime, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(imageId, batchId, filename, url, file.name, file.size, file.type, now).run();

      images.push({
        id: imageId,
        batch_id: batchId,
        filename,
        url,
        original_filename: file.name,
        bytes: file.size,
        mime: file.type,
        uploaded_at: now,
      });
    }

    // Wait for all R2 uploads
    await Promise.all(uploadPromises);

    const batch: Batch = {
      id: batchId,
      title: batchTitle,
      uploaded_at: now,
      image_count: files.length,
      first_id: firstId,
      last_id: lastId,
      created_at: now,
    };

    return c.json({ batch, images });

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed', details: String(error) }, 500);
  }

/**
 * GET /api/batches
 * List all batches
 */
app.get('/batches', async (c) => {
  try {
    const db = c.env.DB;

    const result = await db.prepare(`
      SELECT * FROM batch_summary ORDER BY uploaded_at DESC
    `).all();

    return c.json({ batches: result.results });

  } catch (error) {
    console.error('List batches error:', error);
    return c.json({ error: 'Failed to list batches' }, 500);
  }

/**
 * GET /api/batches/:id
 * Get batch details with images
 */
app.get('/batches/:id', async (c) => {
  try {
    const batchId = c.req.param('id');
    const db = c.env.DB;

    const batch = await db.prepare('SELECT * FROM batches WHERE id = ?').bind(batchId).first();

    if (!batch) {
      return c.json({ error: 'Batch not found' }, 404);
    }

    const images = await db.prepare('SELECT * FROM images WHERE batch_id = ? ORDER BY id').bind(batchId).all();

    return c.json({ batch, images: images.results });

  } catch (error) {
    console.error('Get batch error:', error);
    return c.json({ error: 'Failed to get batch' }, 500);
  }

/**
 * DELETE /api/batches/:id
 * Delete batch and all images
 */
app.delete('/batches/:id', async (c) => {
  try {
    const batchId = c.req.param('id');
    const db = c.env.DB;
    const r2 = c.env.R2_BUCKET;

    // Get all images in batch
    const images = await db.prepare('SELECT filename FROM images WHERE batch_id = ?').bind(batchId).all();

    if (!images.results || images.results.length === 0) {
      return c.json({ error: 'Batch not found' }, 404);
    }

    // Delete from R2
    const deletePromises = images.results.map((img: any) => r2.delete(img.filename));
    await Promise.all(deletePromises);

    // Delete from DB (CASCADE will handle images table)
    await db.prepare('DELETE FROM batches WHERE id = ?').bind(batchId).run();

    return c.json({ deleted: images.results.length });

  } catch (error) {
    console.error('Delete batch error:', error);
    return c.json({ error: 'Failed to delete batch' }, 500);
  }

/**
 * POST /api/batches/:id/markdown
 * Generate Markdown for batch
 */
app.post('/batches/:id/markdown', async (c) => {
  try {
    const batchId = c.req.param('id');
    const db = c.env.DB;

    const batch = await db.prepare('SELECT * FROM batches WHERE id = ?').bind(batchId).first<Batch>();

    if (!batch) {
      return c.json({ error: 'Batch not found' }, 404);
    }

    const images = await db.prepare('SELECT * FROM images WHERE batch_id = ? ORDER BY id').bind(batchId).all();

    // Generate Markdown
    let markdown = `<!-- ${batch.title} (${batch.image_count}枚) -->\n`;

    for (const img of images.results as Image[]) {
      markdown += `![](${img.url})\n`;
    }

    return c.json({ markdown });

  } catch (error) {
    console.error('Generate markdown error:', error);
    return c.json({ error: 'Failed to generate markdown' }, 500);
  }
});

// Export handler for Pages Functions
export const onRequest = app.fetch;
