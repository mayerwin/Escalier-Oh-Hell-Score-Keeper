/**
 * The two failure modes that only production exhibits.
 *
 * The app is served from a GitHub Pages *project* path, not a domain root, and
 * every asset comes back with a short `max-age`. Both broke the app in ways no
 * root-served, no-cache test could ever see, so this spec runs its own server
 * configured the way Pages actually behaves.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// A port of its own: the shared dev server and other specs use 8000.
const PORT = 8347;
const BASE = '/Escalier-Oh-Hell-Score-Keeper/';
const ORIGIN = `http://localhost:${PORT}`;
const APP = `${ORIGIN}${BASE}`;

// One worker, in order: these tests share a single server on a fixed port, and
// the suite is otherwise fully parallel, which would have several workers race
// to bind it and kill it out from under each other.
test.describe.configure({ mode: 'serial' });

let server;

test.beforeAll(async () => {
  server = spawn(
    process.execPath,
    ['tools/serve.mjs', String(PORT), `--base=${BASE}`, '--max-age=600'],
    { cwd: ROOT, stdio: 'ignore' }
  );
  // Wait for it to answer rather than sleeping a fixed amount.
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      const res = await fetch(APP);
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error('subpath server did not start');
    await new Promise((r) => setTimeout(r, 100));
  }
});

test.afterAll(() => {
  if (server) server.kill();
});

test.use({ baseURL: APP });

test('the app boots from a project subpath', async ({ page }) => {
  const failures = [];
  page.on('requestfailed', (r) => failures.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(APP);
  await expect(page.locator('#main')).toContainText('My games');
  expect(failures.filter((f) => !/favicon/i.test(f))).toEqual([]);
});

test('the service worker takes the subpath as its scope and serves offline', async ({ page, context }) => {
  await page.goto(APP);

  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  expect(scope).toBe(APP);

  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.tabbar__inner')).toBeVisible();
  await context.setOffline(false);
});

test('the precache holds the current bytes even behind a max-age', async ({ page }) => {
  // The trap this guards: cache.addAll reads through the HTTP cache, so a
  // freshly named cache could be filled with the previous release's bodies.
  await page.goto(APP);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(1500);

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names[0]);
    const keys = await cache.keys();
    const entry = keys.find((k) => k.url.includes('/src/version.js'));
    if (!entry) return null;
    const response = await cache.match(entry);
    return { url: entry.url, body: await response.text() };
  });

  expect(cached, 'version.js should be precached').not.toBeNull();
  // Content-addressed: the cache key carries the hash, not a release number.
  expect(cached.url).toMatch(/\/src\/version\.js\?v=[0-9a-f]{10}$/);

  const live = await (await fetch(`${APP}src/version.js`)).text();
  expect(cached.body).toBe(live);
});

test('a deep path lands on the app rather than a blank page', async ({ page }) => {
  await page.goto(APP);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(1000);

  await page.goto(`${APP}some/deep/path`);
  await expect(page).toHaveURL(APP);
  await expect(page.locator('#main')).toContainText('My games');
});
