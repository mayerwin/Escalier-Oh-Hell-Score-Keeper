import test from 'node:test';
import assert from 'node:assert/strict';

import * as M from '../src/model.js';

const { PHASE } = M;

function makeGame(playerNames = ['Ana', 'Ben', 'Cleo', 'Dov'], plan = [3, 2, 1], cfg = {}) {
  return M.createGame({
    name: 'Test',
    players: playerNames.map((name) => ({ name })),
    plan,
    cfg,
  });
}

const idOf = (game, name) => game.players.find((p) => p.name === name).id;

/* ------------------------------------------------------------ plan shapes */

test('buildPlan produces the four staircase shapes', () => {
  assert.deepEqual(M.buildPlan({ shape: 'down', maxCards: 4 }), [4, 3, 2, 1]);
  assert.deepEqual(M.buildPlan({ shape: 'up', maxCards: 4 }), [1, 2, 3, 4]);
  assert.deepEqual(M.buildPlan({ shape: 'updown', maxCards: 4 }), [1, 2, 3, 4, 3, 2, 1]);
  assert.deepEqual(M.buildPlan({ shape: 'downup', maxCards: 4 }), [4, 3, 2, 1, 2, 3, 4]);
});

test('buildPlan honours parity and a raised floor', () => {
  assert.deepEqual(M.buildPlan({ shape: 'up', maxCards: 7, parity: 'odd' }), [1, 3, 5, 7]);
  assert.deepEqual(M.buildPlan({ shape: 'up', maxCards: 7, parity: 'even' }), [2, 4, 6]);
  assert.deepEqual(M.buildPlan({ shape: 'down', maxCards: 6, minCards: 4 }), [6, 5, 4]);
});

test('buildPlan copes with inverted and degenerate bounds', () => {
  assert.deepEqual(M.buildPlan({ shape: 'up', minCards: 6, maxCards: 2 }), [2, 3, 4, 5, 6]);
  assert.deepEqual(M.buildPlan({ shape: 'up', minCards: 3, maxCards: 3 }), [3]);
  assert.deepEqual(M.buildPlan({ shape: 'updown', minCards: 3, maxCards: 3 }), [3]);
  // No hand size satisfies the filter.
  assert.deepEqual(M.buildPlan({ shape: 'up', minCards: 2, maxCards: 2, parity: 'odd' }), []);
});

test('maxCardsFor divides a single deck', () => {
  assert.equal(M.maxCardsFor(4), 13);
  assert.equal(M.maxCardsFor(5), 10);
  assert.equal(M.maxCardsFor(7), 7);
  assert.equal(M.maxCardsFor(0), M.MAX_CARDS);
});

/* ---------------------------------------------------------------- scoring */

test('calcPoints rewards an exact bid and punishes deviation', () => {
  const cfg = { ptsBid: 5, ptsTrick: 5, ptsMiss: 5, strict: false };
  assert.equal(M.calcPoints(0, 0, cfg), 5, 'a bid of zero, made, still earns the bonus');
  assert.equal(M.calcPoints(3, 3, cfg), 20);
  assert.equal(M.calcPoints(3, 1, cfg), -10);
  assert.equal(M.calcPoints(1, 3, cfg), -10, 'overshooting costs the same as falling short');
});

test('strict mode also pays for tricks won on a missed bid', () => {
  const cfg = { ptsBid: 5, ptsTrick: 5, ptsMiss: 5, strict: true };
  assert.equal(M.calcPoints(3, 1, cfg), -10 + 5);
  assert.equal(M.calcPoints(3, 3, cfg), 20, 'a made bid scores the same either way');
});

test('entryPoints handles sat-out players and adjustments', () => {
  const cfg = M.defaultConfig();
  assert.equal(M.entryPoints({ bid: 2, tricks: 2, out: false, adj: 0 }, cfg), 15);
  assert.equal(M.entryPoints({ bid: 2, tricks: 2, out: false, adj: -7 }, cfg), 8);
  assert.equal(M.entryPoints({ bid: 2, tricks: 2, out: true, adj: -7 }, cfg), -7, 'sitting out scores only the adjustment');
  assert.equal(M.entryPoints({ bid: null, tricks: null, out: false, adj: 0 }, cfg), 0, 'an unfinished entry is worth nothing');
  assert.equal(M.entryPoints(null, cfg), 0);
});

