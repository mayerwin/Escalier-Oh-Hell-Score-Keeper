import { expect, test } from '@playwright/test';
import { entryNames, pickChip, playRound, seedGame, tab } from './helpers.js';

const PLAYERS = ['Ana', 'Ben', 'Cleo', 'Dov'];

test.beforeEach(async ({ page }) => {
  await seedGame(page, { players: PLAYERS, plan: [3, 2, 1], cfg: { banFrom: 3 } });
});

test('a round is entered in two phases, dealer last', async ({ page }) => {
  await expect(page.locator('.cardcount__n')).toHaveText('3');

  // Ana deals the first hand, so Ben opens and Ana speaks last.
  expect(await entryNames(page)).toEqual(['Ben', 'Cleo', 'Dov', 'Ana']);
  await expect(page.locator('.entry').last().locator('.badge--dealer')).toBeVisible();
  await expect(page.locator('.entry').first().locator('.badge--lead')).toBeVisible();

  const primary = page.locator('.dock .btn--primary');
  await expect(primary).toBeDisabled();
  await expect(page.locator('.phase[aria-current="step"]')).toContainText('Bids');

  await pickChip(page, 0, 1);
  await pickChip(page, 1, 1);
  await pickChip(page, 2, 0);
  await expect(primary).toBeDisabled();

  await pickChip(page, 3, 2);
  await expect(primary).toBeEnabled();
  await primary.click();

  await expect(page.locator('.phase[aria-current="step"]')).toContainText('Tricks');
  await expect(primary).toBeDisabled();
});

test('the dealer cannot make the bids total the tricks', async ({ page }) => {
  await pickChip(page, 0, 1);
  await pickChip(page, 1, 1);
  await pickChip(page, 2, 0);

  // 2 of 3 tricks are spoken for, so the dealer is barred from bidding 1.
  const forbidden = page.locator('.entry').last().locator('.chip.is-forbidden');
  await expect(forbidden).toHaveCount(1);
  await expect(forbidden).toHaveText('1');
  await expect(forbidden).toBeDisabled();
});

test('the rule can be switched off in settings', async ({ page }) => {
  await seedGame(page, { players: PLAYERS, plan: [3], cfg: { banFrom: 0 } });
  await pickChip(page, 0, 1);
  await pickChip(page, 1, 1);
  await pickChip(page, 2, 0);
  await expect(page.locator('.entry').last().locator('.chip.is-forbidden')).toHaveCount(0);
});

test('tricks must add up before a round can be recorded', async ({ page }) => {
  await pickChip(page, 0, 1);
  await pickChip(page, 1, 1);
  await pickChip(page, 2, 0);
  await pickChip(page, 3, 2);
  const primary = page.locator('.dock .btn--primary');
  await primary.click();

  await pickChip(page, 0, 1);
  await pickChip(page, 1, 1);
  await expect(page.locator('.status')).toContainText('1 trick still to place');
  await expect(primary).toBeDisabled();

  await pickChip(page, 2, 1);
  await pickChip(page, 3, 1);
  await expect(page.locator('.status')).toContainText('too many');
  await expect(primary).toBeDisabled();

  await pickChip(page, 3, 0);
  await expect(primary).toBeEnabled();
});

test('recording a round passes the deal and updates the standings', async ({ page }) => {
  await playRound(page, [1, 1, 0, 2], [1, 1, 0, 1]);

  // Round 2: the deal moves from Ana to Ben, so Cleo now opens.
  expect(await entryNames(page)).toEqual(['Cleo', 'Dov', 'Ana', 'Ben']);
  await expect(page.locator('.cardcount__n')).toHaveText('2');

  await tab(page, 'Standings').click();
  const scores = await page.locator('.board__score').allTextContents();
  const total = scores.map((s) => Number(s.trim())).reduce((a, b) => a + b, 0);
  // Ben 1/1 = +10, Cleo 1/1 = +10, Dov 0/0 = +5, Ana 2/1 = -5.
  expect(total).toBe(20);
  // Ben and Cleo tie on 10; ties are ordered by seat, so Ben leads and Ana,
  // who overbid, is last.
  await expect(page.locator('.board__row').first()).toContainText('Ben');
  await expect(page.locator('.board__row').last()).toContainText('Ana');
});

