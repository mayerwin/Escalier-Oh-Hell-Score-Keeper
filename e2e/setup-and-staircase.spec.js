import { expect, test } from '@playwright/test';
import { entryNames, seedGame, tab } from './helpers.js';

async function startSetup(page, names) {
  await page.goto('/');
  await page.locator('.btn', { hasText: 'New game' }).click();
  await expect(page.locator('.seat__input').first()).toBeVisible();
  for (let i = 0; i < names.length; i += 1) await page.locator('.seat__input').nth(i).fill(names[i]);
}

const dealSummary = (page) => page.locator('.dealsummary');

test('the designated dealer survives a reorder and a removal', async ({ page }) => {
  // Regression: the first dealer used to be stored as a seat index, so moving
  // or removing players silently handed the deal to somebody else.
  await startSetup(page, ['Ana', 'Ben', 'Cleo', 'Dov']);

  await page.locator('.seat').nth(2).locator('.dealerpick').click();
  await expect(dealSummary(page)).toContainText('Cleo deals');
  await expect(dealSummary(page)).toContainText('Dov opens');

  // Move Ana below Ben, from the keyboard.
  await page.locator('.seat').nth(0).locator('.seat__grip').press('ArrowDown');
  const names = await page.locator('.seat__input').evaluateAll((els) => els.map((e) => e.value));
  expect(names).toEqual(['Ben', 'Ana', 'Cleo', 'Dov']);
  await expect(dealSummary(page)).toContainText('Cleo deals');

  // Remove Ben, who is now first.
  await page.locator('.seat').nth(0).locator('.seat__remove').click();
  await expect(dealSummary(page)).toContainText('Cleo deals');
});

test('seats can be dragged into a new order', async ({ page }) => {
  await startSetup(page, ['Ana', 'Ben', 'Cleo', 'Dov']);

  const seats = page.locator('.seat');
  const grip = seats.nth(0).locator('.seat__grip');
  // Settle the scroll position before measuring: the two boxes have to be read
  // in the same coordinate space the mouse will move through.
  await seats.nth(3).scrollIntoViewIfNeeded();
  await grip.scrollIntoViewIfNeeded();
  const from = await grip.boundingBox();
  const target = await seats.nth(2).boundingBox();

  // Drag Ana down past Ben and onto Cleo's row. The move is committed on
  // release, so the intermediate steps must not settle anything.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // More than one step: the first move only crosses the tap threshold.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(() => page.locator('.seat__input').evaluateAll((els) => els.map((e) => e.value)))
    .toEqual(['Ben', 'Cleo', 'Ana', 'Dov']);
});

test('the checkbox switches the tick column to the first bidder', async ({ page }) => {
  await startSetup(page, ['Ana', 'Ben', 'Cleo', 'Dov']);
  await page.locator('.check', { hasText: 'Choose who bids first' }).click();

  await page.locator('.seat').nth(0).locator('.dealerpick').click();
  await expect(dealSummary(page)).toContainText('Ana opens');
  await expect(dealSummary(page)).toContainText('Dov deals');

  await page.locator('.btn', { hasText: 'Deal the first hand' }).click();
  expect((await entryNames(page))[0]).toBe('Ana');
  await expect(page.locator('.entry').last().locator('.entry__name')).toHaveText('Dov');
});

test.describe('a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test('every segmented option stays reachable', async ({ page }) => {
    // The four direction options once overflowed the panel on a narrow screen,
    // leaving the last two clipped and impossible to tap.
    await startSetup(page, ['Ana', 'Ben']);
    const seg = page.locator('.seg').filter({ hasText: 'Up then down' });
    await expect(seg.locator('button')).toHaveCount(4);

    // Measured in one evaluation rather than five round-trips: the view is
    // rebuilt on any state change, and a node resolved in one call could be
    // detached by the next, which reads as a null box and not as a real
    // overflow.
    const overflowing = await seg.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return [...node.querySelectorAll('button')]
        .map((button) => {
          const box = button.getBoundingClientRect();
          return { label: button.textContent, left: box.left, right: box.right };
        })
        .filter((b) => b.left < bounds.left - 1 || b.right > bounds.right + 1)
        .map((b) => b.label);
    });
    expect(overflowing).toEqual([]);

    // And the last one actually responds to a tap.
    const last = seg.locator('button').nth(3);
    await last.click();
    await expect(last).toHaveAttribute('aria-pressed', 'true');
  });
});

