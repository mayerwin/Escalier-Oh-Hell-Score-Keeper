/**
 * The game library: everything stored on this device, newest first.
 */

import { el, icon } from './../dom.js';
import { formatDateTime, formatNumber, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as storage from './../storage.js';
import * as store from './../store.js';
import { emptyState, heading, panel } from './../ui.js';

function gameCard(summary) {
  const isOpen = store.state.game && store.state.game.id === summary.id;

  return el(
    'article',
    { class: 'gamecard' },
    el(
      'div',
      { class: 'gamecard__top' },
      el('h3', { class: 'gamecard__name', text: summary.name || "L'Escalier" }),
      el('span', { class: 'gamecard__when', text: formatDateTime(summary.updated) })
    ),
    el(
      'p',
      { class: 'gamecard__meta' },
      el('span', { class: 'gamecard__players', text: summary.playerNames.join(' · ') }),
      el('span', {
        class: 'mono',
        text: t('games.progress', { done: formatNumber(summary.done), total: formatNumber(summary.total) }),
      }),
      el('span', {
        class: `pill pill--${summary.finished ? 'done' : 'live'}`,
        text: summary.finished ? t('games.finished') : t('games.current'),
      })
    ),
    el(
      'div',
      { class: 'btnrow' },
      el('button', {
        type: 'button',
        class: 'btn btn--primary btn--inrow',
        text: isOpen ? t('games.resume') : t('games.open'),
        onClick: () => store.openGame(summary.id),
      }),
      el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--danger btn--inrow btn--hug',
        'aria-label': `${t('common.delete')}${t('common.joiner')}${summary.name}`,
        text: t('common.delete'),
        onClick: async () => {
          const ok = await confirmSheet({
            title: t('games.delete.confirm', { name: summary.name || "L'Escalier" }),
            confirmLabel: t('common.delete'),
          });
          if (!ok) return;
          store.deleteGame(summary.id);
          toast(t('games.deleted'));
        },
      })
    )
  );
}

export function renderGames() {
  const summaries = storage.listGames();
  const root = el('div', null, heading(t('games.title'), true));

  root.appendChild(
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary btn--block',
        onClick: () => store.setView('setup'),
      },
      icon('plus'),
      el('span', { text: t('games.new') })
    )
  );

  if (summaries.length === 0) {
    root.appendChild(el('div', { class: 'footaction' }, emptyState(t('games.empty'))));
    return root;
  }

  const list = panel();
  for (const summary of summaries) list.appendChild(gameCard(summary));
  root.appendChild(el('div', { class: 'stagger spaced' }, list));

  return root;
}
