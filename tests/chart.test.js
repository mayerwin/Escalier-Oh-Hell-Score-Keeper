import assert from 'node:assert/strict';
import test from 'node:test';

import { axisTicks, buildSeries, scoreUnit } from '../src/chart.js';
import * as M from '../src/model.js';

/** Every gridline the axis would draw, for the range and unit given. */
function ticks(lo, hi, unit) {
  const axis = axisTicks(lo, hi, unit);
  const out = [];
  for (let v = axis.lo; v <= axis.hi + axis.step / 2; v += axis.step) out.push(v);
  return out;
}

function game(cfg = {}) {
  return M.createGame({
    name: 'T',
    players: [{ name: 'Ana' }, { name: 'Ben' }],
    plan: [2, 1],
    cfg,
  });
}

test('the scoring unit is the step the scores can actually move in', () => {
  assert.equal(scoreUnit(game()), 5, 'the 5/5/5 default');
  assert.equal(scoreUnit(game({ ptsBid: 10, ptsTrick: 10, ptsMiss: 10 })), 10);
  assert.equal(scoreUnit(game({ ptsBid: 10, ptsTrick: 5, ptsMiss: 15 })), 5);
  assert.equal(scoreUnit(game({ ptsBid: 3, ptsTrick: 3, ptsMiss: 3 })), 3);
  assert.equal(scoreUnit(game({ ptsBid: 7, ptsTrick: 3, ptsMiss: 5 })), 1);
});

test('a scoring dial set to zero does not drag the unit down to one', () => {
  // 0 contributes nothing to a gcd, so a game that simply does not award a
  // bonus still moves in fives.
  assert.equal(scoreUnit(game({ ptsBid: 0, ptsTrick: 5, ptsMiss: 5 })), 5);
  assert.equal(scoreUnit(game({ ptsBid: 0, ptsTrick: 0, ptsMiss: 0 })), 1, 'nothing to go on');
});

/** Play a round out, straight on the entries the way the store does. */
function play(g, round, results) {
  for (const [seat, [bid, tricks, adj]] of results.entries()) {
    const entry = M.entryOf(round, g.players[seat].id);
    entry.bid = bid;
    entry.tricks = tricks;
    if (adj) entry.adj = adj;
  }
  round.phase = M.PHASE.DONE;
  round.recorded = true;
}

test('one odd adjustment makes every whole number reachable, and says so', () => {
  const g = game();
  play(g, g.rounds[0], [
    [2, 2, 3],
    [0, 0, 0],
  ]);
  assert.equal(scoreUnit(g), 1);

  const tidy = game();
  play(tidy, tidy.rounds[0], [
    [2, 2, 10],
    [0, 0, 0],
  ]);
  assert.equal(scoreUnit(tidy), 5, 'an adjustment already on the unit changes nothing');
});

test('a carry-in off the unit counts too', () => {
  const g = game();
  g.players[1].carryIn = 12;
  assert.equal(scoreUnit(g), 1);

  const tidy = game();
  tidy.players[1].carryIn = 15;
  assert.equal(scoreUnit(tidy), 5, 'a carry-in already on the unit changes nothing');
});

test('every gridline is a score that can be reached', () => {
  for (const unit of [1, 3, 5, 10]) {
    for (const [lo, hi] of [
      [0, 47],
      [-12, 63],
      [-250, 900],
      [0, 4],
    ]) {
      for (const value of ticks(lo, hi, unit)) {
        // `|| 0` because -20 % 1 is negative zero, which strict equality
        // insists is not the same number as zero.
        assert.equal(value % unit || 0, 0, `${value} is not a multiple of ${unit}`);
      }
    }
  }
});

test('the axis always contains the data', () => {
  for (const [lo, hi, unit] of [
    [0, 47, 5],
    [-12, 63, 5],
    [-7, 41, 3],
    [0, 9, 1],
  ]) {
    const axis = axisTicks(lo, hi, unit);
    assert.ok(axis.lo <= lo, `${axis.lo} does not reach ${lo}`);
    assert.ok(axis.hi >= hi, `${axis.hi} does not reach ${hi}`);
  }
});

test('the step is a round number wherever one lands on the unit', () => {
  // 20 rather than 25: both are multiples of five, only one is read without
  // thinking about it.
  assert.deepEqual(ticks(-12, 63, 5), [-20, 0, 20, 40, 60, 80]);
  assert.deepEqual(ticks(0, 47, 5), [0, 10, 20, 30, 40, 50]);
  // Nothing round is a multiple of three, so the unit's own multiples serve.
  assert.deepEqual(ticks(0, 61, 3), [0, 15, 30, 45, 60, 75]);
});

test('the axis never draws more lines than it can fit', () => {
  for (const unit of [1, 3, 5, 10]) {
    for (let hi = 1; hi < 4000; hi = Math.ceil(hi * 1.7)) {
      assert.ok(ticks(-hi, hi, unit).length <= 6, `unit ${unit}, range ±${hi}`);
    }
  }
});

test('a game where nobody has scored still produces an axis', () => {
  assert.deepEqual(ticks(0, 0, 5), [-5, 0, 5]);
});

test('cumulative series start from the carry-in, per-round series do not', () => {
  const g = game();
  g.players[0].carryIn = 20;
  play(g, g.rounds[0], [
    [2, 2, 0],
    [1, 0, 0],
  ]);

  const cumulative = buildSeries(g, 'cumulative').series[0];
  assert.equal(cumulative.opening, 20);
  assert.equal(cumulative.values[0], 20 + M.calcPoints(2, 2, g.cfg));

  const perRound = buildSeries(g, 'round').series[0];
  assert.equal(perRound.values[0], M.calcPoints(2, 2, g.cfg));
});
