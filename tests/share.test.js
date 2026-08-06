import test from 'node:test';
import assert from 'node:assert/strict';

import * as M from '../src/model.js';
import {
  LONG_URL,
  base64UrlToBytes,
  buildShareUrl,
  bytesToBase64Url,
  decodePayload,
  encodeGame,
  packGame,
  readSharePayload,
  unpackGame,
} from '../src/share.js';

/** A fully played game, the realistic worst case for payload size. */
function playedGame({ players = 6, rounds = 20 } = {}) {
  const game = M.createGame({
    name: 'Soirée du 24',
    players: Array.from({ length: players }, (_, i) => ({ name: `Player ${i + 1}` })),
    plan: Array.from({ length: rounds }, (_, i) => ((i % 10) + 1)),
    cfg: { ptsBid: 10, ptsTrick: 1, ptsMiss: 2, strict: true, banFrom: 4 },
  });

  for (const round of game.rounds) {
    let left = round.cards;
    game.players.forEach((p, i) => {
      const tricks = i === game.players.length - 1 ? left : Math.min(left, i % 3);
      left -= tricks;
      round.entries[p.id] = { bid: Math.min(round.cards, (i + 1) % 4), tricks, out: false, adj: 0 };
    });
    round.phase = M.PHASE.DONE;
  }
  game.finished = true;
  return game;
}

test('base64url round-trips arbitrary bytes without padding', () => {
  for (const length of [0, 1, 2, 3, 17, 255]) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) bytes[i] = (i * 37) % 256;
    const encoded = bytesToBase64Url(bytes);
    assert.doesNotMatch(encoded, /[+/=]/, 'stays URL-safe');
    assert.deepEqual(Array.from(base64UrlToBytes(encoded)), Array.from(bytes));
  }
});

test('packGame keeps names, scoring and every result', () => {
  const game = playedGame({ players: 3, rounds: 4 });
  const restored = unpackGame(packGame(game));

  assert.equal(restored.name, game.name);
  assert.equal(restored.finished, true);
  assert.deepEqual(restored.cfg, game.cfg);
  assert.deepEqual(restored.players.map((p) => p.name), game.players.map((p) => p.name));
  assert.deepEqual(restored.players.map((p) => p.color), game.players.map((p) => p.color));
  assert.deepEqual(restored.rounds.map((r) => r.cards), game.rounds.map((r) => r.cards));
  assert.deepEqual(restored.rounds.map((r) => r.phase), game.rounds.map((r) => r.phase));

  // Scores must survive exactly; that is the entire point of sharing.
  const before = M.standings(game).map((r) => [r.name, r.score]);
  const after = M.standings(restored).map((r) => [r.name, r.score]);
  assert.deepEqual(after, before);
});

test('the deal and the opener survive a round trip', () => {
  const game = playedGame({ players: 4, rounds: 4 });
  const restored = unpackGame(packGame(game));
  assert.deepEqual(
    restored.rounds.map((r) => M.playerById(restored, r.dealerId).name),
    game.rounds.map((r) => M.playerById(game, r.dealerId).name)
  );
  assert.deepEqual(
    restored.rounds.map((r) => M.playerById(restored, M.leadOf(restored, r)).name),
    game.rounds.map((r) => M.playerById(game, M.leadOf(game, r)).name)
  );
});

test('unfinished rounds, sat-out players and adjustments survive', () => {
  const game = M.createGame({ players: [{ name: 'Ana' }, { name: 'Ben' }], plan: [3, 3] });
  const [ana, ben] = game.players.map((p) => p.id);
  game.rounds[0].entries[ana] = { bid: 0, tricks: 3, out: false, adj: -4 };
  game.rounds[0].entries[ben] = { bid: 3, tricks: 0, out: false, adj: 0 };
  game.rounds[0].phase = M.PHASE.DONE;
  game.rounds[1].entries[ana] = { bid: null, tricks: null, out: true, adj: 0 };
  game.rounds[1].entries[ben] = { bid: 2, tricks: null, out: false, adj: 0 };
  game.rounds[1].phase = M.PHASE.BIDDING;

  const restored = unpackGame(packGame(game));
  const [ra, rb] = restored.players.map((p) => p.id);

  assert.equal(restored.rounds[0].entries[ra].adj, -4);
  assert.equal(restored.rounds[0].entries[ra].bid, 0, 'a bid of zero is not confused with "no bid"');
  assert.equal(restored.rounds[1].entries[ra].out, true);
  assert.equal(restored.rounds[1].entries[rb].bid, 2);
  assert.equal(restored.rounds[1].entries[rb].tricks, null);
  assert.equal(restored.rounds[1].phase, M.PHASE.BIDDING);
});

