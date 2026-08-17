/**
 * L'Escalier — pure game engine.
 *
 * This module is deliberately free of DOM and storage concerns so it can be
 * unit-tested under plain Node. Every exported function is either a pure
 * calculation or a well-scoped mutation of a game object passed in.
 *
 * Data model
 * ----------
 * A game owns an ordered list of `rounds`. That list *is* the "escalier" (the
 * staircase of card counts) and it stays fully editable for the whole life of
 * the game: rounds can be inserted, removed, resized or skipped at any time,
 * including after they have been played.
 *
 * Per-round results are stored in `entries`, keyed by player id rather than by
 * seat index. Keying by id means reordering, adding or removing a player can
 * never silently shift somebody else's score onto the wrong row.
 */

export const SCHEMA_VERSION = 2;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const DECK_SIZE = 52;
export const MAX_CARDS = 52;

/** Round lifecycle. `skipped` rounds stay in the list but are never played. */
export const PHASE = Object.freeze({
  PENDING: 'pending',
  BIDDING: 'bidding',
  TRICKS: 'tricks',
  DONE: 'done',
  SKIPPED: 'skipped',
});

export const SHAPES = Object.freeze(['down', 'up', 'updown', 'downup']);
export const PARITIES = Object.freeze(['all', 'odd', 'even']);

/**
 * Player colours. Chosen to stay distinguishable against both the light
 * "ledger paper" and dark "baize" themes, and to remain separable for the most
 * common colour-vision deficiencies (no red/green-only neighbouring pairs).
 */
export const PALETTE = Object.freeze([
  '#c0392b', // vermilion
  '#2467a8', // ink blue
  '#2f8f5b', // baize green
  '#8e44ad', // aubergine
  '#d68910', // amber
  '#12897e', // teal
  '#c0398b', // magenta
  '#6d4c41', // walnut
  '#4b6cb7', // periwinkle
  '#7f8c1f', // olive
]);

let idCounter = 0;

/**
 * Collision-resistant id that does not depend on crypto being available
 * (some browsers withhold crypto.randomUUID on insecure origins).
 */
export function uid(prefix = 'x') {
  idCounter = (idCounter + 1) % 0xffff;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  const seq = idCounter.toString(36);
  return `${prefix}_${time}${seq}${rand}`;
}

/** Reset the id sequence. Test-only helper; harmless in production. */
export function __resetIdCounter() {
  idCounter = 0;
}

export function defaultConfig() {
  return {
    ptsBid: 5, // bonus awarded when the bid is met exactly
    ptsTrick: 5, // per trick won, when the bid is met
    ptsMiss: 5, // per trick of deviation, when the bid is missed
    strict: false, // also award ptsTrick per trick when the bid is missed
    banFrom: 3, // "screw the dealer" applies from this many cards (0 = never)
  };
}

/**
 * `maxCards` is only a fallback here: the model has no idea how many players
 * are at the table, and the real ceiling is what one deck can deal to them.
 * Setup picks that instead, from `maxCardsFor`.
 */
export function defaultPlanSpec() {
  return { shape: 'updown', maxCards: 8, minCards: 1, parity: 'all' };
}

/** Largest number of cards each player can receive from a single deck. */
export function maxCardsFor(playerCount) {
  if (!playerCount || playerCount < 1) return MAX_CARDS;
  return Math.max(1, Math.floor(DECK_SIZE / playerCount));
}