test('only recorded rounds count towards the totals', () => {
  const game = makeGame(['Ana', 'Ben'], [2, 2]);
  const ana = idOf(game, 'Ana');
  const ben = idOf(game, 'Ben');

  game.rounds[0].entries[ana] = { bid: 2, tricks: 2, out: false, adj: 0 };
  game.rounds[0].entries[ben] = { bid: 0, tricks: 0, out: false, adj: 0 };
  game.rounds[1].entries[ana] = { bid: 2, tricks: 2, out: false, adj: 0 };
  game.rounds[1].entries[ben] = { bid: 0, tricks: 0, out: false, adj: 0 };

  assert.deepEqual(M.totals(game), { [ana]: 0, [ben]: 0 }, 'nothing counts before a round is recorded');

  game.rounds[0].phase = PHASE.DONE;
  assert.deepEqual(M.totals(game), { [ana]: 15, [ben]: 5 });

  game.rounds[1].phase = PHASE.DONE;
  assert.deepEqual(M.totals(game), { [ana]: 30, [ben]: 10 });
});

test('carry-in scores seed the totals', () => {
  const game = makeGame(['Ana', 'Ben'], [1]);
  game.players[0].carryIn = -12;
  assert.equal(M.totals(game)[game.players[0].id], -12);
});

test('standings rank ties equally and break display order by seat', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [1]);
  game.players[0].carryIn = 10;
  game.players[1].carryIn = 30;
  game.players[2].carryIn = 10;

  const rows = M.standings(game);
  assert.deepEqual(
    rows.map((r) => [r.name, r.score, r.rank]),
    [
      ['Ben', 30, 1],
      ['Ana', 10, 2],
      ['Cleo', 10, 2],
    ]
  );
});

/* ------------------------------------------------------ dealer and order */

test('the deal passes one seat per round', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo', 'Dov'], [4, 3, 2, 1]);
  const names = game.rounds.map((r) => M.playerById(game, r.dealerId).name);
  assert.deepEqual(names, ['Ana', 'Ben', 'Cleo', 'Dov']);
});

test('the deal wraps past the last seat', () => {
  const game = makeGame(['Ana', 'Ben'], [1, 1, 1]);
  assert.deepEqual(
    game.rounds.map((r) => M.playerById(game, r.dealerId).name),
    ['Ana', 'Ben', 'Ana']
  );
});

test('the opener sits after the dealer and bids first, dealer last', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo', 'Dov'], [3]);
  const round = game.rounds[0];
  assert.equal(M.playerById(game, round.dealerId).name, 'Ana');
  assert.equal(M.playerById(game, M.leadOf(game, round)).name, 'Ben');
  assert.deepEqual(
    M.bidOrder(game, round).map((id) => M.playerById(game, id).name),
    ['Ben', 'Cleo', 'Dov', 'Ana']
  );
});

test('setOpener moves the deal to the seat before', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo', 'Dov'], [3, 3]);
  M.setOpener(game, 0, idOf(game, 'Dov'));
  assert.equal(M.playerById(game, game.rounds[0].dealerId).name, 'Cleo');
  assert.equal(M.playerById(game, M.leadOf(game, game.rounds[0])).name, 'Dov');
  assert.equal(M.playerById(game, game.rounds[1].dealerId).name, 'Dov', 'later rounds follow the new anchor');
});

test('recorded rounds anchor the rotation and are never rewritten', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [3, 3, 3, 3]);
  game.rounds[0].phase = PHASE.DONE;
  game.rounds[1].phase = PHASE.DONE;
  const played = [game.rounds[0].dealerId, game.rounds[1].dealerId];

  M.insertRound(game, 0, 5);

  assert.deepEqual([game.rounds[1].dealerId, game.rounds[2].dealerId], played, 'history keeps its dealers');
  assert.equal(M.playerById(game, game.rounds[3].dealerId).name, 'Cleo', 'the tail re-derives from the last anchor');
});

test('a pinned dealer survives re-derivation', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [1, 1, 1]);
  M.setDealer(game, 1, idOf(game, 'Cleo'));
  M.normalizeDealers(game);
  assert.equal(M.playerById(game, game.rounds[1].dealerId).name, 'Cleo');
  assert.equal(M.playerById(game, game.rounds[2].dealerId).name, 'Ana', 'the next round follows the pin');
});

test('skipped rounds are not dealt and do not consume a turn', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [3, 3, 3]);
  M.toggleSkip(game, 1);
  assert.equal(game.rounds[1].dealerId, null);
  assert.equal(M.playerById(game, game.rounds[0].dealerId).name, 'Ana');
  assert.equal(M.playerById(game, game.rounds[2].dealerId).name, 'Ben', 'the deal passes to the next actual dealer');
});

test('setDealer on the first round also moves the opening deal', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [1, 1]);
  M.setDealer(game, 0, idOf(game, 'Ben'));
  assert.equal(game.firstDealerId, idOf(game, 'Ben'));
});

/* ------------------------------------------------------------- validation */

