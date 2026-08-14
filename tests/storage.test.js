/**
 * Durability. Without a real localStorage the module falls back to an
 * in-memory backing store, which exercises exactly the same code paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import * as storage from '../src/storage.js';
import * as M from '../src/model.js';

function newGame(name = 'Test') {
  return M.createGame({ name, players: [{ name: 'Ana' }, { name: 'Ben' }], plan: [2, 1] });
}

test('a first save needs no revision and returns one', () => {
  storage.clearAllGames();
  const game = newGame();
  const result = storage.saveGame(game, undefined);
  assert.equal(result.ok, true);
  assert.ok(result.rev, 'a revision token comes back');
  assert.equal(storage.readRev(game.id), result.rev);
});

test('a save with the current revision succeeds and moves it on', () => {
  storage.clearAllGames();
  const game = newGame();
  const first = storage.saveGame(game, undefined);
  const second = storage.saveGame(game, first.rev);
  assert.equal(second.ok, true);
  assert.notEqual(second.rev, first.rev);
});

test('a stale write is refused instead of clobbering the other tab', () => {
  // The bug this guards: two tabs open the same game, one records a round, and
  // the other's next write — of anything at all — silently erases it.
  storage.clearAllGames();
  const game = newGame();
  const opened = storage.saveGame(game, undefined);

  // Tab A records a round and saves.
  const tabA = storage.loadGame(game.id);
  tabA.rounds[0].phase = M.PHASE.DONE;
  tabA.rounds[0].recorded = true;
  const afterA = storage.saveGame(tabA, opened.rev);
  assert.equal(afterA.ok, true);

  // Tab B still holds the copy from before, and renames the game.
  const tabB = game;
  tabB.name = 'Renamed';
  const result = storage.saveGame(tabB, opened.rev);

  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);

  const stored = storage.loadGame(game.id);
  assert.equal(stored.rounds[0].phase, M.PHASE.DONE, "tab A's recorded round survives");
  assert.equal(stored.name, 'Test', 'and the stale write did not land');
});

test('a refused write leaves the in-memory revision alone', () => {
  storage.clearAllGames();
  const game = newGame();
  const first = storage.saveGame(game, undefined);
  const other = storage.loadGame(game.id);
  storage.saveGame(other, first.rev); // someone else moves it on

  const before = game.rev;
  const result = storage.saveGame(game, first.rev);
  assert.equal(result.conflict, true);
  assert.equal(game.rev, before, 'the rejected attempt did not adopt a new token');
});

test('writing a game deleted elsewhere is refused rather than resurrecting it', () => {
  storage.clearAllGames();
  const game = newGame();
  const saved = storage.saveGame(game, undefined);
  storage.deleteGame(game.id);

  const result = storage.saveGame(game, saved.rev);
  assert.equal(result.ok, false);
  assert.equal(result.missing, true);
  assert.equal(storage.listGames().find((g) => g.id === game.id), undefined, 'it stays deleted');
});

test('readRev reports null for a game that is not there', () => {
  storage.clearAllGames();
  assert.equal(storage.readRev('nope'), null);
});

test('the games list reflects writes and deletions', () => {
  storage.clearAllGames();
  assert.deepEqual(storage.listGames(), []);

  const a = newGame('First');
  const b = newGame('Second');
  storage.saveGame(a, undefined);
  storage.saveGame(b, undefined);
  assert.equal(storage.countGames(), 2);

  storage.deleteGame(a.id);
  const names = storage.listGames().map((g) => g.name);
  assert.deepEqual(names, ['Second']);

  storage.clearAllGames();
  assert.deepEqual(storage.listGames(), []);
});