export function clamp(value, lo, hi) {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Expand a plan spec into the ordered list of card counts.
 * `updown`/`downup` do not repeat the turning point.
 */
export function buildPlan(spec) {
  const s = { ...defaultPlanSpec(), ...spec };
  const lo = clamp(Math.round(s.minCards), 1, MAX_CARDS);
  const hi = clamp(Math.round(s.maxCards), 1, MAX_CARDS);
  const from = Math.min(lo, hi);
  const to = Math.max(lo, hi);

  const ascending = [];
  for (let n = from; n <= to; n += 1) {
    if (s.parity === 'odd' && n % 2 === 0) continue;
    if (s.parity === 'even' && n % 2 !== 0) continue;
    ascending.push(n);
  }
  if (ascending.length === 0) return [];

  const descending = ascending.slice().reverse();
  switch (s.shape) {
    case 'up':
      return ascending;
    case 'updown':
      return ascending.concat(descending.slice(1));
    case 'downup':
      return descending.concat(ascending.slice(1));
    case 'down':
    default:
      return descending;
  }
}

export function makePlayer(name, color, extra = {}) {
  return { id: uid('p'), name, color, carryIn: 0, ...extra };
}

export function makeEntry() {
  return { bid: null, tricks: null, out: false, adj: 0 };
}

export function makeRound(cards, overrides = {}) {
  return {
    id: uid('r'),
    cards: clamp(Math.round(cards), 1, MAX_CARDS),
    dealerId: null,
    dealerLocked: false,
    phase: PHASE.PENDING,
    /**
     * Set the first time the round is recorded and never cleared. Reopening a
     * round for correction takes it out of `done`, but its result still stands
     * until it is re-recorded — without this the standings would drop the
     * round mid-edit and show a total matching no moment in the game.
     */
    recorded: false,
    /**
     * The bidding order as it actually happened, frozen at record time. The
     * order is otherwise derived from the current seats, so reordering the
     * table would rewrite history.
     */
    order: null,
    entries: {},
    ...overrides,
  };
}

/**
 * Build a fresh game. `players` is a list of `{name, color?}`; ids are assigned
 * here so callers never have to.
 */
export function createGame({ name = '', players = [], cfg = {}, plan = [], firstDealerId = null } = {}) {
  const game = {
    v: SCHEMA_VERSION,
    id: uid('g'),
    name,
    created: Date.now(),
    updated: Date.now(),
    finished: false,
    players: players.map((p, i) =>
      p.id ? { carryIn: 0, ...p } : makePlayer(p.name, p.color || PALETTE[i % PALETTE.length])
    ),
    cfg: { ...defaultConfig(), ...cfg },
    planSpec: defaultPlanSpec(),
    firstDealerId,
    rounds: plan.map((cards) => makeRound(cards)),
  };
  if (!game.firstDealerId && game.players.length) game.firstDealerId = game.players[0].id;
  syncEntries(game);
  normalizeDealers(game);
  return game;
}

/* ------------------------------------------------------------------ seats */

export function playerById(game, id) {
  return game.players.find((p) => p.id === id) || null;
}

export function seatIndex(game, id) {
  return game.players.findIndex((p) => p.id === id);
}

/**
 * The seat `step` places along the table from `id`.
 *
 * The deal always passes down the seat list. A table that plays the other way
 * round simply enters its players in the other order, which keeps one source
 * of truth for "who is next" instead of two.
 */
export function seatAt(game, id, step = 1) {
  const n = game.players.length;
  if (n === 0) return null;
  const i = seatIndex(game, id);
  if (i < 0) return game.players[0].id;
  const j = (((i + step) % n) + n) % n;
  return game.players[j].id;
}

export function nextSeat(game, id) {
  return seatAt(game, id, 1);
}

export function prevSeat(game, id) {
  return seatAt(game, id, -1);
}

/**
 * Reassign dealers across the whole staircase.
 *
 * Rounds that are already played, or whose dealer the user pinned by hand, act
 * as anchors and are never rewritten — history stays truthful. Everything else
 * follows the rotation from the previous anchor. Skipped rounds are not dealt
 * at all, so they do not consume a turn in the rotation.
 */
export function normalizeDealers(game) {
  if (!game.players.length) {
    game.rounds.forEach((r) => {
      r.dealerId = null;
    });
    return game;
  }
  if (!playerById(game, game.firstDealerId)) game.firstDealerId = game.players[0].id;

  let prev = null;
  for (const round of game.rounds) {
    if (round.phase === PHASE.SKIPPED) {
      round.dealerId = null;
      continue;
    }
    const anchored = round.phase === PHASE.DONE || round.dealerLocked;
    if (anchored && playerById(game, round.dealerId)) {
      prev = round.dealerId;
      continue;
    }
    round.dealerId = prev === null ? game.firstDealerId : nextSeat(game, prev);
    prev = round.dealerId;
  }
  return game;
}

/**
 * Who bids and plays first in this round.
 *
 * Always the seat after the dealer — that is what "the deal passes" means, and
 * decoupling the two would let the rotation drift out of step with the table.
 * To hand the opening bid to somebody else, move the deal (see `setOpener`).
 */
export function leadOf(game, round) {
  if (!round) return null;
  if (!round.dealerId) return game.players.length ? game.players[0].id : null;
  return nextSeat(game, round.dealerId);
}

/**
 * Player ids in bidding order: first bidder first, dealer last.
 *
 * A round that has been played reports the order it was actually played in.
 * Players who have since left drop out, and anyone who joined later is
 * appended so they still appear.
 */
export function bidOrder(game, round) {
  const n = game.players.length;
  if (!n) return [];

  if (round && Array.isArray(round.order) && round.order.length) {
    const present = new Set(game.players.map((p) => p.id));
    const kept = round.order.filter((id) => present.has(id));
    if (kept.length) {
      const seen = new Set(kept);
      return kept.concat(game.players.map((p) => p.id).filter((id) => !seen.has(id)));
    }
  }

  const lead = leadOf(game, round);
  const start = Math.max(0, seatIndex(game, lead));
  const order = [];
  for (let k = 0; k < n; k += 1) {
    order.push(game.players[(start + k) % n].id);
  }
  return order;
}

/* ---------------------------------------------------------------- entries */

/** Guarantee every round has exactly one entry per current player. */
export function syncEntries(game) {
  const ids = new Set(game.players.map((p) => p.id));
  const withdrawn = new Set(game.players.filter((p) => p.withdrawn).map((p) => p.id));
  for (const round of game.rounds) {
    if (!round.entries || typeof round.entries !== 'object') round.entries = {};
    for (const id of ids) {
      if (!round.entries[id]) {
        const entry = makeEntry();
        // Somebody who has left the table sits out anything not yet played,
        // including rounds inserted after they went.
        if (withdrawn.has(id) && round.phase !== PHASE.DONE) entry.out = true;
        round.entries[id] = entry;
      }
    }
    for (const key of Object.keys(round.entries)) {
      if (!ids.has(key)) delete round.entries[key];
    }
  }
  return game;
}

export function entryOf(round, playerId) {
  return (round.entries && round.entries[playerId]) || null;
}

/* ---------------------------------------------------------------- scoring */

/**
 * Points for one player in one round.
 *   bid met      -> ptsBid + tricks * ptsTrick
 *   bid missed   -> -ptsMiss * |bid - tricks|, plus tricks * ptsTrick in strict mode
 */
export function calcPoints(bid, tricks, cfg) {
  const b = Number.isFinite(bid) ? bid : 0;
  const t = Number.isFinite(tricks) ? tricks : 0;
  if (b === t) return cfg.ptsBid + t * cfg.ptsTrick;
  const penalty = -cfg.ptsMiss * Math.abs(b - t);
  return cfg.strict ? penalty + t * cfg.ptsTrick : penalty;
}

/** Points actually credited for an entry, including any manual adjustment. */
export function entryPoints(entry, cfg) {
  if (!entry) return 0;
  const adj = Number.isFinite(entry.adj) ? entry.adj : 0;
  if (entry.out) return adj;
  if (entry.bid === null || entry.tricks === null) return adj;
  return calcPoints(entry.bid, entry.tricks, cfg) + adj;
}

/**
 * True when a round's result counts towards the standings. A round that has
 * been recorded keeps counting while it is reopened for correction, so the
 * board never dips to a figure that was never real.
 */
export function roundCounts(round) {
  return round.phase === PHASE.DONE || round.recorded === true;
}

/**
 * Running totals after the first `count` rounds of the list (default: all).
 * Returns a map of playerId -> score.
 */
export function scoresAfter(game, count = game.rounds.length) {
  const out = {};
  for (const p of game.players) out[p.id] = Number.isFinite(p.carryIn) ? p.carryIn : 0;
  const limit = clamp(count, 0, game.rounds.length);
  for (let i = 0; i < limit; i += 1) {
    const round = game.rounds[i];
    if (!roundCounts(round)) continue;
    for (const p of game.players) {
      out[p.id] += entryPoints(entryOf(round, p.id), game.cfg);
    }
  }
  return out;
}

export function totals(game) {
  return scoresAfter(game, game.rounds.length);
}

/**
 * Standings, best first. Ties share a rank and are then ordered by seat so the
 * list never jitters between renders.
 */
export function standings(game) {
  const scores = totals(game);
  const rows = game.players.map((p, seat) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    seat,
    score: scores[p.id] || 0,
  }));
  rows.sort((a, b) => b.score - a.score || a.seat - b.seat);
  let rank = 0;
  let prevScore = null;
  rows.forEach((row, i) => {
    if (prevScore === null || row.score !== prevScore) rank = i + 1;
    row.rank = rank;
    prevScore = row.score;
  });
  return rows;
}

