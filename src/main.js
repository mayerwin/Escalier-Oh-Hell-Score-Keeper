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

const VIEW_TITLES = {
  settings: 'settings.title',
  games: 'games.title',
  setup: 'setup.title',
};

function renderTopbar() {
  clear(topbarEl);

  const game = store.state.game;
  const view = store.state.view;
  const stacked = store.isStackedView(view);
  // Shown exactly when there is somewhere to go back to. On the landing screen
  // the stack is empty, and an arrow that does nothing — while being first in
  // the tab order — is worse than no arrow.
  const showBack = store.canGoBack();

  // On a stacked screen the mark gives way to a back arrow: these screens sit
  // on top of the game, and the tabs cannot be relied on to escape them (with
  // no game open they are disabled). Both occupy the same fixed slot, so the
  // title beside them never shifts when a screen is pushed or popped.
  const leading = showBack
    ? el(
        'button',
        {
          type: 'button',
          class: 'iconbtn',
          'aria-label': t('common.back'),
          title: t('common.back'),
          onClick: () => store.goBack(),
        },
        icon('arrowLeft')
      )
    : el('div', { class: 'mark', 'aria-hidden': 'true' }, icon('stairs', { weight: 2.4 }));

  // The wordmark and the screen title are two lines of one lockup rather than
  // two faces jammed side by side on a shared centre line. They share a left
  // edge and each keeps its own leading, so the two typefaces stop fighting:
  // the wordmark is a caption above the title, which is what it always was.
  const title = el(
    'div',
    { class: 'topbar__title' },
    el('p', { class: 'wordmark' }, el('span', { text: 'L’' }), el('em', { text: 'Escalier' }))
  );

  if (stacked && VIEW_TITLES[view]) {
    title.appendChild(el('p', { class: 'topbar__game', text: t(VIEW_TITLES[view]) }));
  } else if (game) {
    title.appendChild(el('p', { class: 'topbar__game', text: game.name || "L'Escalier" }));
  } else {
    title.appendChild(el('p', { class: 'topbar__game', text: t('app.tagline') }));
  }

  topbarEl.appendChild(
    el(
      'div',
      { class: 'topbar__inner' },
      leading,
      title,
      el(
        'button',
        { type: 'button', class: 'iconbtn', 'aria-label': t('nav.menu'), title: t('nav.menu'), onClick: openMenu },
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
  tabbarEl.setAttribute('aria-label', t('a11y.tabs'));
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
          'data-fk': `tab:${tab}`,
          disabled: !hasGame,
          // Tabs are disabled with no game open; say why rather than leaving
          // 38% opacity to carry the whole message.
          title: hasGame ? undefined : t('play.noGame.title'),
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
let lastRenderedView = null;

/**
 * Keep the player whose turn it is to be entered clear of the action dock.
 *
 * The dock is sticky, so on a five-handed round the last player's chips sit
 * under it until you know to scroll. `block: 'nearest'` does nothing while the
 * row is already fully visible, and `.entry` carries a `scroll-margin-bottom`
 * the height of the dock, so this only ever nudges — it never yanks the list
 * out from under somebody who has scrolled somewhere deliberately.
 */
function keepCurrentPlayerInView() {
  const focused = mainEl.querySelector('.entry.is-focus');
  if (!focused) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  focused.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
}

/**
 * The score pad's trailing fade says "there is more to the right". Whether
 * that is true depends on the player count *and* the width, which only the
 * laid-out element knows — so the class is set here rather than guessed in the
 * stylesheet, and refreshed when the window changes shape.
 */
function markScrollableGrids() {
  if (!mainEl) return;
  for (const grid of mainEl.querySelectorAll('.sheetgrid')) {
    grid.classList.toggle('is-scrollable', grid.scrollWidth > grid.clientWidth + 1);
  }
}

function render() {
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.fk : null;
  const viewChanged = store.state.view !== lastRenderedView;
  lastRenderedView = store.state.view;

  renderTopbar();
  renderTabs();

  const view = VIEWS[store.state.view] || renderGames;
  clear(mainEl);

  // A failed write stays on screen until one succeeds: a toast that fades
  // while the app keeps accepting rounds it is not storing is how an evening's
  // scoring disappears without anyone noticing.
  const body = el('div', { class: 'view is-active shell' });

  // A waiting update is offered on every screen. Buried in Settings it was
  // effectively invisible, and users sat on old code indefinitely.
  if (store.state.offline.updateReady && typeof store.state.offline.applyUpdate === 'function') {
    body.appendChild(
      el(
        'div',
        { class: 'updatebar', role: 'status' },
        icon('refresh'),
        el('span', { text: t('settings.update.available') }),
        el('button', {
          type: 'button',
          text: t('settings.update.reload'),
          onClick: () => store.state.offline.applyUpdate(),
        })
      )
    );
  }

  if (store.state.saveError) {
    body.appendChild(
      el(
        'div',
        { class: 'status status--bad', role: 'alert' },
        icon('alert', { class: 'status__icon' }),
        el('span', { text: t(store.state.saveError === 'quota' ? 'save.quota' : 'save.failed') })
      )
    );
  }
  body.appendChild(view());
  mainEl.appendChild(body);

  keepCurrentPlayerInView();
  markScrollableGrids();

  // Arriving on a new screen: put focus on its title, so a keyboard or
  // screen-reader user is told where they are instead of being dropped at the
  // top of the document with nothing announced.
  if (viewChanged) {
    const title = mainEl.querySelector('h1');
    if (title) title.focus({ preventScroll: true });
    return;
  }

  if (!focusKey) return;
  // Search the whole document: the tab bar and top bar live outside `main`.
  for (const candidate of document.querySelectorAll('[data-fk]')) {
    if (candidate.dataset.fk !== focusKey) continue;
    if (!candidate.disabled) {
      candidate.focus({ preventScroll: true });
      return;
    }
    // The press that disabled this control (a stepper hitting its bound)
    // should not dump focus to the top of the page; take its sibling.
    const sibling = candidate.parentElement && candidate.parentElement.querySelector('button:not([disabled])');
    if (sibling) sibling.focus({ preventScroll: true });
    return;
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

        const offerUpdate = (worker) => {
          store.state.offline.updateReady = true;
          store.state.offline.applyUpdate = () => {
            updateRequested = true;
            if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
            // If another tab already activated this worker, `controllerchange`
            // will never fire here and the button would sit dead forever.
            // Reload regardless so it always does something.
            setTimeout(() => {
              if (reloading) return;
              reloading = true;
              window.location.reload();
            }, 600);
          };
          render();
        };

        // A worker that is already waiting is *already* in the `installed`
        // state, so listening for a statechange to `installed` would never
        // fire. It has to be checked directly.
        if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);

        const track = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state !== 'installed') return;
            if (navigator.serviceWorker.controller) offerUpdate(worker);
            else {
              store.state.offline.ready = true;
              render();
            }
          });
        };
        registration.addEventListener('updatefound', () => track(registration.installing));

        // Look for a new release when the app comes back to the foreground,
        // which for an installed PWA may be the only navigation it ever gets.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          registration.update().catch(() => {});
          if (registration.waiting && navigator.serviceWorker.controller && !store.state.offline.updateReady) {
            offerUpdate(registration.waiting);
          }
        });
      })
      .catch(() => {
        // Offline caching is a bonus, never a requirement for the app to run.
      });
  });
}