test('a bid of zero is a real bid, not an empty one', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [1], cfg: { banFrom: 0 } });
  const primary = page.locator('.dock .btn--primary');
  await pickChip(page, 0, 0);
  await expect(primary).toBeDisabled();
  await pickChip(page, 1, 0);
  await expect(primary).toBeEnabled();
});

test('a large hand stays enterable and lockable', async ({ page }) => {
  // Regression: hands over 15 cards once fell back to a stepper that could not
  // express a bid of zero, so the round could never be locked.
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [26], cfg: { banFrom: 3 } });
  await expect(page.locator('.entry').first().locator('.chip')).toHaveCount(27);

  await pickChip(page, 0, 0);
  await pickChip(page, 1, 5);
  await expect(page.locator('.dock .btn--primary')).toBeEnabled();
});

test('a player can sit a round out and is excluded from the count', async ({ page }) => {
  await page.locator('.entry').first().locator('.iconbtn').click();
  await page.locator('.sheet__action', { hasText: 'Sit out this round' }).click();
  await expect(page.locator('.entry').first()).toContainText('Sitting out');

  await pickChip(page, 1, 1);
  await pickChip(page, 2, 1);
  await pickChip(page, 3, 0);
  await expect(page.locator('.dock .btn--primary')).toBeEnabled();
});

test('a player who leaves the table keeps what they scored', async ({ page }) => {
  await playRound(page, [1, 1, 0, 2], [1, 1, 0, 1]);
  await tab(page, 'Standings').click();

  const scoreOf = async (name) =>
    (await page.locator('.board__row', { hasText: name }).locator('.board__score').innerText()).trim();
  const before = await scoreOf('Ben');
  expect(Number(before)).toBe(10);

  await page.locator('.btn', { hasText: 'Manage players' }).click();
  await page.locator('.board__row', { hasText: 'Ben' }).locator('.btn', { hasText: 'Edit' }).click();
  await page.locator('.sheet__action', { hasText: 'Sit out the rest' }).click();
  await page.locator('.btn', { hasText: 'Sit out the rest' }).last().click();

  await page.locator('.btn', { hasText: 'Done' }).first().click();
  await expect(page.locator('.board__row', { hasText: 'Ben' })).toContainText('withdrawn');
  expect(await scoreOf('Ben')).toBe(before);

  // And they are out of the round still to play, without breaking it.
  await tab(page, 'Round').click();
  await expect(page.locator('.entry', { hasText: 'Ben' })).toContainText('Sitting out');
});

test('reopening a round does not make the standings dip', async ({ page }) => {
  await playRound(page, [1, 1, 0, 2], [1, 1, 0, 1]);
  await playRound(page, [1, 1, 0, 0], [1, 1, 0, 0]);
  await tab(page, 'Standings').click();

  const totals = async () =>
    (await page.locator('.board__score').allTextContents()).map((s) => Number(s.trim())).reduce((a, b) => a + b, 0);
  const before = await totals();

  await page.locator('.hist').first().click();
  await page.locator('.btn', { hasText: 'Edit' }).click();
  await tab(page, 'Standings').click();

  expect(await totals()).toBe(before);
});

test('an earlier round can be reopened, and says so while it is being corrected', async ({ page }) => {
  await playRound(page, [1, 1, 0, 2], [1, 1, 0, 1]);
  await playRound(page, [1, 1, 0, 0], [1, 1, 0, 0]);

  await tab(page, 'Standings').click();
  await page.locator('.hist').first().click();

  // Reopening a round with later rounds already recorded asks first.
  await expect(page.locator('.sheet__panel').last()).toContainText('Reopen round 1');
  await page.locator('.btn', { hasText: 'Edit' }).click();

  await expect(page.locator('.roundhead__title')).toContainText('Round 1');
  await expect(page.locator('.status').first()).toContainText('Correcting round 1');
});
