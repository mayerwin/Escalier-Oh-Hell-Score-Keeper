/**
 * Shareable game links.
 *
 * A whole game is packed into a positional array (no keys, seat indices
 * instead of player ids), deflated, and base64url-encoded into the URL
 * fragment. The fragment never reaches a server, so sharing a game is a purely
 * local operation — there is no backend, no account and nothing to leak.
 *
 * The payload carries a one-character format tag so a link made by a browser
 * with CompressionStream can be told apart from the uncompressed fallback:
 *
 *   "A" + base64url(deflate-raw(utf8(json)))   compressed
 *   "B" + base64url(utf8(json))                fallback
 *
 * A realistic game (6 players, 20 rounds) lands around 350-450 characters of
 * payload, comfortably inside every browser's address-bar limit.
 */

import { MAX_PLAYERS, PALETTE, PHASE, SCHEMA_VERSION, sanitizeGame, uid } from './model.js';

export const PAYLOAD_KEY = 'g';

/** Generous for any real staircase, and a hard stop for a hostile link. */
export const MAX_ROUNDS = 400;

/** Ceilings on a decoded payload, applied before anything is built from it. */
const MAX_PAYLOAD_CHARS = 200_000;
const MAX_INFLATED_BYTES = 2_000_000;
const PHASE_ORDER = [PHASE.PENDING, PHASE.BIDDING, PHASE.TRICKS, PHASE.DONE, PHASE.SKIPPED];

/** Links longer than this are still valid but worth warning the user about. */
export const LONG_URL = 1800;

/* ------------------------------------------------------------------ pack */

function packEntry(entry) {
  return [
    entry && Number.isFinite(entry.bid) ? entry.bid : -1,
    entry && Number.isFinite(entry.tricks) ? entry.tricks : -1,
    entry && entry.out ? 1 : 0,
    entry && Number.isFinite(entry.adj) ? entry.adj : 0,
  ];
}

/** Convert a game into its wire form. Pure; does not mutate the input. */
export function packGame(game) {
  const seat = new Map(game.players.map((p, i) => [p.id, i]));
  const seatOf = (id) => (seat.has(id) ? seat.get(id) : -1);

  return [
    SCHEMA_VERSION,
    game.name || '',
    game.created || Date.now(),
    game.finished ? 1 : 0,
    [game.cfg.ptsBid, game.cfg.ptsTrick, game.cfg.ptsMiss, game.cfg.strict ? 1 : 0, game.cfg.banFrom],
    // Fields are appended, never reordered: a link made by an older build
    // simply leaves the newer slots undefined, which decodes to the default.
    game.players.map((p) => {
      const idx = PALETTE.indexOf(p.color);
      return [p.name, idx >= 0 ? idx : p.color, p.carryIn || 0, p.withdrawn ? 1 : 0];
    }),
    seatOf(game.firstDealerId),
    game.rounds.map((r) => [
      r.cards,
      Math.max(0, PHASE_ORDER.indexOf(r.phase)),
      seatOf(r.dealerId),
      r.dealerLocked ? 1 : 0,
      game.players.map((p) => packEntry(r.entries[p.id])),
      r.recorded ? 1 : 0,
      Array.isArray(r.order) ? r.order.map(seatOf).filter((i) => i >= 0) : null,
    ]),
  ];
}