/* ------------------------------------------------------------- round flow */

export function playableRounds(game) {
  return game.rounds.filter((r) => r.phase !== PHASE.SKIPPED);
}

/** Index of the round currently in play, or -1 when the staircase is done. */
export function currentRoundIndex(game) {
  return game.rounds.findIndex((r) => r.phase !== PHASE.DONE && r.phase !== PHASE.SKIPPED);
}

export function currentRound(game) {
  const i = currentRoundIndex(game);
  return i < 0 ? null : game.rounds[i];
}

/**
 * True when the staircase has been played out. Skipping every round leaves
 * nothing to play but is not a finished game — announcing a winner for a game
 * in which no hand was dealt would be nonsense.
 */
export function isComplete(game) {
  return currentRoundIndex(game) < 0 && game.rounds.some((r) => r.phase === PHASE.DONE);
}

export function progress(game) {
  const playable = playableRounds(game);
  const done = playable.filter((r) => r.phase === PHASE.DONE).length;
  return { done, total: playable.length };
}

/* ------------------------------------------------------------ validation */

export function activePlayerIds(game, round) {
  return bidOrder(game, round).filter((id) => {
    const e = entryOf(round, id);
    return e && !e.out;
  });
}

function sumField(game, round, field) {
  let sum = 0;
  for (const id of activePlayerIds(game, round)) {
    const v = entryOf(round, id)[field];
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

/** True when the "screw the dealer" restriction applies to this round. */
export function banApplies(game, round) {
  const from = game.cfg.banFrom;
  return Number.isFinite(from) && from > 0 && round.cards >= from;
}

/**
 * Who the "screw the dealer" rule actually binds: the last player to bid.
 *
 * Normally that is the dealer, since `bidOrder` puts them last. When the
 * dealer is sitting the round out, the constraint falls to whoever does speak
 * last — otherwise the rule would block the round while pointing at somebody
 * who is not even playing.
 */
export function constrainedBidderId(game, round) {
  const active = activePlayerIds(game, round);
  return active.length ? active[active.length - 1] : null;
}

/**
 * The bid the last bidder is forbidden from making, or null when the rule is
 * off or somebody else still has to bid.
 *
 * Returns a value even when it is out of the legal 0..cards range; callers can
 * ignore it in that case since it is then unreachable anyway.
 */
export function forbiddenDealerBid(game, round) {
  if (!banApplies(game, round)) return null;
  const constrainedId = constrainedBidderId(game, round);
  if (!constrainedId) return null;
  let others = 0;
  for (const id of activePlayerIds(game, round)) {
    if (id === constrainedId) continue;
    const bid = entryOf(round, id).bid;
    if (!Number.isFinite(bid)) return null; // somebody has not bid yet
    others += bid;
  }
  return round.cards - others;
}

export function bidState(game, round) {
  const active = activePlayerIds(game, round);
  const missing = active.filter((id) => !Number.isFinite(entryOf(round, id).bid));
  const sum = sumField(game, round, 'bid');
  const applies = banApplies(game, round);
  const violates = applies && missing.length === 0 && sum === round.cards;
  return {
    sum,
    cards: round.cards,
    diff: sum - round.cards,
    missing: missing.length,
    complete: missing.length === 0 && active.length > 0,
    banApplies: applies,
    forbidden: forbiddenDealerBid(game, round),
    constrainedId: applies ? constrainedBidderId(game, round) : null,
    violates,
    ok: missing.length === 0 && active.length > 0 && !violates,
  };
}

export function trickState(game, round) {
  const active = activePlayerIds(game, round);
  const missing = active.filter((id) => !Number.isFinite(entryOf(round, id).tricks));
  const sum = sumField(game, round, 'tricks');
  return {
    sum,
    cards: round.cards,
    diff: sum - round.cards,
    remaining: round.cards - sum,
    missing: missing.length,
    complete: missing.length === 0 && active.length > 0,
    ok: missing.length === 0 && active.length > 0 && sum === round.cards,
  };
}

/* ------------------------------------------------- structural round edits */

/** Insert a new round at `at`, then re-derive dealers for unplayed rounds. */
export function insertRound(game, at, cards) {
  const index = clamp(Math.round(at), 0, game.rounds.length);
  const round = makeRound(cards);
  game.rounds.splice(index, 0, round);
  syncEntries(game);
  normalizeDealers(game);
  return round;
}

export function appendRound(game, cards) {
  return insertRound(game, game.rounds.length, cards);
}

export function duplicateRound(game, index) {
  const src = game.rounds[index];
  if (!src) return null;
  return insertRound(game, index + 1, src.cards);
}

export function removeRound(game, index) {
  if (index < 0 || index >= game.rounds.length) return false;
  game.rounds.splice(index, 1);
  normalizeDealers(game);
  return true;
}

/**
 * Resize a hand. Refused for a round already recorded: clamping its bids and
 * tricks would silently rewrite a result nobody asked to change, and leave the
 * round failing its own validation. Reopen it first.
 */
export function setRoundCards(game, index, cards) {
  const round = game.rounds[index];
  if (!round || round.phase === PHASE.DONE) return false;
  round.cards = clamp(Math.round(cards), 1, MAX_CARDS);
  // Bids and tricks can no longer exceed the new hand size.
  for (const id of Object.keys(round.entries)) {
    const e = round.entries[id];
    if (Number.isFinite(e.bid)) e.bid = clamp(e.bid, 0, round.cards);
    if (Number.isFinite(e.tricks)) e.tricks = clamp(e.tricks, 0, round.cards);
  }
  return true;
}

/** Skip or unskip a round. A recorded round must be reopened first. */
export function toggleSkip(game, index) {
  const round = game.rounds[index];
  if (!round || round.phase === PHASE.DONE) return false;
  round.phase = round.phase === PHASE.SKIPPED ? PHASE.PENDING : PHASE.SKIPPED;
  normalizeDealers(game);
  return true;
}

export function setDealer(game, index, playerId) {
  const round = game.rounds[index];
  if (!round || !playerById(game, playerId)) return false;
  round.dealerId = playerId;
  round.dealerLocked = true;
  // Moving the deal changes who speaks when, so any frozen order is stale.
  round.order = null;
  if (index === 0) game.firstDealerId = playerId;
  normalizeDealers(game);
  return true;
}

/**
 * Give the opening bid to `playerId` by handing the deal to the seat before
 * them. Designating the opener and designating the dealer are two views of the
 * same fact.
 */
export function setOpener(game, index, playerId) {
  if (!playerById(game, playerId)) return false;
  return setDealer(game, index, prevSeat(game, playerId));
}

/**
 * Replace the unplayed tail of the staircase with a freshly built plan.
 * Played rounds are always preserved.
 */
export function rebuildPlan(game, spec) {
  game.planSpec = { ...defaultPlanSpec(), ...spec };
  const keep = [];
  for (const round of game.rounds) {
    if (round.phase === PHASE.DONE) keep.push(round);
  }
  const fresh = buildPlan(game.planSpec).map((cards) => makeRound(cards));
  game.rounds = keep.concat(fresh);
  syncEntries(game);
  normalizeDealers(game);
  return game;
}

/* ----------------------------------------------------------- player edits */

export function nextColor(game) {
  const used = new Set(game.players.map((p) => p.color));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[game.players.length % PALETTE.length];
}

export function addPlayer(game, name, { carryIn = 0, markPastRoundsOut = true } = {}) {
  if (game.players.length >= MAX_PLAYERS) return null;
  const player = makePlayer(name, nextColor(game), { carryIn });
  game.players.push(player);
  syncEntries(game);
  if (markPastRoundsOut) {
    for (const round of game.rounds) {
      if (round.phase === PHASE.DONE) round.entries[player.id].out = true;
    }
  }
  normalizeDealers(game);
  return player;
}

/**
 * Sit a player out for the rest of the game without erasing what they have
 * already scored — the honest answer to somebody going home mid-game.
 *
 * Removing them instead would strip their entries from rounds that have been
 * played, leaving those rounds with tricks that no longer add up to the hand.
 */
export function setWithdrawn(game, playerId, withdrawn = true) {
  const player = playerById(game, playerId);
  if (!player) return false;
  player.withdrawn = !!withdrawn;

  for (const round of game.rounds) {
    if (round.phase === PHASE.DONE) continue; // history stands
    const entry = round.entries[playerId];
    if (!entry) continue;
    if (withdrawn) {
      entry.out = true;
      entry.bid = null;
      entry.tricks = null;
    } else {
      entry.out = false;
    }
  }
  return true;
}

export function removePlayer(game, playerId) {
  if (game.players.length <= MIN_PLAYERS) return false;
  const i = seatIndex(game, playerId);
  if (i < 0) return false;
  game.players.splice(i, 1);
  syncEntries(game);
  for (const round of game.rounds) {
    if (round.dealerId === playerId) {
      round.dealerId = null;
      round.dealerLocked = false;
    }
  }
  if (game.firstDealerId === playerId) {
    game.firstDealerId = game.players.length ? game.players[0].id : null;
  }
  normalizeDealers(game);
  return true;
}

export function movePlayer(game, from, to) {
  const n = game.players.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return false;
  const [p] = game.players.splice(from, 1);
  game.players.splice(to, 0, p);
  normalizeDealers(game);
  return true;
}

export function renamePlayer(game, playerId, name) {
  const p = playerById(game, playerId);
  if (!p) return false;
  p.name = name;
  return true;
}

/* -------------------------------------------------------------- integrity */

/**
 * Repair anything a hand-edited, imported or older payload might have got
 * wrong. Always safe to call; returns the same object for chaining.
 */
export function sanitizeGame(game) {
  if (!game || typeof game !== 'object') return null;

  // A record written by a newer build may hold fields this one does not
  // understand. Stamping it as current would quietly discard them and then
  // write the lossy version back. Refusing to read it leaves it intact for the
  // build that can. (Older versions have no such problem: every field this
  // schema knows about is defaulted below.)
  if (Number.isFinite(game.v) && game.v > SCHEMA_VERSION) return null;
  game.v = SCHEMA_VERSION;
  game.id = typeof game.id === 'string' && game.id ? game.id : uid('g');
  game.name = typeof game.name === 'string' ? game.name : '';
  game.created = Number.isFinite(game.created) ? game.created : Date.now();
  game.updated = Number.isFinite(game.updated) ? game.updated : game.created;
  game.finished = !!game.finished;
  const cfgDefaults = defaultConfig();
  game.cfg = { ...cfgDefaults, ...(game.cfg || {}) };
  game.cfg.strict = !!game.cfg.strict;
  // A junk value falls back to the default rather than to the clamp floor:
  // silently turning a 5-point bonus into -99 would be worse than ignoring it.
  // Only genuine numbers are accepted — Number() would happily turn null, ''
  // and [] into 0, which is a value the user never chose.
  const repairNumber = (key, lo, hi) => {
    const raw = game.cfg[key];
    const ok = typeof raw === 'number' && Number.isFinite(raw);
    game.cfg[key] = ok ? clamp(Math.round(raw), lo, hi) : cfgDefaults[key];
  };
  repairNumber('banFrom', 0, MAX_CARDS);
  for (const k of ['ptsBid', 'ptsTrick', 'ptsMiss']) repairNumber(k, -99, 99);
  const planDefaults = defaultPlanSpec();
  game.planSpec = { ...planDefaults, ...(game.planSpec || {}) };
  if (!SHAPES.includes(game.planSpec.shape)) game.planSpec.shape = planDefaults.shape;
  if (!PARITIES.includes(game.planSpec.parity)) game.planSpec.parity = 'all';
  for (const key of ['maxCards', 'minCards']) {
    const raw = game.planSpec[key];
    game.planSpec[key] =
      typeof raw === 'number' && Number.isFinite(raw) ? clamp(Math.round(raw), 1, MAX_CARDS) : planDefaults[key];
  }

  const seen = new Set();
  game.players = (Array.isArray(game.players) ? game.players : [])
    .filter((p) => p && typeof p === 'object')
    .slice(0, MAX_PLAYERS)
    .map((p, i) => {
      // Duplicate ids can only come from a corrupted or hand-edited payload,
      // where the results under that key are already ambiguous. The first
      // player to claim it keeps it (and its entries); later claimants get a
      // fresh id and start empty. Deterministic, if arbitrary.
      let id = typeof p.id === 'string' && p.id ? p.id : uid('p');
      while (seen.has(id)) id = uid('p');
      seen.add(id);
      return {
        id,
        name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 24) : `#${i + 1}`,
        color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : PALETTE[i % PALETTE.length],
        carryIn: Number.isFinite(p.carryIn) ? Math.round(p.carryIn) : 0,
        withdrawn: !!p.withdrawn,
      };
    });

  const phases = new Set(Object.values(PHASE));
  const roundIds = new Set();
  game.rounds = (Array.isArray(game.rounds) ? game.rounds : [])
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      let id = typeof r.id === 'string' && r.id ? r.id : uid('r');
      while (roundIds.has(id)) id = uid('r');
      roundIds.add(id);
      const cards = clamp(Math.round(r.cards), 1, MAX_CARDS);
      const entries = {};
      const src = r.entries && typeof r.entries === 'object' ? r.entries : {};
      for (const [pid, raw] of Object.entries(src)) {
        if (!raw || typeof raw !== 'object') continue;
        // Entry keys come from stored or imported payloads. Assigning to
        // "__proto__" on a plain object would rewrite its prototype rather
        // than add a key, so refuse the reserved names outright.
        if (pid === '__proto__' || pid === 'constructor' || pid === 'prototype') continue;
        entries[pid] = {
          bid: Number.isFinite(raw.bid) ? clamp(Math.round(raw.bid), 0, cards) : null,
          tricks: Number.isFinite(raw.tricks) ? clamp(Math.round(raw.tricks), 0, cards) : null,
          out: !!raw.out,
          adj: Number.isFinite(raw.adj) ? Math.round(raw.adj) : 0,
        };
      }
      const phase = phases.has(r.phase) ? r.phase : PHASE.PENDING;
      return {
        id,
        cards,
        dealerId: typeof r.dealerId === 'string' ? r.dealerId : null,
        dealerLocked: !!r.dealerLocked,
        phase,
        // Anything already in `done` has by definition been recorded, which
        // also migrates games stored before the flag existed.
        recorded: !!r.recorded || phase === PHASE.DONE,
        order: Array.isArray(r.order) && r.order.every((id) => typeof id === 'string') ? r.order.slice() : null,
        entries,
      };
    });

  // Drop dangling references left behind by removed players.
  const ids = new Set(game.players.map((p) => p.id));
  for (const round of game.rounds) {
    if (round.dealerId && !ids.has(round.dealerId)) {
      round.dealerId = null;
      round.dealerLocked = false;
    }
  }
  if (!ids.has(game.firstDealerId)) {
    game.firstDealerId = game.players.length ? game.players[0].id : null;
  }

  syncEntries(game);
  normalizeDealers(game);
  return game;
}
