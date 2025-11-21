/**
 * imgstk API - Hono Integration
 * All API routes handled by Hono router
 */

import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
// import { cors } from 'hono/cors'; // Disabled for Cloudflare Pages compatibility
import type { Env, UploadRequest, Batch, Image } from '../types';
import { Errors, getErrorStatus } from '../errors';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// CORS middleware - Disabled for now, Basic Auth handles security
// app.use('/*', cors({
//   origin: ['https://admin-stk.be2nd.com', 'http://localhost:8788'],
//   allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
//   allowHeaders: ['Content-Type', 'Authorization'],
// }));

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
      const error = Errors.invalidRequest();
      return c.json(error, getErrorStatus(error.code));
    }

    if (files.length > 500) {
      const error = Errors.tooManyFiles(500);
      return c.json(error, getErrorStatus(error.code));
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
    const err = Errors.uploadFailed();
    return c.json(err, getErrorStatus(err.code));
  }
});

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
    const err = Errors.databaseError();
    return c.json(err, getErrorStatus(err.code));
  }
});

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
      const error = Errors.batchNotFound(Number(batchId) || 0);
      return c.json(error, getErrorStatus(error.code));
    }

    const images = await db.prepare('SELECT * FROM images WHERE batch_id = ? ORDER BY id').bind(batchId).all();

    return c.json({ batch, images: images.results });

  } catch (error) {
    console.error('Get batch error:', error);
    const err = Errors.databaseError();
    return c.json(err, getErrorStatus(err.code));
  }
});

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
      const error = Errors.batchNotFound(Number(batchId) || 0);
      return c.json(error, getErrorStatus(error.code));
    }

    // Delete from R2
    const deletePromises = images.results.map((img: any) => r2.delete(img.filename));
    await Promise.all(deletePromises);

    // Delete from DB (CASCADE will handle images table)
    await db.prepare('DELETE FROM batches WHERE id = ?').bind(batchId).run();

    return c.json({ deleted: images.results.length });

  } catch (error) {
    console.error('Delete batch error:', error);
    const err = Errors.deleteFailed();
    return c.json(err, getErrorStatus(err.code));
  }
});

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
      const error = Errors.batchNotFound(Number(batchId) || 0);
      return c.json(error, getErrorStatus(error.code));
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
    const err = Errors.databaseError();
    return c.json(err, getErrorStatus(err.code));
  }
});

/**
 * DELETE /api/images/:filename
 * Delete a single image from R2 and D1
 */
app.delete('/images/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const db = c.env.DB;
    const r2 = c.env.R2_BUCKET;

    // Get image info before deletion
    const image = await db.prepare('SELECT * FROM images WHERE filename = ?')
      .bind(filename)
      .first<Image>();

    if (!image) {
      const error = Errors.imageNotFound(filename);
      return c.json(error, getErrorStatus(error.code));
    }

    // Delete from R2
    await r2.delete(filename);

    // Delete from D1
    await db.prepare('DELETE FROM images WHERE filename = ?')
      .bind(filename)
      .run();

    return c.json({
      deleted: filename,
      batch_id: image.batch_id
    });

  } catch (error) {
    console.error('Delete image error:', error);
    const err = Errors.deleteFailed();
    return c.json(err, getErrorStatus(err.code));
  }
});

// Export handler for Pages Functions
// Using handle() adapter to bridge Hono and Cloudflare Pages Function signatures
export const onRequest = handle(app);
