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
import { detectLanguage, getLanguage, setLanguage, t } from './i18n.js';
import { toast } from './sheet.js';

export const TABS = ['play', 'stairs', 'board', 'chart'];

export const state = {
  settings: { ...storage.DEFAULT_SETTINGS },
  game: null,
  view: 'games',
  /**
   * Gates retroactive scoring changes on the settings screen — altering the
   * scoring rescores every round already played. Structural edits to the
   * staircase are not gated by this; they confirm at the point of use instead.
   */
  unlocked: false,
  manageSeats: false,
  /** null | 'quota' | 'failed' — surfaced as a persistent banner. */
  saveError: null,
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

/**
 * Resolve the theme here rather than in CSS.
 *
 * `data-theme` is always written, with `auto` resolved against the media query,
 * so the stylesheet needs exactly one dark block. Carrying a second copy in an
 * `@media (prefers-color-scheme: dark)` rule meant two selectors of equal
 * specificity, where the later one silently won — so edits to the explicit
 * dark theme had no effect on a device that was already dark.
 */
export function applyTheme() {
  const root = document.documentElement;
  const dark =
    state.settings.theme === 'dark' ||
    (state.settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.setAttribute('data-theme', dark ? 'dark' : 'light');
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
  const before = getLanguage();
  // A real change notifies the language listener, which re-renders. Rendering
  // again here would do the whole screen twice for one tap.
  setLanguage(code || detectLanguage());
  // Picking "Auto" when it resolves to the language already shown changes no
  // string, but the picker's own selected state still has to update.
  if (getLanguage() === before) render();
}

export function effectiveLanguage() {
  return state.settings.lang || detectLanguage();
}

/* ------------------------------------------------------------ persistence */

/**
 * The revision token of the copy in storage that this tab agrees with.
 * `undefined` means "no check" — used for the very first write of a new game.
 */
let knownRev;

/**
 * Persist the open game.
 *
 * A failed write is never silent. `state.saveError` drives a banner that stays
 * on screen until the next successful save, because the alternative — a toast
 * that fades while the UI keeps happily accepting rounds that are not being
 * stored — loses somebody an entire evening's scoring.
 */
function persistGame() {
  if (!state.game) return;
  const result = storage.saveGame(state.game, knownRev);

  if (result.ok) {
    knownRev = result.rev;
    state.saveError = null;
    return;
  }

  if (result.missing) {
    // Deleted in another tab; writing would resurrect it.
    state.game = null;
    knownRev = undefined;
    setSetting('lastGameId', null);
    viewStack.length = 0;
    state.view = 'games';
    state.saveError = null;
    toast(t('sync.removed'));
    return;
  }

  if (result.conflict) {
    // Another tab moved this game on. Its copy is the newer truth; reload it
    // rather than overwrite work that tab has already recorded.
    const fresh = storage.loadGame(state.game.id);
    if (fresh) {
      state.game = fresh;
      knownRev = storage.readRev(fresh.id);
      state.saveError = null;
      toast(t('sync.reloaded'));
    }
    return;
  }

  state.saveError = result.quota ? 'quota' : 'failed';
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

/**
 * Navigation.
 *
 * The four tabs are roots: moving between them is lateral, so it clears any
 * trail. The library, settings and setup screens stack on top of whatever you
 * were doing, and remember it, so there is always somewhere specific to go
 * back to — including when no game is open and the tabs are disabled.
 */
const viewStack = [];

export function isStackedView(view) {
  return !TABS.includes(view);
}

export function setView(view) {
  if (view === state.view) return;
  if (TABS.includes(view)) viewStack.length = 0;
  else viewStack.push(state.view);

  state.view = view;
  state.manageSeats = false;
  render();
  window.scrollTo(0, 0);
}

export function canGoBack() {
  return viewStack.length > 0;
}

/**
 * Pick up a change another tab made to the open game. Called on the `storage`
 * event so the two copies converge immediately rather than only when this tab
 * next tries to write.
 */
export function refreshFromStorage() {
  if (!state.game) return false;
  const rev = storage.readRev(state.game.id);
  if (rev === null) {
    closeGame();
    toast(t('sync.removed'));
    return true;
  }
  if (rev === knownRev) return false;
  const fresh = storage.loadGame(state.game.id);
  if (!fresh) return false;
  state.game = fresh;
  knownRev = rev;
  toast(t('sync.reloaded'));
  return true;
}

/** Where the back button would land, so the label can name it. */
export function backTarget() {
  if (viewStack.length) return viewStack[viewStack.length - 1];
  return state.game ? 'play' : 'games';
}

export function goBack() {
  const target = backTarget();
  viewStack.pop();
  state.view = target;
  state.manageSeats = false;
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
  state.saveError = null;
  knownRev = storage.readRev(game.id);
  setSetting('lastGameId', game.id);
  setView('play');
  return true;
}

/**
 * Close the open game and drop any navigation trail that leads back into it.
 * Without this, "back" could restore a tab for a game that no longer exists —
 * and tabs are disabled with no game, leaving no way out but the menu.
 */
export function closeGame() {
  state.game = null;
  knownRev = undefined;
  state.saveError = null;
  setSetting('lastGameId', null);
  viewStack.length = 0;
  state.view = 'games';
}

export function adoptGame(game) {
  state.game = game;
  state.unlocked = false;
  state.saveError = null;
  knownRev = undefined; // brand new record; nothing to conflict with
  persistGame();
  setSetting('lastGameId', game.id);
}

/**
 * Wipe every game and every preference.
 *
 * Order matters: clearing the settings record and *then* closing the game
 * would have `setSetting` write the old theme and language straight back.
 */
export function resetEverything() {
  storage.clearAllGames();
  state.game = null;
  knownRev = undefined;
  state.saveError = null;
  state.unlocked = false;
  state.manageSeats = false;
  viewStack.length = 0;
  state.view = 'games';
  state.settings = { ...storage.DEFAULT_SETTINGS };
  storage.clearSettings();
  setLanguage(effectiveLanguage());
  applyTheme();
  render();
}

export function deleteGame(id) {
  storage.deleteGame(id);
  if (state.game && state.game.id === id) {
    state.game = null;
    setSetting('lastGameId', null);
    // Any tab in the trail belonged to the game that has just gone.
    viewStack.length = 0;
    state.view = 'games';
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
  // Freeze the order actually played before the round stops deriving one.
  const order = M.bidOrder(state.game, round);
  commit((game) => {
    round.order = order;
    round.recorded = true;
    round.phase = M.PHASE.DONE;
    M.normalizeDealers(game);
  });
  return index;
}

/**
 * Reopen a recorded round for correction and jump to it.
 *
 * Pinning the dealer is essential: leaving `done` removes the round's anchor
 * status, so the next `normalizeDealers` would re-derive its dealer from the
 * preceding round. After any earlier insert, delete or reorder that derivation
 * disagrees with who actually dealt, and the round would be re-recorded under
 * a bidding order that never happened.
 */
export function reopenRound(index) {
  commit((game) => {
    const round = game.rounds[index];
    if (!round) return;
    if (M.playerById(game, round.dealerId)) round.dealerLocked = true;
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

/** Sit a player out for the rest of the game, keeping what they have scored. */
export function setWithdrawn(playerId, withdrawn) {
  commit((game) => {
    M.setWithdrawn(game, playerId, withdrawn);
  });
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
      knownRev = storage.readRev(game.id);
      state.view = 'play';
      return;
    }
    setSetting('lastGameId', null);
  }
  state.view = 'games';
}
