/**
 * App shell: chrome, routing between views, the overflow menu, share-link
 * import, and service-worker lifecycle.
 */

import { clear, el, icon } from './dom.js';
import { onLanguageChange, t } from './i18n.js';
import { openSheet, promptSheet, sheetAction, sheetHeader, toast } from './sheet.js';
import * as storage from './storage.js';
import * as store from './store.js';
import { readSharePayload } from './share.js';
import { renderBoard } from './views/board.js';
import { renderChartView } from './views/chart.js';
import { renderGames } from './views/games.js';
import { renderPlay } from './views/play.js';
import { renderSettings } from './views/settings.js';
import { renderSetup } from './views/setup.js';
import { renderStairs } from './views/stairs.js';
import { importFromPayload, openExportSheet, openImportSheet, openShareSheet } from './views/share.js';

const TAB_ICONS = { play: 'cards', stairs: 'stairs', board: 'podium', chart: 'curve' };

const VIEWS = {
  play: renderPlay,
  stairs: renderStairs,
  board: renderBoard,
  chart: renderChartView,
  games: renderGames,
  settings: renderSettings,
  setup: renderSetup,
};

let mainEl;
let topbarEl;
let tabbarEl;

/* ------------------------------------------------------------------ menu */

function openMenu() {
  const game = store.state.game;
  openSheet(({ close }) => {
    const actions = el('div', { class: 'sheet__actions' });

    actions.appendChild(
      sheetAction({
        label: t('menu.games'),
        iconName: 'home',
        onClick: () => {
          close();
          store.setView('games');
        },
      })
    );

    if (game) {
      actions.appendChild(
        sheetAction({
          label: t('menu.rename'),
          iconName: 'pencil',
          onClick: async () => {
            close();
            const name = await promptSheet({
              title: t('menu.rename.prompt'),
              value: game.name,
              placeholder: t('setup.name.placeholder'),
            });
            if (name !== null && name !== '') store.renameGame(name);
          },
        })
      );
      actions.appendChild(
        sheetAction({
          label: t('menu.share'),
          iconName: 'share',
          onClick: () => {
            close();
            openShareSheet(game);
          },
        })
      );
      actions.appendChild(
        sheetAction({
          label: t('menu.export'),
          iconName: 'download',
          onClick: () => {
            close();
            openExportSheet(game);
          },
        })
      );
    }

    actions.appendChild(
      sheetAction({
        label: t('menu.settings'),
        iconName: 'tune',
        onClick: () => {
          close();
          store.setView('settings');
        },
      })
    );

    return el('div', null, sheetHeader(game ? game.name || "L'Escalier" : "L'Escalier", t('app.tagline')), actions);
  });
}

/* --------------------------------------------------------------- chrome */

function renderTopbar() {
  clear(topbarEl);

  const title = el('div', { class: 'topbar__title' });
  const game = store.state.game;
  // While a new game is being set up, showing the previous game's name in the
  // header would suggest you are still editing it.
  if (store.state.view === 'setup') {
    title.appendChild(el('span', { class: 'topbar__game', text: t('setup.title') }));
  } else if (game) {
    title.appendChild(el('span', { class: 'topbar__game' }, el('b', { text: game.name || "L'Escalier" })));
  } else {
    title.appendChild(el('span', { class: 'topbar__game', text: t('app.tagline') }));
  }

  topbarEl.appendChild(
    el(
      'div',
      { class: 'topbar__inner' },
      el('div', { class: 'wordmark' }, el('span', { text: 'L’' }), el('em', { text: 'Escalier' })),
      title,
      el(
        'button',
        { type: 'button', class: 'iconbtn', 'aria-label': t('nav.menu'), onClick: openMenu },
        icon('dots')
      )
    )
  );
  topbarEl.appendChild(el('hr', { class: 'rule' }));
}

