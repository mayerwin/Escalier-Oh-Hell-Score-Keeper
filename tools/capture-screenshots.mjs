import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8359;
const BASE_URL = `http://localhost:${PORT}/`;

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

function startServer() {
  const server = createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    try {
      const stats = statSync(target);
      if (stats.isDirectory()) {
        res.writeHead(301, { Location: `${pathname}/` }).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache',
      });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

function buildTestGame(M, options = {}) {
  const players = [
    { name: 'François' },
    { name: 'Christiane' },
    { name: 'Bernard' },
    { name: 'Erica' },
    { name: 'Erwin' },
  ];
  const plan = M.buildPlan({ shape: 'updown', minCards: 1, maxCards: 10, parity: 'all' });
  const game = M.createGame({
    name: 'Soirée escalier du 17 août',
    players,
    plan,
  });

  const [p0, p1, p2, p3, p4] = game.players;

  function play(idx, data) {
    const r = game.rounds[idx];
    r.order = M.bidOrder(game, r);
    r.phase = M.PHASE.DONE;
    r.recorded = true;
    for (const p of game.players) {
      r.entries[p.id] = { bid: data[p.name][0], tricks: data[p.name][1], out: false, adj: 0 };
    }
  }

  // 14 played rounds out of 19 (approx 3/4 of the staircase)
  play(0, { 'François': [0,0], 'Christiane': [0,0], 'Bernard': [0,0], 'Erica': [0,0], 'Erwin': [1,1] });
  play(1, { 'François': [1,1], 'Christiane': [0,0], 'Bernard': [1,1], 'Erica': [0,0], 'Erwin': [0,0] });
  play(2, { 'François': [1,1], 'Christiane': [1,1], 'Bernard': [0,0], 'Erica': [0,0], 'Erwin': [1,1] });
  play(3, { 'François': [0,1], 'Christiane': [1,1], 'Bernard': [1,0], 'Erica': [1,1], 'Erwin': [1,1] });
  play(4, { 'François': [1,1], 'Christiane': [1,1], 'Bernard': [0,0], 'Erica': [1,1], 'Erwin': [2,2] });
  play(5, { 'François': [2,2], 'Christiane': [1,0], 'Bernard': [1,2], 'Erica': [1,1], 'Erwin': [1,1] });
  play(6, { 'François': [1,1], 'Christiane': [2,2], 'Bernard': [1,1], 'Erica': [0,0], 'Erwin': [3,3] });
  play(7, { 'François': [2,1], 'Christiane': [2,2], 'Bernard': [2,2], 'Erica': [1,1], 'Erwin': [2,2] });
  play(8, { 'François': [2,2], 'Christiane': [1,1], 'Bernard': [2,2], 'Erica': [2,1], 'Erwin': [3,3] });
  play(9, { 'François': [2,2], 'Christiane': [2,2], 'Bernard': [1,1], 'Erica': [2,2], 'Erwin': [3,3] });
  play(10, { 'François': [1,1], 'Christiane': [3,3], 'Bernard': [2,1], 'Erica': [1,1], 'Erwin': [3,3] });
  play(11, { 'François': [2,2], 'Christiane': [1,1], 'Bernard': [2,2], 'Erica': [1,1], 'Erwin': [2,2] });
  play(12, { 'François': [1,1], 'Christiane': [1,0], 'Bernard': [1,2], 'Erica': [2,2], 'Erwin': [2,2] });
  play(13, { 'François': [2,2], 'Christiane': [1,1], 'Bernard': [1,1], 'Erica': [0,0], 'Erwin': [2,2] });

  // Configure Round 14 (Manche 15: 5 cards)
  const r14 = game.rounds[14];
  if (options.tricksPhase) {
    r14.phase = M.PHASE.TRICKS;
    r14.entries[p0.id].bid = 1;
    r14.entries[p0.id].tricks = 1;
    r14.entries[p1.id].bid = 1;
    r14.entries[p1.id].tricks = 1;
    r14.entries[p2.id].bid = 0;
    r14.entries[p2.id].tricks = 0;
    r14.entries[p3.id].bid = 1;
    r14.entries[p3.id].tricks = null;
    r14.entries[p4.id].bid = 2;
    r14.entries[p4.id].tricks = null;
  } else {
    r14.phase = M.PHASE.BIDDING;
    r14.entries[p0.id].bid = 1;
    r14.entries[p1.id].bid = 1;
    r14.entries[p2.id].bid = 0;
    r14.entries[p3.id].bid = 1;
    // Erwin (last bidder) has not bid yet -> forbidden chip is 2
  }

  M.normalizeDealers(game);
  return game;
}

async function setGameState(page, options = {}) {
  await page.evaluate(
    async ({ options, buildTestGameStr }) => {
      const M = await import('/src/model.js');
      const buildFn = new Function('M', 'options', `return (${buildTestGameStr})(M, options);`);
      const game = buildFn(M, options);

      localStorage.setItem(`escalier:v2:game:${game.id}`, JSON.stringify(game));
      localStorage.setItem(
        'escalier:v2:settings',
        JSON.stringify({
          lang: options.lang || 'en',
          theme: options.theme || 'light',
          lastGameId: game.id,
          chartMode: 'cumulative',
          roster: [
            { name: 'François', always: true },
            { name: 'Christiane', always: true },
            { name: 'Bernard', always: true },
            { name: 'Erica', always: true },
            { name: 'Erwin', always: true },
            { name: 'Alice', always: false },
            { name: 'David', always: false },
          ],
        })
      );
    },
    { options, buildTestGameStr: buildTestGame.toString() }
  );
  await page.reload();
  await page.waitForTimeout(300);
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
}

async function cleanAndScroll(page, y = 0) {
  await page.evaluate((topY) => {
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, topY);
  }, y);
  await page.waitForTimeout(200);
}

