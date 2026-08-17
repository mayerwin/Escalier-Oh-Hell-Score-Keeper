import { expect, test } from '@playwright/test';
import { openMenu } from './helpers.js';

/** Put a roster straight into settings, so specs start from a known list. */
async function seedRoster(page, roster) {
  await page.goto('/');
  await page.evaluate((roster) => {
    localStorage.setItem(
      'escalier:v2:settings',
      JSON.stringify({ lang: 'en', theme: 'light', lastGameId: null, chartMode: 'cumulative', roster })
    );
  }, roster);
  await page.reload();
}

async function openSettings(page) {
  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  await expect(page.locator('#main')).toContainText('Regular players');
}

async function openSetup(page) {
  await page.locator('.btn', { hasText: 'New game' }).click();
  await expect(page.locator('.seat__input').first()).toBeVisible();
}

const seatValues = (page) => page.locator('.seat__input').evaluateAll((els) => els.map((e) => e.value));
const rosterNames = (page) => page.locator('.roster .seat__input').evaluateAll((els) => els.map((e) => e.value));

test('a name added in settings is remembered and can be made a regular', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);

  const roster = page.locator('.roster');
  await page.locator('input[placeholder="Add a name"]').fill('Ana');
  await page.locator('.rosteradd .btn').click();

  await expect(roster.locator('.seat__input')).toHaveValue('Ana');
  await expect(roster.locator('.rostertick input')).not.toBeChecked();

  // The input is visually hidden behind its own box, exactly like every other
  // checkbox in the app; the label is what a person actually hits.
  await roster.locator('.rostertick').click();
  await expect(roster.locator('.rostertick input')).toBeChecked();

  await page.reload();
  await openSettings(page);
  await expect(page.locator('.rostertick input')).toBeChecked();
});

test('regulars are seated automatically, in roster order', async ({ page }) => {
  await seedRoster(page, [
    { name: 'Zoe', always: true },
    { name: 'Ben', always: false },
    { name: 'Ana', always: true },
  ]);

  await openSetup(page);
  // Two regulars, so two seats — and Zoe before Ana because that is the order
  // the roster is in, not the order the alphabet is in.
  expect(await seatValues(page)).toEqual(['Zoe', 'Ana']);
});

test('an empty roster still opens on four empty seats', async ({ page }) => {
  await page.goto('/');
  await openSetup(page);
  expect(await seatValues(page)).toEqual(['', '', '', '']);
});

test('typing into a seat offers known names, and picking one fills it', async ({ page }) => {
  await seedRoster(page, [
    { name: 'Anabel', always: false },
    { name: 'Ana', always: false },
    { name: 'Ben', always: false },
  ]);

  await openSetup(page);
  const seat = page.locator('.seat__input').first();
  await seat.click();
  await seat.pressSequentially('an');

  const options = page.locator('.suggest__option');
  await expect(options).toHaveText(['Anabel', 'Ana']);

  await options.nth(1).click();
  await expect(seat).toHaveValue('Ana');
  await expect(page.locator('.suggest')).toBeHidden();
});

test('the suggestion list is driven from the keyboard', async ({ page }) => {
  await seedRoster(page, [
    { name: 'Anabel', always: false },
    { name: 'Ana', always: false },
  ]);

  await openSetup(page);
  const seat = page.locator('.seat__input').first();
  await seat.click();
  await seat.pressSequentially('an');
  await expect(page.locator('.suggest__option')).toHaveCount(2);

  await seat.press('ArrowDown');
  await expect(page.locator('.suggest__option').first()).toHaveAttribute('aria-selected', 'true');
  await seat.press('ArrowDown');
  await seat.press('Enter');
  await expect(seat).toHaveValue('Ana');
});

test('someone already at the table is not offered again', async ({ page }) => {
  await seedRoster(page, [
    { name: 'Ana', always: false },
    { name: 'Anabel', always: false },
  ]);

  await openSetup(page);
  await page.locator('.seat__input').nth(0).fill('Ana');
  const second = page.locator('.seat__input').nth(1);
  await second.click();
  await second.pressSequentially('an');

  await expect(page.locator('.suggest__option')).toHaveText(['Anabel']);
});

test('Escape closes the suggestions without leaving the screen', async ({ page }) => {
  await seedRoster(page, [{ name: 'Ana', always: false }]);
  await openSetup(page);

  const seat = page.locator('.seat__input').first();
  await seat.click();
  await seat.pressSequentially('a');
  await expect(page.locator('.suggest__option')).toHaveCount(1);

  await seat.press('Escape');
  await expect(page.locator('.suggest')).toBeHidden();
  // Still on setup: Escape dismissed the popup, not the screen behind it.
  await expect(page.locator('.seat__input').first()).toBeVisible();
});

test('names used in a game are remembered for the next one', async ({ page }) => {
  await page.goto('/');
  await openSetup(page);
  for (const [i, name] of ['Ana', 'Ben', 'Cleo', 'Dov'].entries()) {
    await page.locator('.seat__input').nth(i).fill(name);
  }
  await page.locator('.btn', { hasText: 'Deal the first hand' }).click();
  await expect(page.locator('.entry').first()).toBeVisible();

  await openSettings(page);
  await expect.poll(() => rosterNames(page)).toEqual(['Ana', 'Ben', 'Cleo', 'Dov']);
  // Playing together is not the same as being a regular; nobody was ticked.
  await expect(page.locator('.rostertick input:checked')).toHaveCount(0);
});

test('a name can be dragged up the roster and the new order sticks', async ({ page }) => {
  await seedRoster(page, [
    { name: 'Ana', always: true },
    { name: 'Ben', always: true },
    { name: 'Cleo', always: true },
  ]);
  await openSettings(page);

  const rows = page.locator('.roster .seat');
  await rows.nth(2).locator('.seat__grip').press('ArrowUp');
  await expect.poll(() => rosterNames(page)).toEqual(['Ana', 'Cleo', 'Ben']);

  await page.reload();
  await openSetup(page);
  expect(await seatValues(page)).toEqual(['Ana', 'Cleo', 'Ben']);
});
