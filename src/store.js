/**
 * Runtime state and every action that changes it.
 *
 * There is one mutable `state` object, one `render()` callback, and a single
 * rule: anything that touches the game goes through `commit()`, which saves to
 * storage and re-renders. Views never write to storage or to `state.game`
 * directly.
 */

import * as M from './model.js';
import * as storage from './storage.js';
import { detectLanguage, setLanguage, t } from './i18n.js';
import { toast } from './sheet.js';

export const TABS = ['play', 'stairs', 'board', 'chart'];

export const state = {
  settings: { ...storage.DEFAULT_SETTINGS },
  game: null,
  view: 'games',
  /** Structural edits that rewrite recorded results stay behind this. */
  unlocked: false,
  manageSeats: false,
  /** Draft game under construction on the setup screen. */
  draft: null,
  /** Decoded game from a share link, awaiting the user's decision. */
  pendingImport: null,
  offline: {
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    ready: false,
    updateReady: false,
    applyUpdate: null,
  },
};

let renderFn = () => {};

export function onRender(fn) {
  renderFn = fn;
}

export function render() {
  renderFn();
}

/* ---------------------------------------------------------------- settings */

export function applyTheme() {
  const root = document.documentElement;
  if (state.settings.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.settings.theme);

  // Keep the browser UI (status bar, address bar) in step with the theme.
  const dark =
    state.settings.theme === 'dark' ||
    (state.settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', dark ? '#10160f' : '#f4eddf');
}

function persistSettings() {
  storage.saveSettings(state.settings);
}

export function setSetting(key, value) {
  state.settings[key] = value;
  persistSettings();
}

export function setThemeSetting(theme) {
  setSetting('theme', theme);
  applyTheme();
  render();
}

export function setLanguageSetting(code) {
  setSetting('lang', code);
  setLanguage(code || detectLanguage());
  render();
}

export function effectiveLanguage() {
  return state.settings.lang || detectLanguage();
}

/* ------------------------------------------------------------ persistence */

let quotaWarned = false;

function persistGame() {
  if (!state.game) return;
  const result = storage.saveGame(state.game);
  if (!result.ok && !quotaWarned) {
    quotaWarned = true;
    toast(result.quota ? 'Storage is full — free some space' : 'Could not save to this device');
  }
}

/**
 * Apply a mutation to the current game, save it, and re-render.
 * `mutator` receives the live game object.
 */
export function commit(mutator) {
  if (!state.game) return;
  mutator(state.game);
  M.syncEntries(state.game);
  persistGame();
  render();
}

/* ----------------------------------------------------------------- views */

export function setView(view) {
  state.view = view;
  if (view !== 'board') state.manageSeats = false;
  render();
  window.scrollTo(0, 0);
}

export function toggleUnlocked(force) {
  state.unlocked = typeof force === 'boolean' ? force : !state.unlocked;
  render();
}

/* ----------------------------------------------------------------- games */

export function openGame(id) {
  const game = storage.loadGame(id);
  if (!game) {
    toast(t('share.import.failed'));
    return false;
  }
  state.game = game;
  state.unlocked = false;
  setSetting('lastGameId', game.id);
  setView('play');
  return true;
}

export function closeGame() {
  state.game = null;
  setSetting('lastGameId', null);
}

export function adoptGame(game) {
  state.game = game;
  state.unlocked = false;
  persistGame();
  setSetting('lastGameId', game.id);
}

export function deleteGame(id) {
  storage.deleteGame(id);
  if (state.game && state.game.id === id) {
    state.game = null;
    setSetting('lastGameId', null);
  }
  render();
}

export function renameGame(name) {
  commit((game) => {
    game.name = name.slice(0, 40);
  });
}

export function setFinished(finished) {
  commit((game) => {
    game.finished = finished;
  });
}

/* ------------------------------------------------------------ round play */

export function currentRound() {
  return state.game ? M.currentRound(state.game) : null;
}

/**
 * True when the round in play sits before rounds that are already recorded —
 * i.e. the user reopened an old round to fix it.
 */
export function isCorrecting() {
  if (!state.game) return false;
  const index = M.currentRoundIndex(state.game);
  if (index < 0) return false;
  return state.game.rounds.slice(index + 1).some((r) => r.phase === M.PHASE.DONE);
}

/** Tapping the same value again clears it, so a mistake costs one tap. */
export function setBid(playerId, value) {
  const round = currentRound();
  if (!round) return;
  commit(() => {
    const entry = round.entries[playerId];
    if (!entry) return;
    entry.bid = entry.bid === value ? null : M.clamp(value, 0, round.cards);
    if (round.phase === M.PHASE.PENDING) round.phase = M.PHASE.BIDDING;
  });
}

export function setTricks(playerId, value) {
  const round = currentRound();
  if (!round) return;
  commit(() => {
    const entry = round.entries[playerId];
    if (!entry) return;
    entry.tricks = entry.tricks === value ? null : M.clamp(value, 0, round.cards);
  });
}

export function setOut(roundIndex, playerId, out) {
  commit((game) => {
    const round = game.rounds[roundIndex];
    const entry = round && round.entries[playerId];
    if (!entry) return;
    entry.out = out;
    if (out) {
      entry.bid = null;
      entry.tricks = null;
    }
  });
}

export function setAdjustment(roundIndex, playerId, value) {
  commit((game) => {
    const round = game.rounds[roundIndex];
    if (!round || !round.entries[playerId]) return;
    round.entries[playerId].adj = Math.round(value) || 0;
  });
}

export function lockBids() {
  const round = currentRound();
  if (!round) return;
  commit(() => {
    round.phase = M.PHASE.TRICKS;
  });
}

export function backToBids() {
  const round = currentRound();
  if (!round) return;
  commit(() => {
    round.phase = M.PHASE.BIDDING;
  });
}

export function recordRound() {
  const round = currentRound();
  if (!round) return null;
  const index = M.currentRoundIndex(state.game);
  commit(() => {
    round.phase = M.PHASE.DONE;
    M.normalizeDealers(state.game);
  });
  return index;
}

/** Reopen a recorded round for correction and jump to it. */
export function reopenRound(index) {
  commit((game) => {
    const round = game.rounds[index];
    if (!round) return;
    const bidsComplete = M.bidState(game, round).complete;
    round.phase = bidsComplete ? M.PHASE.TRICKS : M.PHASE.BIDDING;
    M.normalizeDealers(game);
  });
  setView('play');
}

/* --------------------------------------------------------- staircase edits */

export function insertRound(at, cards) {
  commit((game) => {
    M.insertRound(game, at, cards);
  });
}

export function appendRound(cards) {
  commit((game) => {
    M.appendRound(game, cards);
  });
}

export function duplicateRound(index) {
  commit((game) => {
    M.duplicateRound(game, index);
  });
}

export function removeRound(index) {
  commit((game) => {
    M.removeRound(game, index);
  });
}

export function setRoundCards(index, cards) {
  commit((game) => {
    M.setRoundCards(game, index, cards);
  });
}

export function toggleSkip(index) {
  commit((game) => {
    M.toggleSkip(game, index);
  });
}

/**
 * Make `index` the round in play by skipping every unplayed round before it.
 * Recorded rounds are left alone.
 */
export function playNext(index) {
  commit((game) => {
    for (let i = 0; i < index && i < game.rounds.length; i += 1) {
      const round = game.rounds[i];
      if (round.phase !== M.PHASE.DONE) round.phase = M.PHASE.SKIPPED;
    }
    const target = game.rounds[index];
    if (target && target.phase === M.PHASE.SKIPPED) target.phase = M.PHASE.PENDING;
    M.normalizeDealers(game);
  });
}

export function setDealer(index, playerId) {
  commit((game) => {
    M.setDealer(game, index, playerId);
  });
}

export function setOpener(index, playerId) {
  commit((game) => {
    M.setOpener(game, index, playerId);
  });
}

export function setPlanSpec(key, value) {
  commit((game) => {
    game.planSpec = { ...M.defaultPlanSpec(), ...game.planSpec, [key]: value };
  });
}

export function rebuildPlan(spec) {
  commit((game) => {
    M.rebuildPlan(game, spec);
  });
}

/* ----------------------------------------------------------- player edits */

export function addPlayer(name, carryIn) {
  let added = null;
  commit((game) => {
    added = M.addPlayer(game, name, { carryIn });
  });
  return added;
}

export function removePlayer(playerId) {
  let ok = false;
  commit((game) => {
    ok = M.removePlayer(game, playerId);
  });
  return ok;
}

export function movePlayer(from, to) {
  commit((game) => {
    M.movePlayer(game, from, to);
  });
}

export function renamePlayer(playerId, name) {
  commit((game) => {
    M.renamePlayer(game, playerId, name.slice(0, 24));
  });
}

/* --------------------------------------------------------------- scoring */

export function setConfig(key, value) {
  commit((game) => {
    game.cfg[key] = value;
  });
}

/* ------------------------------------------------------------------ boot */

export function boot() {
  state.settings = storage.loadSettings();
  setLanguage(effectiveLanguage());
  applyTheme();

  // Follow the system theme live while set to auto.
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSchemeChange = () => {
    if (state.settings.theme === 'auto') {
      applyTheme();
      render();
    }
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onSchemeChange);
  else if (typeof mq.addListener === 'function') mq.addListener(onSchemeChange);

  const lastId = state.settings.lastGameId;
  if (lastId) {
    const game = storage.loadGame(lastId);
    if (game) {
      state.game = game;
      state.view = 'play';
      return;
    }
    setSetting('lastGameId', null);
  }
  state.view = 'games';
}
