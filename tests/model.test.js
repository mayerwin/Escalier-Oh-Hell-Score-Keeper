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

/* ------------------------------------------- regressions from code review */

test('a reopened round keeps the dealer it was actually played with', () => {
  // Leaving DONE removes a round's anchor status, so without pinning it the
  // dealer would be re-derived from a staircase that has since been edited.
  const game = makeGame(['Ana', 'Ben', 'Cleo', 'Dov'], [1, 1, 1, 1]);
  for (const round of game.rounds) round.phase = PHASE.DONE;
  const played = game.rounds.map((r) => r.dealerId);

  M.insertRound(game, 1, 2);

  const target = game.rounds[2]; // was index 1 before the insert
  target.dealerLocked = true; // what store.reopenRound does
  target.phase = PHASE.BIDDING;
  M.normalizeDealers(game);

  assert.equal(target.dealerId, played[1], 'the reopened round still has its original dealer');
});

test('a recorded round cannot be resized out from under its own results', () => {
  const game = makeGame(['Ana', 'Ben'], [8]);
  const round = game.rounds[0];
  const [ana, ben] = game.players.map((p) => p.id);
  round.entries[ana] = { bid: 4, tricks: 4, out: false, adj: 0 };
  round.entries[ben] = { bid: 4, tricks: 4, out: false, adj: 0 };
  round.phase = PHASE.DONE;
  const before = M.totals(game);

  assert.equal(M.setRoundCards(game, 0, 3), false);
  assert.equal(round.cards, 8);
  assert.deepEqual(M.totals(game), before, 'scores are untouched');
  assert.equal(M.trickState(game, round).ok, true, 'the round still validates');
});

test('a recorded round cannot be skipped without reopening it', () => {
  const game = makeGame(['Ana', 'Ben'], [2]);
  game.rounds[0].phase = PHASE.DONE;
  assert.equal(M.toggleSkip(game, 0), false);
  assert.equal(game.rounds[0].phase, PHASE.DONE);
});

test('skipping every round is not a finished game', () => {
  const game = makeGame(['Ana', 'Ben'], [3, 2, 1]);
  for (let i = 0; i < game.rounds.length; i += 1) M.toggleSkip(game, i);

  assert.equal(M.currentRoundIndex(game), -1, 'there is nothing left to play');
  assert.equal(M.isComplete(game), false, 'but nobody has won anything');

  game.rounds[0].phase = PHASE.PENDING;
  game.rounds[0].entries[game.players[0].id] = { bid: 3, tricks: 3, out: false, adj: 0 };
  game.rounds[0].entries[game.players[1].id] = { bid: 0, tricks: 0, out: false, adj: 0 };
  game.rounds[0].phase = PHASE.DONE;
  assert.equal(M.isComplete(game), true, 'one played round is enough to finish');
});

test('the dealer rule binds whoever actually bids last', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [4], { banFrom: 1 });
  const round = game.rounds[0];
  const [ana, ben, cleo] = game.players.map((p) => p.id);
  assert.equal(round.dealerId, ana);
  assert.equal(M.constrainedBidderId(game, round), ana, 'normally the dealer');

  // With the dealer sitting out, the constraint falls to the previous seat.
  round.entries[ana].out = true;
  assert.equal(M.constrainedBidderId(game, round), cleo);

  round.entries[ben].bid = 2;
  assert.equal(M.forbiddenDealerBid(game, round), 2, 'Cleo may not make it total 4');

  round.entries[cleo].bid = 2;
  const state = M.bidState(game, round);
  assert.equal(state.violates, true);
  assert.equal(state.constrainedId, cleo, 'and the UI can name the right player');
});

test('a reopened round keeps counting until it is re-recorded', () => {
  // Otherwise the standings drop by that round's points the moment you open it
  // to fix a typo, showing a total that matches no moment in the game.
  const game = makeGame(['Ana', 'Ben'], [2, 2]);
  const [ana, ben] = game.players.map((p) => p.id);
  for (const round of game.rounds) {
    round.entries[ana] = { bid: 2, tricks: 2, out: false, adj: 0 };
    round.entries[ben] = { bid: 0, tricks: 0, out: false, adj: 0 };
    round.phase = PHASE.DONE;
    round.recorded = true;
  }
  const before = M.totals(game);
  assert.equal(before[ana], 30);

  game.rounds[0].phase = PHASE.TRICKS; // reopened for correction
  assert.deepEqual(M.totals(game), before, 'the board does not dip');

  // Editing it moves the total live, which is the point of correcting it.
  game.rounds[0].entries[ana].tricks = 1;
  assert.equal(M.totals(game)[ana], 30 - 15 + -5);
});

