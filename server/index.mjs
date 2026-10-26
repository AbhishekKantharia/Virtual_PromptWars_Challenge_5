// ============================================================
// EventWise AI — production static server + optional AI endpoint
// Run after `npm run build` with `npm run serve`.
// API credentials are read from server-side environment variables only.
// ============================================================

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  callProvider,
  createRateLimiter,
  readBody,
  validateAiRequest,
  MAX_BODY_BYTES,
} from './ai.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_ROOT = resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const API_ONLY = process.argv.includes('--api-only');

const API_PATH = '/api/ai/recommendations';
const checkRateLimit = createRateLimiter({ limit: 6, windowMs: 60_000 });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

const server = createServer(async (req, res) => {
  applySecurityHeaders(res);

  let pathname;
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendJson(res, 400, { error: 'Invalid request URL.' });
    return;
  }

  if (pathname === API_PATH) {
    await handleApi(req, res);
    return;
  }

  if (API_ONLY) {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  await serveStatic(pathname, res);
});

async function handleApi(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    sendJson(res, 415, { error: 'Content-Type must be application/json.' });
    return;
  }

  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    sendJson(res, 413, { error: 'Request body is too large.' });
    return;
  }

  const clientKey = req.socket.remoteAddress || 'unknown';
  const limit = checkRateLimit(clientKey);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    sendJson(res, 429, { error: 'Too many AI requests. Try again shortly.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    const status = error && typeof error === 'object' && error.status === 413 ? 413 : 400;
    sendJson(res, status, {
      error: status === 413 ? 'Request body is too large.' : 'Could not read the request body.',
    });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    return;
  }

  const validation = validateAiRequest(parsed);
  if (!validation.ok) {
    sendJson(res, 400, {
      error: 'The event request was invalid.',
      fields: validation.errors.slice(0, 10),
    });
    return;
  }

  const result = await callProvider(validation.value);
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error });
    return;
  }

  sendJson(res, 200, { recommendations: result.recommendations });
}

async function serveStatic(pathname, res) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const candidate = resolve(DIST_ROOT, `.${requested}`);

  if (candidate !== DIST_ROOT && !candidate.startsWith(`${DIST_ROOT}${sep}`)) {
    sendJson(res, 400, { error: 'Invalid path.' });
    return;
  }

  try {
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    await sendFile(candidate, res);
    return;
  } catch {
    // Single-page app fallback for non-asset paths.
    if (!extname(requested)) {
      try {
        await sendFile(resolve(DIST_ROOT, 'index.html'), res, true);
        return;
      } catch {
        // Fall through to a helpful error.
      }
    }
  }

  sendJson(
    res,
    404,
    {
      error: 'Build output not found. Run `npm run build` first, then `npm run serve`.',
    }
  );
}

async function sendFile(filePath, res, isFallback = false) {
  const content = await readFile(filePath);
  const extension = extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[extension] ?? 'application/octet-stream');
  res.setHeader(
    'Cache-Control',
    extension === '.html' || isFallback ? 'no-cache' : 'public, max-age=31536000, immutable'
  );
  res.end(content);
}

function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

server.listen(PORT, HOST, () => {
  const mode = API_ONLY ? 'AI API only' : 'app + AI API';
  console.log(`EventWise AI ${mode} listening on http://${HOST}:${PORT}`);
  if (!process.env.AI_API_KEY) {
    console.log('AI provider is not configured. Deterministic recommendations remain fully available.');
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
