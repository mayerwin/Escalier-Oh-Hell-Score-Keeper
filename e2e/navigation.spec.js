import { expect, test } from '@playwright/test';
import { backButton, openMenu, seedGame, tab } from './helpers.js';

test('with no game open, the back arrow is the only way out of settings — and it works', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tab').first()).toBeDisabled();

  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  await expect(page.locator('#main')).toContainText('Language');

  await expect(backButton(page)).toHaveAttribute('aria-label', 'Back');
  await expect(page.locator('.topbar__game')).toContainText('Settings');

  await backButton(page).click();
  await expect(page.locator('#main')).toContainText('My games');
});

test('Escape backs out of a stacked screen', async ({ page }) => {
  await page.goto('/');
  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  await expect(page.locator('#main')).toContainText('Language');

  await page.keyboard.press('Escape');
  await expect(page.locator('#main')).toContainText('My games');
});

test('Escape closes a sheet without also navigating away', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await openMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet__panel')).toHaveCount(0);
  // Still on the round, not bounced somewhere else.
  await expect(page.locator('.roundhead__title')).toBeVisible();
});

test('settings returns to the tab you came from', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await tab(page, 'Standings').click();
  await expect(page.locator('.board__row').first()).toBeVisible();

  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  await backButton(page).click();
  await expect(page.locator('.board__row').first()).toBeVisible();
});

test('the button at the foot of settings goes back too', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await tab(page, 'Curve').click();

  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  // "Back", not "Done": nothing is being committed, settings save as you make them.
  await page.locator('#main .btn--block', { hasText: 'Back' }).last().click();
  await expect(page.locator('.tab[data-selected="true"]')).toContainText('Curve');
});

test('the theme options are named plainly', async ({ page }) => {
  await page.goto('/');
  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  const themeSeg = page.locator('.seg').filter({ hasText: 'Light' });
  await expect(themeSeg.locator('button')).toHaveText(['Auto', 'Light', 'Dark']);
});

test('the library is escapable mid-game', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'My games' }).click();
  await expect(page.locator('#main')).toContainText('New game');

  await backButton(page).click();
  await expect(page.locator('.roundhead__title')).toBeVisible();
});

test('tabs are lateral and do not accumulate a back trail', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await tab(page, 'Staircase').click();
  await tab(page, 'Curve').click();

  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  await backButton(page).click();

  // Back lands on the tab last used, not the one before it.
  await expect(page.locator('.tab[data-selected="true"]')).toContainText('Curve');
});

test('cancelling setup returns you where you started', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await openMenu(page);
  await page.locator('.sheet__action', { hasText: 'My games' }).click();
  await page.locator('.btn', { hasText: 'New game' }).click();
  await expect(page.locator('#main')).toContainText('Players');

  await page.locator('.btn', { hasText: 'Cancel' }).click();
  await expect(page.locator('#main')).toContainText('New game');
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the menu opens as a centred dialog, not a bottom sheet', async ({ page }) => {
    await page.goto('/');
    await openMenu(page);

    const panel = await page.locator('.sheet__panel').boundingBox();
    const centre = panel.y + panel.height / 2;
    // Vertically centred in the viewport rather than pinned to the bottom.
    expect(Math.abs(centre - 450)).toBeLessThan(90);
    expect(panel.width).toBeLessThanOrEqual(500);
    // The drag grip is a touch affordance and should not be shown.
    await expect(page.locator('.sheet__grip')).toBeHidden();
  });
});
