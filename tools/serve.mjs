/**
 * Minimal static server for local development.
 *
 * Exists so the app can be exercised over http://localhost, which is what the
 * service worker needs; opening index.html off the filesystem works but never
 * registers one.
 *
 *   node tools/serve.mjs [port]
 */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const PORT = Number(args.find((a) => /^\d+$/.test(a))) || 8000;

/**
 * Serve under a sub-path and with a real `max-age`, so the two failure modes
 * that only production exhibits can actually be reproduced locally: the app
 * living at a GitHub Pages project path, and a short-lived HTTP cache that
 * could otherwise poison the service worker's precache.
 */
const BASE = (() => {
  const value = flag('base', '/');
  return value.endsWith('/') ? value : `${value}/`;
})();
const MAX_AGE = Number(flag('max-age', '0'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (BASE !== '/') {
    if (pathname === BASE.slice(0, -1)) {
      res.writeHead(301, { Location: BASE }).end();
      return;
    }
    if (!pathname.startsWith(BASE)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    pathname = pathname.slice(BASE.length - 1);
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  // Contain the served tree: no amount of ../ escapes the repo root.
  const target = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stats;
  try {
    stats = statSync(target);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  if (stats.isDirectory()) {
    res.writeHead(301, { Location: `${pathname}/` }).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stats.size,
    // Development defaults to always revalidating, since a cached module is
    // only confusing; `--max-age` opts in to imitating GitHub Pages.
    'Cache-Control': MAX_AGE > 0 ? `max-age=${MAX_AGE}` : 'no-cache',
    'Service-Worker-Allowed': BASE,
  });
  createReadStream(target).pipe(res);
});

server.listen(PORT, () => {
  process.stdout.write(`L'Escalier serving ${ROOT}\n  http://localhost:${PORT}/\n`);
});
