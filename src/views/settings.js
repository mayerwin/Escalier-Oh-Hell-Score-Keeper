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
import * as R from './../roster.js';
import * as storage from './../storage.js';
import * as store from './../store.js';
import { sortable } from './../sortable.js';
import { REPO_URL, VERSION } from './../version.js';
import { check, heading, hint, panel, pip, row, seg, stepper } from './../ui.js';
import { openExportSheet, openShareSheet } from './share.js';

function languagePanel() {
  const current = store.state.settings.lang;
  // Its own key, not the theme's: German offers "Automatisch" for a theme but
  // wants "Systemsprache" for a language.
  const options = [
    { code: null, label: t('settings.language.auto') },
    ...LANGUAGES.map((l) => ({ code: l.code, label: l.label })),
  ];

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

/**
 * The people this device knows.
 *
 * Deliberately the same row shape as a seat on the setup screen — grip, pip,
 * name, one control, remove — because it is the same list seen a step earlier,
 * and the order set here is the order they sit down in.
 */
function rosterPanel() {
  const list = store.state.settings.roster;
  const box = panel();
  box.classList.add('roster');

  if (list.length) {
    box.appendChild(
      el(
        'div',
        { class: 'seathead', 'aria-hidden': 'true' },
        el('span'),
        el('span'),
        el('span'),
        el('span', { class: 'seat__collabel', text: t('settings.roster.column') }),
        el('span')
      )
    );
  }

  list.forEach((entry, index) => {
    box.appendChild(
      el(
        'div',
        { class: 'seat', dataset: { sortIndex: index } },
        el(
          'button',
          {
            type: 'button',
            class: 'seat__grip',
            'data-sort-handle': '',
            dataset: { fk: `rostergrip:${index}` },
            'aria-label': t('a11y.reorder', { name: entry.name }),
            title: t('a11y.reorder', { name: entry.name }),
          },
          icon('grip')
        ),
        pip(M.PALETTE[index % M.PALETTE.length], index + 1),
        el('input', {
          class: 'seat__input',
          type: 'text',
          maxlength: R.MAX_NAME,
          value: entry.name,
          'aria-label': t('board.addPlayer.name'),
          dataset: { fk: `roster:${index}` },
          // Committed when the box is left, not on every keystroke: renaming
          // through the store re-renders, and re-rendering mid-word would put
          // the caret back at the end of it.
          onChange: (event) => {
            // A refused rename snaps the old name back, which on its own looks
            // like the app losing what was typed.
            if (!store.renameInRoster(index, event.target.value)) toast(t('settings.roster.refused'));
          },
        }),
        el(
          'label',
          { class: 'rostertick' },
          el('input', {
            type: 'checkbox',
            checked: entry.always,
            'aria-label': t('a11y.rosterAlways', { name: entry.name }),
            onChange: (event) => store.setRosterAlways(index, event.target.checked),
          }),
          el('span', { class: 'check__box' }, icon('check', { weight: 3 }))
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'seat__remove',
            'aria-label': `${t('common.remove')}${t('common.joiner')}${entry.name}`,
            onClick: () => store.removeFromRoster(index),
          },
          icon('trash')
        )
      )
    );
  });

  sortable(box, {
    describe: (from, to) => t('a11y.moved', { name: list[from] ? list[from].name : '', n: to + 1, total: list.length }),
    onMove: (from, to) => store.moveInRoster(from, to),
  });

  if (!list.length) {
    box.appendChild(el('div', { class: 'panel__pad' }, el('p', { class: 'hint', text: t('settings.roster.empty') })));
  }

  // Adding is a form rather than a button, because the thing being added is a
  // name and there is nowhere else to type it.
  const field = el('input', {
    class: 'input',
    type: 'text',
    maxlength: R.MAX_NAME,
    placeholder: t('settings.roster.add'),
    'aria-label': t('settings.roster.add'),
  });

  const submit = () => {
    const name = field.value.trim();
    if (!name) return;
    field.value = '';
    store.addToRoster(name);
  };

  box.appendChild(
    el(
      'div',
      { class: 'panel__pad rosteradd' },
      field,
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--dashed',
          disabled: list.length >= R.MAX_ROSTER,
          onClick: submit,
        },
        icon('userPlus'),
        el('span', { text: t('common.add') })
      )
    )
  );

  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  });

  return box;
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
  const actions = el('div', { class: 'panel__pad stack' });

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
        store.resetEverything();
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

  const box = panel(el('div', { class: 'panel__pad' }, el('p', { class: 'hint', text: message })));

  if (updateReady && typeof applyUpdate === 'function') {
    box.appendChild(
      el(
        'div',
        { class: 'panel__pad panel__pad--top0' },
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
        { class: 'panel__pad panel__pad--top0' },
        el('p', { class: 'hint danger', text: t('settings.storage.volatile') })
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

  root.appendChild(heading(t('settings.roster')));
  root.appendChild(hint(t('settings.roster.hint')));
  root.appendChild(rosterPanel());

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
        el(
          'p',
          { class: 'hint' },
          el('span', { text: t('settings.version', { v: VERSION }) }),
          // Not translated: a name and a year read the same in every locale.
          el('span', { text: ' · © 2026 Erwin Mayer' })
        ),
        el(
          'p',
          { class: 'spaced' },
          el(
            'a',
            {
              class: 'linkish linkish--icon',
              href: REPO_URL,
              rel: 'noopener noreferrer',
              target: '_blank',
            },
            icon('github'),
            el('span', { text: t('settings.source') })
          )
        )
      )
    )
  );

  // A way out at the foot of a long scrolling screen, so nobody has to scroll
  // back up to the arrow. It says "Back" because that is what it does —
  // "Done" implies changes are being committed, and they were saved as made.
  root.appendChild(
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--ghost btn--block footaction',
        onClick: () => store.goBack(),
      },
      icon('arrowLeft'),
      el('span', { text: t('common.back') })
    )
  );

  return root;
}