async function captureLocale(browser, lang) {
  const outDir = join(ROOT, 'docs', 'screenshots', lang);
  mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    locale: lang === 'en' ? 'en-GB' : `${lang}-${lang.toUpperCase()}`,
  });
  const page = await context.newPage();

  console.log(`\n--- Capturing screenshots for language: [${lang.toUpperCase()}] in ${outDir} ---`);

  // 1. Setup screen - Players & Seating order
  console.log(`1. [${lang}] Capturing 01_setup_players.png...`);
  await page.goto(BASE_URL);
  await setGameState(page, { lang, theme: 'light' });
  await page.evaluate(async () => {
    const store = await import('/src/store.js');
    store.setView('setup');
  });
  await page.waitForTimeout(200);
  const nameInput = page.locator('.panel input[type="text"]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill('Soirée escalier du 17 août');
  }
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '01_setup_players.png') });

  // 2. Setup screen - Staircase Pattern & Scoring Rules
  console.log(`2. [${lang}] Capturing 02_setup_rules.png...`);
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('.h--ruled'));
    if (headings[1]) {
      const top = headings[1].getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo(0, Math.max(0, top));
    } else {
      window.scrollTo(0, 390);
    }
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, '02_setup_rules.png') });

  // 3. Play - Bidding phase (Phase des annonces)
  console.log(`3. [${lang}] Capturing 03_play_bids.png...`);
  await setGameState(page, { lang, tricksPhase: false, theme: 'light' });
  await page.evaluate(async () => {
    const store = await import('/src/store.js');
    store.setView('play');
  });
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '03_play_bids.png') });

  // 4. Play - Tricks phase (Phase des plis)
  console.log(`4. [${lang}] Capturing 04_play_tricks.png...`);
  await setGameState(page, { lang, tricksPhase: true, theme: 'light' });
  await page.evaluate(async () => {
    const store = await import('/src/store.js');
    store.setView('play');
  });
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '04_play_tricks.png') });

  // 5. Stairs view (L'Escalier / Staircase)
  console.log(`5. [${lang}] Capturing 05_stairs.png...`);
  await page.locator('button[data-fk="tab:stairs"]').click();
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '05_stairs.png') });

  // 6. Board view (Classement & Tableau / Standings & Board)
  console.log(`6. [${lang}] Capturing 06_board.png...`);
  await page.locator('button[data-fk="tab:board"]').click();
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '06_board.png') });

  // 7. Chart view (Courbe / Evolution Chart)
  console.log(`7. [${lang}] Capturing 07_chart.png...`);
  await page.locator('button[data-fk="tab:chart"]').click();
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '07_chart.png') });

  // 8. Settings in Dark Mode (Paramètres en Mode Sombre)
  console.log(`8. [${lang}] Capturing 08_settings_dark.png...`);
  await setGameState(page, { lang, theme: 'dark' });
  await page.evaluate(async () => {
    const store = await import('/src/store.js');
    store.setView('settings');
  });
  await cleanAndScroll(page, 0);
  await page.screenshot({ path: join(outDir, '08_settings_dark.png') });

  await context.close();
}

async function run() {
  const server = await startServer();
  console.log(`Server started at ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });

  const locales = ['en', 'fr', 'de', 'es', 'it', 'pt'];
  for (const lang of locales) {
    await captureLocale(browser, lang);
  }

  await browser.close();
  server.close();
  console.log('\nAll localized screenshots successfully generated!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