test('the dealer is barred from the bid that balances the round', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [5], { banFrom: 3 });
  const round = game.rounds[0];
  const [ana, ben, cleo] = game.players.map((p) => p.id);
  assert.equal(round.dealerId, ana);

  round.entries[ben].bid = 2;
  assert.equal(M.forbiddenDealerBid(game, round), null, 'unknown until everyone else has bid');

  round.entries[cleo].bid = 1;
  assert.equal(M.forbiddenDealerBid(game, round), 2, '5 tricks minus 3 already bid');

  round.entries[ana].bid = 2;
  assert.equal(M.bidState(game, round).violates, true);

  round.entries[ana].bid = 3;
  assert.equal(M.bidState(game, round).violates, false);
  assert.equal(M.bidState(game, round).ok, true);
});

test('the dealer rule can be switched off, and respects its threshold', () => {
  const game = makeGame(['Ana', 'Ben'], [2], { banFrom: 0 });
  const round = game.rounds[0];
  for (const p of game.players) round.entries[p.id].bid = 1;
  assert.equal(M.banApplies(game, round), false);
  assert.equal(M.bidState(game, round).violates, false);

  const strictGame = makeGame(['Ana', 'Ben'], [2], { banFrom: 5 });
  assert.equal(M.banApplies(strictGame, strictGame.rounds[0]), false, 'below the threshold');
});

test('players sitting out are excluded from both totals and the bar', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [4], { banFrom: 1 });
  const round = game.rounds[0];
  const [ana, ben, cleo] = game.players.map((p) => p.id);

  round.entries[cleo].out = true;
  round.entries[ben].bid = 1;
  assert.equal(M.forbiddenDealerBid(game, round), 3, 'the absent player is not waited for');

  round.entries[ana].bid = 3;
  assert.equal(M.bidState(game, round).violates, true);
  assert.equal(M.bidState(game, round).sum, 4);
});

test('trickState requires every active player to have a value that sums exactly', () => {
  const game = makeGame(['Ana', 'Ben'], [3]);
  const round = game.rounds[0];
  const [ana, ben] = game.players.map((p) => p.id);

  assert.equal(M.trickState(game, round).ok, false);

  round.entries[ana].tricks = 3;
  let state = M.trickState(game, round);
  assert.equal(state.ok, false, 'one player still has no value');
  assert.equal(state.missing, 1);
  assert.equal(state.remaining, 0);

  round.entries[ben].tricks = 0;
  state = M.trickState(game, round);
  assert.equal(state.ok, true);

  round.entries[ben].tricks = 2;
  state = M.trickState(game, round);
  assert.equal(state.ok, false);
  assert.equal(state.diff, 2);
});

/* ------------------------------------------------------- staircase edits */

test('rounds can be inserted, duplicated and removed at any point', () => {
  const game = makeGame(['Ana', 'Ben'], [3, 2, 1]);
  M.insertRound(game, 1, 9);
  assert.deepEqual(game.rounds.map((r) => r.cards), [3, 9, 2, 1]);

  M.duplicateRound(game, 0);
  assert.deepEqual(game.rounds.map((r) => r.cards), [3, 3, 9, 2, 1]);

  M.removeRound(game, 2);
  assert.deepEqual(game.rounds.map((r) => r.cards), [3, 3, 2, 1]);

  M.appendRound(game, 7);
  assert.deepEqual(game.rounds.map((r) => r.cards), [3, 3, 2, 1, 7]);
});

test('a new round gets an entry for every player', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [1]);
  const round = M.appendRound(game, 4);
  assert.deepEqual(Object.keys(round.entries).sort(), game.players.map((p) => p.id).sort());
});

test('shrinking a hand clamps bids and tricks that no longer fit', () => {
  const game = makeGame(['Ana', 'Ben'], [8]);
  const round = game.rounds[0];
  const [ana] = game.players.map((p) => p.id);
  round.entries[ana] = { bid: 7, tricks: 6, out: false, adj: 0 };

  M.setRoundCards(game, 0, 3);
  assert.equal(round.cards, 3);
  assert.equal(round.entries[ana].bid, 3);
  assert.equal(round.entries[ana].tricks, 3);
});

test('rebuildPlan keeps recorded rounds and replaces the rest', () => {
  const game = makeGame(['Ana', 'Ben'], [5, 4, 3, 2, 1]);
  game.rounds[0].phase = PHASE.DONE;
  game.rounds[1].phase = PHASE.DONE;

  M.rebuildPlan(game, { shape: 'up', maxCards: 3 });

  assert.deepEqual(game.rounds.map((r) => r.cards), [5, 4, 1, 2, 3]);
  assert.equal(game.rounds[0].phase, PHASE.DONE);
  assert.equal(game.rounds[2].phase, PHASE.PENDING);
});

