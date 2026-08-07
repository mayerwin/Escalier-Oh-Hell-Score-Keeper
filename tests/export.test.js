import test from 'node:test';
import assert from 'node:assert/strict';

import * as M from '../src/model.js';
import { setLanguage } from '../src/i18n.js';
import { csvField, exportFilename, gameToCsv, gameToJson, gameToRows, gameToSummaryRows, toCsv } from '../src/export.js';

setLanguage('en');

function smallGame() {
  const game = M.createGame({
    name: 'Soirée du 24',
    players: [{ name: 'Ana' }, { name: 'Ben' }, { name: 'Cleo' }],
    plan: [2, 1],
  });
  const [ana, ben, cleo] = game.players.map((p) => p.id);
  game.rounds[0].entries[ana] = { bid: 1, tricks: 1, out: false, adj: 0 };
  game.rounds[0].entries[ben] = { bid: 0, tricks: 1, out: false, adj: -3 };
  game.rounds[0].entries[cleo] = { bid: 0, tricks: 0, out: false, adj: 0 };
  game.rounds[0].phase = M.PHASE.DONE;
  return game;
}

test('csvField quotes only what needs quoting', () => {
  assert.equal(csvField('Ana'), 'Ana');
  assert.equal(csvField(12), '12');
  assert.equal(csvField(null), '');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('line\nbreak'), '"line\nbreak"');
});

test('csvField defuses spreadsheet formula injection', () => {
  // A player called "=cmd|..." must not execute when the file is opened.
  assert.equal(csvField('=1+1'), "'=1+1");
  assert.equal(csvField('+x'), "'+x");
  assert.equal(csvField('-x'), "'-x");
  assert.equal(csvField('@x'), "'@x");
  assert.equal(csvField('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  // Leading whitespace is stripped by the spreadsheet before it decides.
  assert.equal(csvField('   =1+1'), "'   =1+1");
  // A tab is not one of the characters CSV requires quoting, so it stays bare.
  assert.equal(csvField('\t=1+1'), "'\t=1+1");
});

test('csvField leaves negative numbers importable as numbers', () => {
  // Scores go negative constantly in this game; quoting them would turn every
  // penalty into text and break the sums.
  assert.equal(csvField(-8), '-8');
  assert.equal(csvField('-8'), '-8');
  assert.equal(csvField(-8.5), '-8.5');
  assert.equal(csvField(0), '0');
  assert.equal(csvField('+5'), '+5');
});

test('a CSV export of negative scores contains bare numbers', () => {
  const game = smallGame();
  const csv = gameToCsv(game);
  assert.ok(csv.includes(',-8,'), 'the -8 points cell should not be quoted or escaped');
  assert.ok(!csv.includes("'-"), 'no numeric cell should be prefixed');
});

test('toCsv joins with CRLF as the format requires', () => {
  assert.equal(toCsv([['a', 'b'], [1, 2]]), 'a,b\r\n1,2');
});

test('the long export has one row per player per round', () => {
  const game = smallGame();
  const rows = gameToRows(game);
  assert.equal(rows.length, 1 + game.rounds.length * game.players.length);
  assert.deepEqual(rows[0].slice(0, 3), ['round', 'cards', 'status']);

  const firstRound = rows.slice(1, 4);
  assert.deepEqual(firstRound.map((r) => r[0]), [1, 1, 1]);
  // Rows follow bidding order, so the dealer comes last.
  assert.equal(firstRound[firstRound.length - 1][5], M.playerById(game, game.rounds[0].dealerId).name);
});

test('recorded rounds carry points and a running total; pending ones do not', () => {
  const game = smallGame();
  const rows = gameToRows(game);
  const header = rows[0];
  const pointsAt = header.indexOf('points');
  const runningAt = header.indexOf('running');

  const played = rows.slice(1, 4);
  for (const row of played) assert.equal(typeof row[pointsAt], 'number');

  const anaRow = played.find((r) => r[5] === 'Ana');
  assert.equal(anaRow[pointsAt], 10, 'bid 1, won 1 -> 5 bonus + 5 per trick');

  const benRow = played.find((r) => r[5] === 'Ben');
  assert.equal(benRow[pointsAt], -8, 'one trick over is -5, plus a -3 adjustment');

  const pending = rows.slice(4);
  for (const row of pending) {
    assert.equal(row[pointsAt], '', 'an unplayed round has no points');
    assert.equal(typeof row[runningAt], 'number');
  }
});

test('sat-out players are marked and left blank', () => {
  const game = smallGame();
  const cleo = game.players[2].id;
  game.rounds[0].entries[cleo].out = true;
  const rows = gameToRows(game);
  const row = rows.slice(1, 4).find((r) => r[5] === 'Cleo');
  assert.equal(row[2], 'sat_out');
  assert.equal(row[6], '');
  assert.equal(row[7], '');
});

test('the summary block ends with the final totals', () => {
  const game = smallGame();
  const rows = gameToSummaryRows(game);
  assert.deepEqual(rows[0], ['round', 'cards', 'Ana', 'Ben', 'Cleo']);
  const last = rows[rows.length - 1];
  assert.equal(last[0], 'Total');
  const totals = M.totals(game);
  assert.deepEqual(last.slice(2), game.players.map((p) => totals[p.id]));
});

test('gameToCsv contains both blocks', () => {
  const csv = gameToCsv(smallGame());
  assert.ok(csv.includes('round,cards,status'));
  assert.ok(csv.includes('Total'));
  assert.ok(csv.endsWith('\r\n'));
});

test('gameToJson is valid, complete and self-describing', () => {
  const game = smallGame();
  const parsed = JSON.parse(gameToJson(game));
  assert.equal(parsed.app, "L'Escalier");
  assert.equal(parsed.game.name, 'Soirée du 24');
  assert.equal(parsed.players.length, 3);
  assert.equal(parsed.rounds.length, 2);
  assert.equal(parsed.rounds[0].status, 'played');
  assert.equal(parsed.rounds[1].status, 'pending');
  assert.ok(parsed.rounds[0].dealer);
  assert.ok(parsed.rounds[0].opens);
  assert.equal(parsed.rounds[1].results[0].points, null);

  const totals = M.totals(game);
  for (const row of parsed.players) {
    const player = game.players.find((p) => p.name === row.name);
    assert.equal(row.total, totals[player.id]);
  }
});

test('exportFilename folds accents and stays filesystem-safe', () => {
  const game = smallGame();
  game.updated = Date.parse('2026-03-09T21:15:00Z');
  assert.equal(exportFilename(game, 'csv'), 'soiree-du-24-2026-03-09.csv');

  game.name = '  ***  ';
  assert.equal(exportFilename(game, 'json'), 'escalier-2026-03-09.json');

  game.name = 'Björn & Zoé / #1';
  assert.equal(exportFilename(game, 'csv'), 'bjorn-zoe-1-2026-03-09.csv');
});
