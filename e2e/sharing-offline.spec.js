import { expect, test } from '@playwright/test';
import { openMenu, playRound, seedGame, tab } from './helpers.js';

const PLAYERS = ['Ana', 'Ben', 'Cleo', 'Dov'];

async function buildShareUrl(page) {
  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Share the game' }).click();
  await expect(page.locator('.wrapword')).toBeVisible();
  const url = (await page.locator('.wrapword').innerText()).trim();
  await page.keyboard.press('Escape');
  // Wait for it to actually be gone. Returning while it is still closing let a
  // later sheet stack on top, so `.sheet__panel` matched two panels and the
  // assertion raced.
  await expect(page.locator('.sheet__panel')).toHaveCount(0);
  return url;
}

test('a whole game travels inside a link and reopens in a clean profile', async ({ page, browser }) => {
  await seedGame(page, { players: PLAYERS, plan: [3, 2, 1], cfg: { banFrom: 3 } });
  await playRound(page, [1, 1, 0, 2], [1, 1, 0, 1]);

  const url = await buildShareUrl(page);
  expect(url).toContain('#g=');
  expect(url.length).toBeLessThan(1800);

  // A different profile: no storage, no service worker, nothing shared but the URL.
  const fresh = await browser.newContext({ viewport: { width: 400, height: 850 }, locale: 'en-GB' });
  const guest = await fresh.newPage();
  const errors = [];
  guest.on('pageerror', (e) => errors.push(e.message));

  await guest.goto(url);
  await expect(guest.locator('.sheet__panel')).toContainText('Ana');
  await guest.locator('.btn', { hasText: 'Add to my games' }).click();

  await expect(guest.locator('.board__row').first()).toBeVisible();
  const scores = await guest.locator('.board__score').allTextContents();
  const total = scores.map((s) => Number(s.trim())).reduce((a, b) => a + b, 0);
  expect(total).toBe(20);
  expect(errors).toEqual([]);

  // The payload is stripped so a refresh does not re-prompt.
  expect(await guest.evaluate(() => location.hash)).toBe('');
  await fresh.close();
});

test('a share link followed in a tab that already has the app open still imports', async ({ page }) => {
  // Only the fragment changes, so no navigation happens and init never runs
  // again — the game would otherwise arrive silently and never be offered.
  await seedGame(page, { players: PLAYERS, plan: [2] });
  const url = await buildShareUrl(page);
  const payload = url.split('#')[1];

  await page.evaluate((frag) => {
    window.location.hash = frag;
  }, payload);

  await expect(page.locator('.sheet__panel')).toContainText('Ana');
  await expect(page.locator('.btn', { hasText: 'Add to my games' })).toBeVisible();
});

test('a damaged link is refused rather than half-imported', async ({ page }) => {
  await page.goto('/#g=Anot-a-real-payload');
  await expect(page.locator('.toast')).toContainText('damaged');
  await expect(page.locator('.sheet__panel')).toHaveCount(0);
});

test('the scores export as CSV', async ({ page }) => {
  await seedGame(page, { players: PLAYERS, plan: [3, 2, 1], cfg: { banFrom: 3 } });
  await playRound(page, [1, 1, 0, 2], [1, 1, 0, 1]);

  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Export the scores' }).click();
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.sheet__action', { hasText: 'Download CSV' }).click(),
  ]).then(([d]) => d);

  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const stream = await download.createReadStream();
  const csv = await new Promise((resolve) => {
    let out = '';
    stream.on('data', (c) => (out += c));
    stream.on('end', () => resolve(out));
  });

  expect(csv).toContain('round,cards,status');
  expect(csv).toContain('Ana');
  // Negative scores must stay importable as numbers, not be quoted as text.
  expect(csv).toMatch(/,-\d+,/);
  expect(csv).not.toContain("'-");
});

test('the app works with the network cut', async ({ page, context }) => {
  await seedGame(page, { players: PLAYERS, plan: [3, 2, 1] });

  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(reg && reg.active);
  });
  // Give the precache a moment to finish populating.
  await page.waitForTimeout(1500);

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('.tabbar__inner')).toBeVisible();
  await expect(page.locator('.roundhead__title')).toBeVisible();
  await tab(page, 'Staircase').click();
  await expect(page.locator('.stairs__step').first()).toBeVisible();

  await context.setOffline(false);
});

test('a first visit through a share link survives the service worker claiming the page', async ({ page, browser }) => {
  // Regression: the worker claiming a first-load page fired controllerchange,
  // which was treated as an update and reloaded — discarding the shared game
  // after its payload had already been stripped from the URL.
  await seedGame(page, { players: PLAYERS, plan: [2] });
  const url = await buildShareUrl(page);

  const fresh = await browser.newContext({ viewport: { width: 400, height: 850 }, locale: 'en-GB' });
  const guest = await fresh.newPage();
  await guest.goto(url);
  await expect(guest.locator('.sheet__panel')).toContainText('Ana');
  // Still there a moment later, i.e. no reload swept it away.
  await guest.waitForTimeout(2500);
  await expect(guest.locator('.sheet__panel')).toContainText('Ana');
  await fresh.close();
});