test('the bidding order of a played round is frozen against later reordering', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo', 'Dov'], [3]);
  const round = game.rounds[0];
  const played = M.bidOrder(game, round).map((id) => M.playerById(game, id).name);
  assert.deepEqual(played, ['Ben', 'Cleo', 'Dov', 'Ana']);

  round.order = M.bidOrder(game, round);
  round.recorded = true;
  round.phase = PHASE.DONE;

  M.movePlayer(game, 0, 3); // shuffle the seats afterwards
  assert.deepEqual(
    M.bidOrder(game, round).map((id) => M.playerById(game, id).name),
    played,
    'history still reports the order it was played in'
  );

  // A later joiner still shows up, appended rather than silently dropped.
  const eve = M.addPlayer(game, 'Eve');
  assert.deepEqual(M.bidOrder(game, round).map((id) => M.playerById(game, id).name), [...played, 'Eve']);
  // And somebody who leaves drops out of it.
  M.removePlayer(game, eve.id);
  assert.deepEqual(M.bidOrder(game, round).map((id) => M.playerById(game, id).name), played);
});

test('changing the dealer of a round unfreezes its order', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [2]);
  const round = game.rounds[0];
  round.order = M.bidOrder(game, round);

  M.setDealer(game, 0, game.players[1].id);
  assert.equal(round.order, null);
  assert.equal(M.playerById(game, M.leadOf(game, round)).name, 'Cleo');
});

test('withdrawing a player keeps their score and sits them out of what is left', () => {
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [2, 2]);
  const [ana, ben, cleo] = game.players.map((p) => p.id);
  for (const id of [ana, ben, cleo]) {
    game.rounds[0].entries[id] = { bid: id === ana ? 2 : 0, tricks: id === ana ? 2 : 0, out: false, adj: 0 };
  }
  game.rounds[0].phase = PHASE.DONE;
  game.rounds[0].recorded = true;
  const earned = M.totals(game)[cleo];

  assert.equal(M.setWithdrawn(game, cleo), true);

  assert.equal(M.totals(game)[cleo], earned, 'what they scored still stands');
  assert.equal(game.rounds[0].entries[cleo].out, false, 'the round they played is untouched');
  assert.equal(game.rounds[1].entries[cleo].out, true, 'they sit out what is left');
  assert.equal(M.activePlayerIds(game, game.rounds[1]).includes(cleo), false);

  // Rounds added after they leave also default them out.
  const added = M.appendRound(game, 3);
  assert.equal(added.entries[cleo].out, true);

  // And it is reversible.
  M.setWithdrawn(game, cleo, false);
  assert.equal(game.rounds[1].entries[cleo].out, false);
});

test('a withdrawn player does not break the trick count of a played round', () => {
  // The contrast with removePlayer, which strips their entries and leaves the
  // hand short.
  const game = makeGame(['Ana', 'Ben', 'Cleo'], [3]);
  const [ana, ben, cleo] = game.players.map((p) => p.id);
  game.rounds[0].entries[ana] = { bid: 1, tricks: 1, out: false, adj: 0 };
  game.rounds[0].entries[ben] = { bid: 1, tricks: 1, out: false, adj: 0 };
  game.rounds[0].entries[cleo] = { bid: 1, tricks: 1, out: false, adj: 0 };
  game.rounds[0].phase = PHASE.DONE;
  game.rounds[0].recorded = true;

  M.setWithdrawn(game, cleo);
  assert.equal(M.trickState(game, game.rounds[0]).ok, true, 'the played hand still adds up');
});

test('sanitizeGame does not let empty values masquerade as zero', () => {
  const defaults = M.defaultConfig();
  const repaired = M.sanitizeGame({
    players: [{ name: 'Ana' }, { name: 'Ben' }],
    cfg: { ptsBid: null, ptsTrick: '', ptsMiss: [], banFrom: true },
    rounds: [],
  });
  assert.equal(repaired.cfg.ptsBid, defaults.ptsBid);
  assert.equal(repaired.cfg.ptsTrick, defaults.ptsTrick);
  assert.equal(repaired.cfg.ptsMiss, defaults.ptsMiss);
  assert.equal(repaired.cfg.banFrom, defaults.banFrom);
});

test('sanitizeGame validates the plan spec numbers, not just its words', () => {
  const defaults = M.defaultPlanSpec();
  const repaired = M.sanitizeGame({
    players: [{ name: 'Ana' }, { name: 'Ben' }],
    planSpec: { maxCards: 'lots', minCards: -5, shape: 'up', parity: 'odd' },
    rounds: [],
  });
  assert.equal(repaired.planSpec.maxCards, defaults.maxCards);
  assert.equal(repaired.planSpec.minCards, 1, 'clamped into range');
  assert.equal(repaired.planSpec.shape, 'up', 'valid values are kept');
  assert.equal(repaired.planSpec.parity, 'odd');
});

test('sanitizeGame refuses a record from a newer schema rather than mangling it', () => {
  // Stamping it as current would discard fields this build cannot see and then
  // write the lossy version back over the original.
  const future = M.sanitizeGame({
    v: M.SCHEMA_VERSION + 1,
    players: [{ name: 'Ana' }, { name: 'Ben' }],
    rounds: [],
    somethingNew: 'kept for the build that understands it',
  });
  assert.equal(future, null);

  // The current version, and anything older, still reads.
  assert.ok(M.sanitizeGame({ v: M.SCHEMA_VERSION, players: [{ name: 'Ana' }, { name: 'Ben' }], rounds: [] }));
  assert.ok(M.sanitizeGame({ v: 1, players: [{ name: 'Ana' }, { name: 'Ben' }], rounds: [] }));
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
