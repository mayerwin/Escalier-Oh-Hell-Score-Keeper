/**
 * Settings: language, theme, this game's scoring, data and offline status.
 *
 * Scoring changes are retroactive — they rescore every round already played —
 * so once a round has been recorded they sit behind the editing lock.
 */

import { el, icon } from './../dom.js';
import { LANGUAGES, formatNumber, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as M from './../model.js';
import * as storage from './../storage.js';
import * as store from './../store.js';
import { REPO_URL, VERSION } from './../version.js';
import { check, heading, hint, panel, row, seg, stepper } from './../ui.js';
import { openExportSheet, openShareSheet } from './share.js';

function languagePanel() {
  const current = store.state.settings.lang;
  const options = [{ code: null, label: t('settings.theme.auto') }, ...LANGUAGES.map((l) => ({ code: l.code, label: l.label }))];

  return panel(
    el(
      'div',
      { class: 'panel__pad' },
      el(
        'div',
        { class: 'picker' },
        ...options.map((option) =>
          el('button', {
            type: 'button',
            lang: option.code || undefined,
            text: option.label,
            'aria-pressed': String(current === option.code),
            onClick: () => store.setLanguageSetting(option.code),
          })
        )
      )
    )
  );
}

function gamePanel(game) {
  const played = game.rounds.some((r) => r.phase === M.PHASE.DONE);
  const locked = played && !store.state.unlocked;

  const numberRow = (key, label, subtitle, min, max, format) =>
    row(
      label,
      subtitle,
      locked
        ? el('span', { class: 'row__value', text: format ? format(game.cfg[key]) : formatNumber(game.cfg[key]) })
        : stepper({
            value: game.cfg[key],
            min,
            max,
            label,
            format,
            onChange: (v) => store.setConfig(key, v),
          })
    );

  const box = panel(
    numberRow('ptsBid', t('setup.scoring.ptsBid'), t('setup.scoring.ptsBid.hint'), 0, 50),
    numberRow('ptsTrick', t('setup.scoring.ptsTrick'), t('setup.scoring.ptsTrick.hint'), 0, 50),
    numberRow('ptsMiss', t('setup.scoring.ptsMiss'), t('setup.scoring.ptsMiss.hint'), 0, 50),
    el(
      'div',
      { class: 'row' },
      el(
        'div',
        { class: 'row__label' },
        check({
          label: t('setup.scoring.strict'),
          checked: game.cfg.strict,
          disabled: locked,
          onChange: (value) => store.setConfig('strict', value),
        })
      )
    ),
    numberRow(
      'banFrom',
      t('setup.rule.banFrom'),
      t('setup.rule.banFrom.hint'),
      0,
      M.MAX_CARDS,
      (v) => (v === 0 ? t('setup.rule.off') : formatNumber(v))
    )
  );

  return box;
}

function unlockBar() {
  const unlocked = store.state.unlocked;
  return el(
    'div',
    { class: unlocked ? 'unlockbar' : null },
    unlocked ? icon('unlock') : null,
    unlocked ? el('span', { text: t('lock.unlocked') }) : null,
    el('button', {
      type: 'button',
      class: unlocked ? null : 'btn btn--ghost btn--block',
      text: unlocked ? t('lock.lock') : t('lock.unlock'),
      onClick: () => store.toggleUnlocked(),
    })
  );
}

function dataPanel(game) {
  const actions = el('div', { class: 'panel__pad', style: { display: 'grid', gap: '0.5rem' } });

  if (game) {
    actions.appendChild(
      el(
        'button',
        { type: 'button', class: 'btn btn--ghost btn--block', onClick: () => openShareSheet(game) },
        icon('share'),
        el('span', { text: t('menu.share') })
      )
    );
    actions.appendChild(
      el(
        'button',
        { type: 'button', class: 'btn btn--ghost btn--block', onClick: () => openExportSheet(game) },
        icon('download'),
        el('span', { text: t('menu.export') })
      )
    );
  }

  actions.appendChild(
    el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--danger btn--block',
      text: t('settings.clear'),
      onClick: async () => {
        const count = storage.countGames();
        const ok = await confirmSheet({
          title: t('settings.clear.confirm', { n: formatNumber(count) }),
          confirmLabel: t('common.delete'),
        });
        if (!ok) return;
        storage.clearAllGames();
        storage.clearSettings();
        store.closeGame();
        store.state.settings = storage.loadSettings();
        store.applyTheme();
        store.setView('games');
        toast(t('settings.cleared'));
      },
    })
  );

  return panel(actions);
}

function offlinePanel() {
  const { supported, ready, updateReady, applyUpdate } = store.state.offline;
  const message = !supported
    ? t('settings.offline.unsupported')
    : ready
      ? t('settings.offline.ready')
      : t('settings.offline.pending');

  const box = panel(el('div', { class: 'panel__pad' }, el('p', { class: 'hint', style: { margin: '0' }, text: message })));

  if (updateReady && typeof applyUpdate === 'function') {
    box.appendChild(
      el(
        'div',
        { class: 'panel__pad', style: { 'padding-top': '0' } },
        el('p', { class: 'hint', text: t('settings.update.available') }),
        el('button', {
          type: 'button',
          class: 'btn btn--primary btn--block',
          text: t('settings.update.reload'),
          onClick: () => applyUpdate(),
        })
      )
    );
  }

  if (storage.isVolatile()) {
    box.appendChild(
      el(
        'div',
        { class: 'panel__pad', style: { 'padding-top': '0' } },
        el('p', { class: 'hint', style: { color: 'var(--bad)' }, text: t('settings.storage.volatile') })
      )
    );
  }

  return box;
}

export function renderSettings() {
  const game = store.state.game;
  const root = el('div', null, heading(t('settings.title'), true));

  root.appendChild(heading(t('settings.language')));
  root.appendChild(languagePanel());

  root.appendChild(heading(t('settings.theme')));
  root.appendChild(
    panel(
      el(
        'div',
        { class: 'panel__pad' },
        seg({
          block: true,
          label: t('settings.theme'),
          value: store.state.settings.theme,
          onChange: (value) => store.setThemeSetting(value),
          options: [
            { value: 'auto', label: t('settings.theme.auto') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ],
        })
      )
    )
  );

  if (game) {
    root.appendChild(heading(t('settings.game')));
    root.appendChild(hint(t('settings.game.hint')));
    if (game.rounds.some((r) => r.phase === M.PHASE.DONE)) {
      root.appendChild(hint(t('lock.hint')));
      root.appendChild(unlockBar());
    }
    root.appendChild(gamePanel(game));
  }

  root.appendChild(heading(t('settings.data')));
  root.appendChild(dataPanel(game));

  root.appendChild(heading(t('settings.about')));
  root.appendChild(offlinePanel());
  root.appendChild(
    panel(
      el(
        'div',
        { class: 'panel__pad' },
        el('p', { class: 'hint', text: t('settings.about.body') }),
        el('p', { class: 'hint', style: { margin: '0' } }, el('span', { text: t('settings.version', { v: VERSION }) })),
        el('p', { style: { margin: '0.5rem 0 0' } }, el('a', { class: 'linkish', href: REPO_URL, rel: 'noopener', target: '_blank', text: t('settings.source') }))
      )
    )
  );

  return root;
}