test('the staircase preview follows the chosen shape', async ({ page }) => {
  await startSetup(page, ['Ana', 'Ben']);
  const stairsPanel = page.locator('.panel').filter({ hasText: 'Tallest hand' });
  const preview = page.locator('.hint').filter({ hasText: 'rounds:' });

  // Four seats by default, so one deck stretches to thirteen cards each, and
  // the staircase climbs to that and comes back down.
  await expect(preview).toContainText('25 rounds: 1 · 2 · 3');

  await stairsPanel.locator('.seg button', { hasText: 'Down' }).first().click();
  await expect(preview).toContainText('13 rounds: 13 · 12 · 11');
});

test.describe('the staircase is editable mid-game', () => {
  test.beforeEach(async ({ page }) => {
    await seedGame(page, { players: ['Ana', 'Ben', 'Cleo'], plan: [3, 2, 1] });
    await tab(page, 'Staircase').click();
    await expect(page.locator('.stairs__step')).toHaveCount(3);
  });

  test('a round can be inserted after another', async ({ page }) => {
    await page.locator('.plan').nth(1).click();
    await page.locator('.sheet__action', { hasText: 'Insert a round after' }).click();
    await expect(page.locator('.stairs__step')).toHaveCount(4);
  });

  test('a round can be resized to any number of cards', async ({ page }) => {
    await page.locator('.plan').nth(2).click();
    const stepper = page.locator('.sheet__panel .stepper').first();
    for (let i = 0; i < 6; i += 1) await stepper.locator('button', { hasText: '+' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.plan').nth(2).locator('.plan__cards')).toHaveText('7');
  });

  test('a round can be skipped and the deal steps over it', async ({ page }) => {
    // The dealer is marked with a card icon rather than the word "Dealer", so
    // read the element rather than scraping a text pattern.
    const dealerOfRound = async (i) => (await page.locator('.plan').nth(i).locator('.plan__dealer').innerText()).trim();
    expect(await dealerOfRound(2)).toBe('Cleo');

    await page.locator('.plan').nth(1).click();
    await page.locator('.sheet__action', { hasText: 'Skip this round' }).click();

    await expect(page.locator('.plan').nth(1)).toContainText('skipped');
    // Round 2 is not dealt, so round 3 takes the deal that would have been its.
    expect(await dealerOfRound(2)).toBe('Ben');
  });

  test('deleting a round asks first', async ({ page }) => {
    await page.locator('.plan').nth(0).click();
    await page.locator('.sheet__action', { hasText: 'Delete this round' }).click();
    await expect(page.locator('.sheet__panel').last()).toContainText('Delete round 1?');

    await page.locator('.btn', { hasText: 'Cancel' }).click();
    await expect(page.locator('.stairs__step')).toHaveCount(3);
  });

  test('a round can be appended at the end', async ({ page }) => {
    await page.locator('.btn--dashed', { hasText: 'Add a round at the end' }).click();
    await expect(page.locator('.stairs__step')).toHaveCount(4);
  });
});

test('the language can be changed and it persists across a reload', async ({ page }) => {
  await seedGame(page, { players: ['Ana', 'Ben'], plan: [2] });
  await page.locator('.topbar .iconbtn').last().click();
  await page.locator('.sheet__action', { hasText: 'Settings' }).click();
  await page.locator('.picker button', { hasText: 'Deutsch' }).click();

  await expect(page.locator('#main')).toContainText('Sprache');
  await page.reload();
  await expect(page.locator('.tab').first()).toContainText('Runde');
});
