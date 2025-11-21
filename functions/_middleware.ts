/**
 * Middleware for Cloudflare Pages Functions
 * Handles Basic Authentication for all routes
 */

import type { PagesFunction, EventContext } from '@cloudflare/workers-types';
import type { Env } from './types';

// Basic Auth middleware
const basicAuth: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Check Basic Auth header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // For API routes, return JSON error
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="imgstk Admin"',
          'Content-Type': 'application/json',
        },
      });
    }
    // For other routes (HTML), return standard 401
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgstk Admin"',
        'Content-Type': 'text/html',
      },
    });
  }

  // Decode credentials
  const base64Credentials = authHeader.slice(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');

  // Verify credentials
  if (username !== env.BASIC_AUTH_USER || password !== env.BASIC_AUTH_PASS) {
    // For API routes, return JSON error
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="imgstk Admin"',
          'Content-Type': 'application/json',
        },
      });
    }
    // For other routes (HTML), return standard 401
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgstk Admin"',
        'Content-Type': 'text/html',
      },
    });
  }

  // Continue to next handler
  return next();
};

export const onRequest = [basicAuth];