test('currentRoundIndex skips recorded and skipped rounds', () => {
  const game = makeGame(['Ana', 'Ben'], [3, 2, 1]);
  assert.equal(M.currentRoundIndex(game), 0);

  game.rounds[0].phase = PHASE.DONE;
  game.rounds[1].phase = PHASE.SKIPPED;
  assert.equal(M.currentRoundIndex(game), 2);

  game.rounds[2].phase = PHASE.DONE;
  assert.equal(M.currentRoundIndex(game), -1);
  assert.equal(M.isComplete(game), true);
  assert.deepEqual(M.progress(game), { done: 2, total: 2 }, 'skipped rounds leave the denominator');
});

/* ---------------------------------------------------------- player edits */

test('a late joiner sits out the rounds already played', () => {
  const game = makeGame(['Ana', 'Ben'], [2, 2]);
  game.rounds[0].phase = PHASE.DONE;

  const cleo = M.addPlayer(game, 'Cleo', { carryIn: 12 });
  assert.equal(game.rounds[0].entries[cleo.id].out, true);
  assert.equal(game.rounds[1].entries[cleo.id].out, false);
  assert.equal(M.totals(game)[cleo.id], 12);
});

test('removing a player erases their entries and reassigns their deals', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [1, 1, 1]);
  const ben = idOf(game, 'Ben');
  assert.equal(game.rounds[1].dealerId, ben);

  assert.equal(M.removePlayer(game, ben), true);
  assert.equal(game.players.length, 2);
  for (const round of game.rounds) {
    assert.equal(round.entries[ben], undefined);
    assert.notEqual(round.dealerId, ben);
    assert.ok(M.playerById(game, round.dealerId), 'every round still has a real dealer');
  }
});

test('a game will not drop below two players', () => {
  const game = makeGame(['Ana', 'Ben'], [1]);
  assert.equal(M.removePlayer(game, game.players[0].id), false);
  assert.equal(game.players.length, 2);
});

test('reordering seats keeps every score attached to its player', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [3]);
  const ana = idOf(game, 'Ana');
  game.rounds[0].entries[ana] = { bid: 3, tricks: 3, out: false, adj: 0 };
  game.rounds[0].phase = PHASE.DONE;
  const before = M.totals(game)[ana];

  M.movePlayer(game, 0, 2);
  assert.deepEqual(game.players.map((p) => p.name), ['Ben', 'Cleo', 'Ana']);
  assert.equal(M.totals(game)[ana], before, 'scores follow the player, not the seat');
});

/* ------------------------------------------------------------- integrity */

test('sanitizeGame repairs a hand-mangled payload', () => {
  const repaired = M.sanitizeGame({
    id: '',
    name: 42,
    players: [
      { name: 'Ana', color: 'not-a-colour' },
      { id: 'dup', name: '' },
      { id: 'dup', name: 'Cleo' },
      null,
    ],
    cfg: { ptsBid: 'x', banFrom: 999 },
    planSpec: { shape: 'sideways', parity: 'prime' },
    firstDealerId: 'ghost',
    rounds: [
      { cards: 500, phase: 'nonsense', entries: { ghost: { bid: 4 } } },
      'not a round',
    ],
  });

  assert.ok(repaired.id);
  assert.equal(repaired.name, '');
  assert.equal(repaired.players.length, 3);
  assert.equal(new Set(repaired.players.map((p) => p.id)).size, 3, 'duplicate ids are re-issued');
  assert.match(repaired.players[0].color, /^#[0-9a-f]{6}$/i);
  assert.equal(repaired.cfg.ptsBid, M.defaultConfig().ptsBid, 'a non-numeric score falls back to the default');
  assert.equal(repaired.cfg.banFrom, M.MAX_CARDS);
  assert.equal(repaired.planSpec.shape, 'down');
  assert.equal(repaired.planSpec.parity, 'all');
  assert.equal(repaired.rounds.length, 1);
  assert.equal(repaired.rounds[0].cards, M.MAX_CARDS);
  assert.equal(repaired.rounds[0].phase, PHASE.PENDING);
  assert.equal(repaired.rounds[0].entries.ghost, undefined, 'entries for unknown players are dropped');
  assert.ok(M.playerById(repaired, repaired.firstDealerId), 'the opening dealer is a real player');
  assert.deepEqual(
    Object.keys(repaired.rounds[0].entries).sort(),
    repaired.players.map((p) => p.id).sort()
  );
});

test('sanitizeGame rejects non-objects', () => {
  assert.equal(M.sanitizeGame(null), null);
  assert.equal(M.sanitizeGame('nope'), null);
});

test('uid produces distinct ids under tight loops', () => {
  const ids = new Set();
  for (let i = 0; i < 5000; i += 1) ids.add(M.uid('p'));
  assert.equal(ids.size, 5000);
});