/** Rebuild a game from its wire form. Throws on anything malformed. */
export function unpackGame(data) {
  if (!Array.isArray(data) || data.length < 8) throw new Error('bad payload shape');
  const [, name, created, finished, cfgArr, playersArr, firstDealerSeat, roundsArr] = data;
  if (!Array.isArray(cfgArr) || !Array.isArray(playersArr) || !Array.isArray(roundsArr)) {
    throw new Error('bad payload fields');
  }
  if (playersArr.length === 0) throw new Error('no players');

  // Reject an oversized payload BEFORE materialising it. deflate compresses
  // this wire format around 200x, so a 50 KB link can otherwise declare
  // millions of players and lock the recipient's tab building objects that
  // sanitizeGame would only throw away afterwards.
  if (playersArr.length > MAX_PLAYERS) throw new Error('too many players');
  if (roundsArr.length > MAX_ROUNDS) throw new Error('too many rounds');

  const players = playersArr.map((p, i) => {
    const [pname, color, carryIn, withdrawn] = Array.isArray(p) ? p : [];
    return {
      id: uid('p'),
      name: typeof pname === 'string' ? pname : `#${i + 1}`,
      color: typeof color === 'number' ? PALETTE[color] || PALETTE[i % PALETTE.length] : color,
      carryIn: Number.isFinite(carryIn) ? carryIn : 0,
      withdrawn: withdrawn === 1,
    };
  });
  const idAt = (seatIdx) => (Number.isInteger(seatIdx) && players[seatIdx] ? players[seatIdx].id : null);

  const rounds = roundsArr.map((r) => {
    const [cards, phaseCode, dealerSeat, dealerLocked, seats, recorded, orderSeats] = Array.isArray(r) ? r : [];
    const entries = {};
    const seatList = Array.isArray(seats) ? seats : [];
    players.forEach((p, i) => {
      const [bid, tricks, out, adj] = Array.isArray(seatList[i]) ? seatList[i] : [];
      entries[p.id] = {
        bid: Number.isFinite(bid) && bid >= 0 ? bid : null,
        tricks: Number.isFinite(tricks) && tricks >= 0 ? tricks : null,
        out: out === 1,
        adj: Number.isFinite(adj) ? adj : 0,
      };
    });
    return {
      id: uid('r'),
      cards: Number.isFinite(cards) ? cards : 1,
      dealerId: idAt(dealerSeat),
      dealerLocked: dealerLocked === 1,
      phase: PHASE_ORDER[phaseCode] || PHASE.PENDING,
      recorded: recorded === 1,
      order: Array.isArray(orderSeats) ? orderSeats.map(idAt).filter(Boolean) : null,
      entries,
    };
  });

  const [ptsBid, ptsTrick, ptsMiss, strict, banFrom] = cfgArr;
  const game = sanitizeGame({
    id: uid('g'),
    name: typeof name === 'string' ? name : '',
    created: Number.isFinite(created) ? created : Date.now(),
    updated: Date.now(),
    finished: finished === 1,
    players,
    cfg: { ptsBid, ptsTrick, ptsMiss, strict: strict === 1, banFrom },
    firstDealerId: idAt(firstDealerSeat),
    rounds,
  });
  if (!game) throw new Error('payload did not survive validation');
  return game;
}

/* ------------------------------------------------------------ base64url */

export function bytesToBase64Url(bytes) {
  let binary = '';
  const CHUNK = 0x8000; // stay under the argument limit of String.fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/* ---------------------------------------------------------- compression */

export function canCompress() {
  return typeof CompressionStream === 'function';
}

async function through(transform, bytes) {
  const writer = transform.writable.getWriter();
  // On a corrupt payload both ends of the stream reject. Observe the write
  // side quietly so the failure surfaces once, from the read side, instead of
  // also escaping as an unhandled rejection.
  const written = writer
    .write(bytes)
    .then(() => writer.close())
    .catch(() => {});
  const buffer = await new Response(transform.readable).arrayBuffer();
  await written;
  return new Uint8Array(buffer);
}

async function deflate(bytes) {
  return through(new CompressionStream('deflate-raw'), bytes);
}

async function inflate(bytes) {
  return through(new DecompressionStream('deflate-raw'), bytes);
}

/* -------------------------------------------------------------- payload */

export async function encodeGame(game) {
  const json = JSON.stringify(packGame(game));
  const bytes = new TextEncoder().encode(json);
  if (canCompress()) {
    try {
      return `A${bytesToBase64Url(await deflate(bytes))}`;
    } catch {
      /* fall through to the uncompressed form */
    }
  }
  return `B${bytesToBase64Url(bytes)}`;
}

export async function decodePayload(payload) {
  if (typeof payload !== 'string' || payload.length < 2) throw new Error('empty payload');
  if (payload.length > MAX_PAYLOAD_CHARS) throw new Error('payload too large');

  const tag = payload[0];
  const body = payload.slice(1);
  let bytes = base64UrlToBytes(body);
  if (tag === 'A') {
    if (typeof DecompressionStream !== 'function') throw new Error('compression unsupported here');
    bytes = await inflate(bytes);
  } else if (tag !== 'B') {
    throw new Error(`unknown payload format "${tag}"`);
  }
  if (bytes.length > MAX_INFLATED_BYTES) throw new Error('payload too large');

  return unpackGame(JSON.parse(new TextDecoder().decode(bytes)));
}

/* ------------------------------------------------------------------ url */

/** Build the full shareable URL for a game. */
export async function buildShareUrl(game, baseUrl) {
  const payload = await encodeGame(game);
  const base = String(baseUrl).split('#')[0];
  return `${base}#${PAYLOAD_KEY}=${payload}`;
}

/** Extract the payload from a URL or bare fragment, or null when absent. */
export function readSharePayload(input) {
  if (typeof input !== 'string') return null;
  const hashAt = input.indexOf('#');
  const fragment = hashAt >= 0 ? input.slice(hashAt + 1) : input;
  if (!fragment) return null;
  for (const part of fragment.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) !== PAYLOAD_KEY) continue;
    const raw = part.slice(eq + 1);
    if (!raw) return null;
    // base64url needs no escaping, but a messaging client that re-serialises
    // the link may percent-encode it anyway.
    if (!raw.includes('%')) return raw;
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw;
    }
  }
  return null;
}
