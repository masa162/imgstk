/**
 * imgstk Worker - CDN Delivery
 * Purpose: Serve images from R2 with optimal caching
 */

interface Env {
  R2_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/healthz') {
      return new Response('OK', { status: 200 });
    }

    // Extract filename from path (e.g., /00000001.webp)
    const filename = url.pathname.slice(1); // Remove leading '/'

    // Validate filename format (8 digits + .webp extension)
    const filenamePattern = /^\d{8}\.(webp|jpg|jpeg|png|gif)$/i;
    if (!filenamePattern.test(filename)) {
      return new Response('Invalid filename format', { status: 400 });
    }

    try {
      // Fetch object from R2
      const object = await env.R2_BUCKET.get(filename);

      if (!object) {
        return new Response('Not Found', { status: 404 });
      }

      // Set response headers for optimal CDN delivery
      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('ETag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      // CORS headers
      const origin = request.headers.get('Origin');
      if (origin && origin.includes('be2nd.com')) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      }

      // Handle OPTIONS request for CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
      }

      // Check if client has cached version (ETag matching)
      const ifNoneMatch = request.headers.get('If-None-Match');
      if (ifNoneMatch === object.httpEtag) {
        return new Response(null, { status: 304, headers });
      }

      // Return the image
      return new Response(object.body, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('Error fetching from R2:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