function renderTabs() {
  clear(tabbarEl);
  const hasGame = !!store.state.game;

  // These are navigation, not ARIA tabs: there are no tabpanels and the views
  // replace each other wholesale. `aria-current` is the honest mapping —
  // role="tab" without a matching tabpanel misleads screen readers.
  const inner = el('div', { class: 'tabbar__inner' });
  for (const tab of store.TABS) {
    const selected = store.state.view === tab;
    inner.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'tab',
          'aria-current': selected ? 'page' : null,
          'data-selected': String(selected),
          disabled: !hasGame,
          onClick: () => store.setView(tab),
        },
        icon(TAB_ICONS[tab]),
        el('span', { text: t(`nav.${tab}`) })
      )
    );
  }
  tabbarEl.appendChild(inner);
}

/**
 * Re-render everything, then put keyboard focus back where it was.
 *
 * The whole view is rebuilt on every state change, which would otherwise drop
 * focus to <body> on each tap — unusable with a keyboard or switch control.
 * Interactive controls carry a stable `data-fk`, so the equivalent node in the
 * new tree can be found and refocused.
 */
function render() {
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.fk : null;

  renderTopbar();
  renderTabs();

  const view = VIEWS[store.state.view] || renderGames;
  clear(mainEl);
  mainEl.appendChild(el('div', { class: 'view is-active shell' }, view()));

  if (focusKey) {
    for (const candidate of mainEl.querySelectorAll('[data-fk]')) {
      if (candidate.dataset.fk === focusKey && !candidate.disabled) {
        candidate.focus({ preventScroll: true });
        break;
      }
    }
  }
}

/* ------------------------------------------------------- service worker */

let reloading = false;
let updateRequested = false;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A first install also fires this, because the worker claims the page as
    // soon as it activates. Reloading then would throw away whatever the user
    // is already looking at — including a game just opened from a share link,
    // whose payload has been stripped from the URL by that point. Only reload
    // when the user actually asked to apply an update.
    if (!updateRequested || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        if (registration.active) {
          store.state.offline.ready = true;
          render();
        }

        const track = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state !== 'installed') return;
            if (navigator.serviceWorker.controller) {
              store.state.offline.updateReady = true;
              store.state.offline.applyUpdate = () => {
                updateRequested = true;
                worker.postMessage({ type: 'SKIP_WAITING' });
              };
            } else {
              store.state.offline.ready = true;
            }
            render();
          });
        };

        track(registration.waiting);
        registration.addEventListener('updatefound', () => track(registration.installing));
      })
      .catch(() => {
        // Offline caching is a bonus, never a requirement for the app to run.
      });
  });
}

/* ------------------------------------------------------------- share-in */

async function consumeShareLink() {
  const payload = readSharePayload(window.location.hash);
  if (!payload) return;

  // Drop the fragment straight away so a refresh does not re-prompt, and so a
  // very long URL does not linger in the address bar.
  history.replaceState(null, '', window.location.pathname + window.location.search);

  try {
    const game = await importFromPayload(payload);
    if (game) openImportSheet(game);
  } catch {
    toast(t('share.import.failed'));
  }
}

/* ------------------------------------------------------------------ init */

function init() {
  const app = document.getElementById('app');
  topbarEl = el('header', { class: 'topbar' });
  mainEl = el('main', { id: 'main' });
  tabbarEl = el('nav', { class: 'tabbar' });

  app.appendChild(topbarEl);
  app.appendChild(mainEl);
  app.appendChild(tabbarEl);

  store.onRender(render);
  store.boot();
  onLanguageChange(() => {
    // A language switch changes every string on screen, including the setup
    // draft's generated placeholder names.
    render();
  });

  render();
  storage.requestPersistence();
  consumeShareLink();
  registerServiceWorker();

  // Another tab may have added, changed or deleted a game; drop the cached
  // summaries so the library does not show a stale list.
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key.startsWith('escalier:')) {
      storage.invalidateCache();
      if (store.state.view === 'games') render();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
