import { expect } from '@playwright/test';

/**
 * Seed a game straight into localStorage through the app's own model, so specs
 * can start from a specific mid-game state without clicking through setup.
 */
export async function seedGame(page, { name = 'Test game', players, plan, cfg = {}, settings = {} } = {}) {
  await page.goto('/');
  const id = await page.evaluate(
    async ({ name, players, plan, cfg, settings }) => {
      const M = await import('/src/model.js');
      const game = M.createGame({
        name,
        players: players.map((n) => ({ name: n })),
        plan,
        cfg,
      });
      localStorage.setItem(`escalier:v2:game:${game.id}`, JSON.stringify(game));
      localStorage.setItem(
        'escalier:v2:settings',
        JSON.stringify({ lang: 'en', theme: 'light', lastGameId: game.id, chartMode: 'cumulative', ...settings })
      );
      return game.id;
    },
    { name, players, plan, cfg, settings }
  );
  await page.reload();
  return id;
}

/** Record a whole round by tapping chips: bids, lock, tricks, record. */
export async function playRound(page, bids, tricks) {
  for (let i = 0; i < bids.length; i += 1) await pickChip(page, i, bids[i]);
  const primary = page.locator('.dock .btn--primary');
  await expect(primary).toBeEnabled();
  await primary.click();
  for (let i = 0; i < tricks.length; i += 1) await pickChip(page, i, tricks[i]);
  await expect(primary).toBeEnabled();
  await primary.click();
}

/** Tap value `n` on the nth player card of the current round. */
export async function pickChip(page, entryIndex, n) {
  await page
    .locator('.entry')
    .nth(entryIndex)
    .locator('.chip', { hasText: new RegExp(`^${n}$`) })
    .click();
}

/** Player names in the order the current round asks for them. */
export function entryNames(page) {
  return page.locator('.entry__name').allTextContents();
}

export function tab(page, label) {
  return page.locator('.tab', { hasText: label });
}

export async function openMenu(page) {
  await page.locator('.topbar .iconbtn').last().click();
  await expect(page.locator('.sheet__panel')).toBeVisible();
}

export function backButton(page) {
  return page.locator('.topbar .iconbtn').first();
}