/* ------------------------------------------------------------- share-in */

let importing = false;

async function consumeShareLink() {
  const payload = readSharePayload(window.location.hash);
  if (!payload || importing) return;
  importing = true;

  // Drop the fragment straight away so a refresh does not re-prompt, and so a
  // very long URL does not linger in the address bar.
  history.replaceState(null, '', window.location.pathname + window.location.search);

  try {
    const game = await importFromPayload(payload);
    if (game) await openImportSheet(game);
  } catch {
    toast(t('share.import.failed'));
  } finally {
    importing = false;
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

  // Following a share link from a tab that already has the app open only
  // changes the fragment — no navigation happens, so `init` never runs again
  // and the game would arrive silently and never be offered.
  window.addEventListener('hashchange', () => {
    consumeShareLink();
  });

  // Escape backs out of a stacked screen, matching what it already does for a
  // sheet. Sheets handle their own Escape, so defer while one is open.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    if (!store.isStackedView(store.state.view)) return;
    event.preventDefault();
    store.goBack();
  });

  // Rotating the phone can turn a pad that overflowed into one that fits, and
  // back. Only a class is touched, so there is no re-render to schedule.
  window.addEventListener('resize', markScrollableGrids);

  // Another tab may have added, changed or deleted a game; drop the cached
  // summaries so the library does not show a stale list.
  window.addEventListener('storage', (event) => {
    if (event.key && !event.key.startsWith('escalier:')) return;
    storage.invalidateCache();
    // Converge on the other tab's copy straight away, rather than discovering
    // the divergence only when this tab next tries to write.
    const changed = store.refreshFromStorage();
    if (changed || store.state.view === 'games') render();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