test('an imported game gets fresh ids so it cannot overwrite a local one', () => {
  const game = playedGame({ players: 2, rounds: 2 });
  const restored = unpackGame(packGame(game));
  assert.notEqual(restored.id, game.id);
  assert.equal(
    game.players.some((p) => restored.players.some((q) => q.id === p.id)),
    false
  );
});

test('encode/decode round-trips through the compressed payload', async () => {
  const game = playedGame({ players: 5, rounds: 12 });
  const payload = await encodeGame(game);
  assert.equal(payload[0], 'A', 'compression is used when the platform has it');

  const restored = await decodePayload(payload);
  assert.deepEqual(
    M.standings(restored).map((r) => [r.name, r.score]),
    M.standings(game).map((r) => [r.name, r.score])
  );
});

test('the uncompressed fallback payload also round-trips', async () => {
  const game = playedGame({ players: 3, rounds: 3 });
  const json = JSON.stringify(packGame(game));
  const payload = `B${bytesToBase64Url(new TextEncoder().encode(json))}`;
  const restored = await decodePayload(payload);
  assert.equal(restored.players.length, 3);
  assert.equal(restored.rounds.length, 3);
});

test('a full six-player game fits comfortably in a URL', async () => {
  const game = playedGame({ players: 6, rounds: 20 });
  const url = await buildShareUrl(game, 'https://example.github.io/Escalier-Oh-Hell-Score-Keeper/');
  assert.ok(url.startsWith('https://example.github.io/Escalier-Oh-Hell-Score-Keeper/#g='));
  assert.ok(url.length < LONG_URL, `expected a short URL, got ${url.length} characters`);
  // Every browser handles at least 2000; this keeps a wide margin.
  assert.ok(url.length < 2000);
});

test('accented and non-Latin names survive the codec', async () => {
  const game = M.createGame({
    name: 'Fête d’hiver',
    players: [{ name: 'Zoé' }, { name: 'Björn' }, { name: '桜' }],
    plan: [2],
  });
  const restored = await decodePayload(await encodeGame(game));
  assert.deepEqual(restored.players.map((p) => p.name), ['Zoé', 'Björn', '桜']);
  assert.equal(restored.name, 'Fête d’hiver');
});

test('buildShareUrl replaces any fragment already on the base URL', async () => {
  const game = playedGame({ players: 2, rounds: 1 });
  const url = await buildShareUrl(game, 'https://example.com/app/#g=stale');
  assert.equal(url.split('#').length, 2);
  assert.ok(url.startsWith('https://example.com/app/#g='));
});

test('readSharePayload finds the payload in URLs and bare fragments', () => {
  assert.equal(readSharePayload('https://example.com/#g=ABC'), 'ABC');
  assert.equal(readSharePayload('#g=ABC'), 'ABC');
  assert.equal(readSharePayload('g=ABC'), 'ABC');
  assert.equal(readSharePayload('#lang=fr&g=ABC'), 'ABC');
  assert.equal(readSharePayload('#other=1'), null);
  assert.equal(readSharePayload('https://example.com/'), null);
  assert.equal(readSharePayload(''), null);
  assert.equal(readSharePayload(null), null);
});

test('damaged payloads are rejected rather than half-imported', async () => {
  await assert.rejects(() => decodePayload(''));
  await assert.rejects(() => decodePayload('Z123'), /unknown payload format/);
  await assert.rejects(() => decodePayload('A!!!!not-base64!!!!'));
  await assert.rejects(() => decodePayload(`B${bytesToBase64Url(new TextEncoder().encode('{'))}`));
  await assert.rejects(() => decodePayload(`B${bytesToBase64Url(new TextEncoder().encode('[1,2]'))}`), /bad payload/);
  await assert.rejects(
    () => decodePayload(`B${bytesToBase64Url(new TextEncoder().encode('[2,"n",0,0,[],[],0,[]]'))}`),
    /no players/
  );
});

test('a truncated compressed payload does not throw something unexpected', async () => {
  const game = playedGame({ players: 3, rounds: 3 });
  const payload = await encodeGame(game);
  const truncated = payload.slice(0, Math.floor(payload.length * 0.6));
  await assert.rejects(() => decodePayload(truncated));
});
