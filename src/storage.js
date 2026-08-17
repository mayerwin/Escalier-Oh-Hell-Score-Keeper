/**
 * Persistence.
 *
 * Games live in localStorage under one key each. There is deliberately no
 * separate index record: the list of games is derived by scanning the key
 * space, so an interrupted write can never leave a phantom entry pointing at a
 * game that is not there (or hide one that is). Summaries are memoised for the
 * session and invalidated on every write, which keeps the scan off the hot
 * path without reintroducing the desync.
 *
 * localStorage is used rather than IndexedDB on purpose: the payloads are a few
 * kilobytes, the API is synchronous (so a save can complete inside a
 * `pagehide` handler when the phone is put to sleep mid-game), and there is far
 * less to go wrong offline.
 */

import { sanitizeGame } from './model.js';
import * as roster from './roster.js';

const PREFIX = 'escalier:v2:';
const GAME_PREFIX = `${PREFIX}game:`;
const SETTINGS_KEY = `${PREFIX}settings`;

/** In-memory fallback so the app stays usable in private-mode Safari etc. */
const memory = new Map();
let backing = null;
let volatile = false;

function store() {
  if (backing) return backing;
  try {
    const ls = globalThis.localStorage;
    // Safari in private mode exposes localStorage but throws on write.
    const probe = `${PREFIX}probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    backing = ls;
  } catch {
    volatile = true;
    backing = {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
      key: (i) => [...memory.keys()][i] ?? null,
      get length() {
        return memory.size;
      },
    };
  }
  return backing;
}

/** True when games are only held in memory and will not survive a reload. */
export function isVolatile() {
  store();
  return volatile;
}

function readJSON(key, fallback = null) {
  try {
    const raw = store().getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    store().setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const quota =
      err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);
    return { ok: false, quota: !!quota, error: err };
  }
}

function allKeys() {
  const s = store();
  const keys = [];
  for (let i = 0; i < s.length; i += 1) {
    const k = s.key(i);
    if (typeof k === 'string') keys.push(k);
  }
  return keys;
}

/* ------------------------------------------------------------------ games */

let summaryCache = null;

function invalidate() {
  summaryCache = null;
}

/** Drop the memoised summaries — used when another tab writes to storage. */
export function invalidateCache() {
  invalidate();
}

export function gameKey(id) {
  return `${GAME_PREFIX}${id}`;
}

export function loadGame(id) {
  const raw = readJSON(gameKey(id));
  if (!raw) return null;
  return sanitizeGame(raw);
}

/** The revision token currently in storage, or null when there is no record. */
export function readRev(id) {
  const raw = readJSON(gameKey(id));
  if (!raw || typeof raw !== 'object') return null;
  return typeof raw.rev === 'string' ? raw.rev : '';
}

/**
 * Write a game, refusing to clobber a copy that changed elsewhere.
 *
 * Every record carries a revision token. A caller passes the token it last saw;
 * if storage holds a different one, another tab has written since and this
 * would be a blind whole-document overwrite — which is how a second tab could
 * silently erase rounds the first tab had recorded.
 *
 * `expectedRev` of `undefined` skips the check (first write of a new game).
 */
export function saveGame(game, expectedRev) {
  if (expectedRev !== undefined) {
    const current = readRev(game.id);
    if (current === null) return { ok: false, missing: true };
    if (current !== expectedRev) return { ok: false, conflict: true };
  }

  const rev = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const previous = game.rev;
  game.rev = rev;
  game.updated = Date.now();

  const result = writeJSON(gameKey(game.id), game);
  if (!result.ok) {
    game.rev = previous; // nothing landed, so keep the token we still agree on
    return result;
  }
  invalidate();
  return { ok: true, rev };
}

export function deleteGame(id) {
  try {
    store().removeItem(gameKey(id));
  } catch {
    /* nothing useful to do */
  }
  invalidate();
}

function summarise(game) {
  const playable = game.rounds.filter((r) => r.phase !== 'skipped');
  return {
    id: game.id,
    name: game.name,
    created: game.created,
    updated: game.updated,
    finished: !!game.finished,
    playerNames: game.players.map((p) => p.name),
    playerCount: game.players.length,
    done: playable.filter((r) => r.phase === 'done').length,
    total: playable.length,
  };
}

/** Every stored game, newest activity first. Corrupt records are skipped. */
export function listGames() {
  if (summaryCache) return summaryCache;
  const out = [];
  for (const key of allKeys()) {
    if (!key.startsWith(GAME_PREFIX)) continue;
    const raw = readJSON(key);
    if (!raw || typeof raw !== 'object') continue;
    const game = sanitizeGame(raw);
    if (!game) continue;
    out.push(summarise(game));
  }
  out.sort((a, b) => b.updated - a.updated);
  summaryCache = out;
  return out;
}

export function countGames() {
  return listGames().length;
}

export function clearAllGames() {
  for (const key of allKeys()) {
    if (key.startsWith(GAME_PREFIX)) {
      try {
        store().removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }
  invalidate();
}

/* --------------------------------------------------------------- settings */

export const DEFAULT_SETTINGS = Object.freeze({
  lang: null, // null = follow the browser
  theme: 'auto', // auto | light | dark
  lastGameId: null,
  chartMode: 'cumulative',
  roster: [], // known players: [{ name, always }], in seating order
});

export function loadSettings() {
  const raw = readJSON(SETTINGS_KEY, {});
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = 'auto';
  if (!['cumulative', 'round'].includes(s.chartMode)) s.chartMode = 'cumulative';
  if (typeof s.lang !== 'string') s.lang = null;
  if (typeof s.lastGameId !== 'string') s.lastGameId = null;
  s.roster = roster.sanitize(s.roster);
  return s;
}

export function saveSettings(settings) {
  return writeJSON(SETTINGS_KEY, settings);
}

export function clearSettings() {
  try {
    store().removeItem(SETTINGS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Ask the browser to exempt our data from eviction under storage pressure.
 * Best-effort and silent: no browser is required to honour it.
 */
export async function requestPersistence() {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      if (typeof navigator.storage.persisted === 'function' && (await navigator.storage.persisted())) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}
