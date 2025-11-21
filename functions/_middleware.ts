/**
 * Middleware for Cloudflare Pages Functions
 * Handles Basic Authentication for API routes
 */

import type { PagesFunction, EventContext } from '@cloudflare/workers-types';
import type { Env } from './types';

// Basic Auth middleware
const basicAuth: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Skip auth for non-API routes (static files)
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  // Check Basic Auth header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgstk Admin"',
      },
    });
  }

  // Decode credentials
  const base64Credentials = authHeader.slice(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');

  // Verify credentials
  if (username !== env.BASIC_AUTH_USER || password !== env.BASIC_AUTH_PASS) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgstk Admin"',
      },
    });
  }

  // Continue to next handler
  return next();
};

export const onRequest = [basicAuth];
