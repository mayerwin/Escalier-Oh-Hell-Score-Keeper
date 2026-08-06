/**
 * Standings, round-by-round history, and mid-game player management.
 */

import { el, icon } from './../dom.js';
import { formatNumber, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { emptyState, heading, hint, panel, row, stepper } from './../ui.js';

/** Session-local state for the "add a latecomer" form. */
let newPlayerName = '';
let newPlayerCarry = 0;

function standingsPanel(game) {
  const rows = M.standings(game);
  const played = game.rounds.some((r) => r.phase === M.PHASE.DONE);
  const best = rows.length ? rows[0].score : 0;
  const manage = store.state.manageSeats;

  const box = panel();
  rows.forEach((entry) => {
    const isLeader = played && !manage && entry.score === best;
    const seat = M.seatIndex(game, entry.id);

    box.appendChild(
      el(
        'div',
        { class: ['board__row', isLeader ? 'is-leader' : null] },
        el('span', { class: 'board__rank', text: formatNumber(entry.rank) }),
        el('span', { class: 'dot', style: { background: entry.color } }),
        el('span', { class: 'board__name', text: entry.name }),
        isLeader ? icon('crown', { class: 'board__crown' }) : null,
        manage
          ? el(
              'span',
              { class: 'seat__moves' },
              el(
                'button',
                {
                  type: 'button',
                  'aria-label': t('common.moveUp'),
                  disabled: seat === 0,
                  onClick: () => store.movePlayer(seat, seat - 1),
                },
                icon('chevronUp')
              ),
              el(
                'button',
                {
                  type: 'button',
                  'aria-label': t('common.moveDown'),
                  disabled: seat === game.players.length - 1,
                  onClick: () => store.movePlayer(seat, seat + 1),
                },
                icon('chevronDown')
              )
            )
          : null,
        manage
          ? el('button', {
              type: 'button',
              class: 'btn btn--ghost btn--danger',
              style: { 'min-height': '2.25rem', padding: '0.25rem 0.75rem' },
              text: t('board.player.remove'),
              onClick: async () => {
                if (game.players.length <= M.MIN_PLAYERS) {
                  toast(t('board.player.min'));
                  return;
                }
                const ok = await confirmSheet({
                  title: t('board.player.remove.confirm', { name: entry.name }),
                  confirmLabel: t('common.remove'),
                });
                if (!ok) return;
                if (store.removePlayer(entry.id)) toast(t('board.player.removed', { name: entry.name }));
              },
            })
          : el('span', { class: 'board__score', text: formatNumber(entry.score) })
      )
    );
  });
  return box;
}

function historyPanel(game) {
  const done = [];
  game.rounds.forEach((round, index) => {
    if (round.phase === M.PHASE.DONE) done.push({ round, index });
  });

  if (done.length === 0) return emptyState(t('board.history.empty'));

  const box = panel();
  for (const { round, index } of done) {
    const cells = el('span', { class: 'hist__body' });
    for (const playerId of M.bidOrder(game, round)) {
      const player = M.playerById(game, playerId);
      const entry = M.entryOf(round, playerId);
      if (!entry) continue;
      if (entry.out) {
        cells.appendChild(
          el(
            'span',
            { class: 'hist__cell' },
            el('b', { text: player.name }),
            el('span', { class: 'muted', text: t('board.absent') })
          )
        );
        continue;
      }
      const pts = M.entryPoints(entry, game.cfg);
      cells.appendChild(
        el(
          'span',
          { class: 'hist__cell' },
          el('b', { text: player.name }),
          el('span', { text: `${formatNumber(entry.bid ?? 0)}/${formatNumber(entry.tricks ?? 0)}` }),
          el('i', {
            style: { color: pts >= 0 ? 'var(--good)' : 'var(--bad)' },
            text: pts > 0 ? `+${formatNumber(pts)}` : formatNumber(pts),
          })
        )
      );
    }

    box.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'hist',
          'aria-label': `${t('board.correct')} — ${t('stairs.detail.title', { n: index + 1 })}`,
          onClick: async () => {
            const laterPlayed = game.rounds.slice(index + 1).some((r) => r.phase === M.PHASE.DONE);
            if (laterPlayed) {
              const ok = await confirmSheet({
                title: t('stairs.reopen.confirm', { n: index + 1 }),
                confirmLabel: t('common.edit'),
                danger: false,
              });
              if (!ok) return;
            }
            store.reopenRound(index);
          },
        },
        el(
          'span',
          { class: 'hist__n' },
          el('span', { text: t('stairs.step', { n: index + 1 }) }),
          el('small', { text: t('common.cardsCount', { n: round.cards }) })
        ),
        cells,
        icon('pencil', { class: 'hist__go' })
      )
    );
  }
  return box;
}

function addPlayerPanel(game) {
  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    maxlength: 24,
    value: newPlayerName,
    placeholder: t('setup.players.placeholder', { n: game.players.length + 1 }),
    onInput: (event) => {
      // Deliberately does not re-render: that would drop the caret.
      newPlayerName = event.target.value;
    },
  });

  return panel(
    el('div', { class: 'panel__pad' }, hint(t('board.addPlayer.hint'))),
    row(t('board.addPlayer.name'), null, el('span', { class: 'field', style: { flex: '0 0 11rem' } }, nameInput)),
    row(
      t('board.addPlayer.carry'),
      null,
      stepper({
        value: newPlayerCarry,
        min: -999,
        max: 999,
        label: t('board.addPlayer.carry'),
        onChange: (v) => {
          newPlayerCarry = v;
          store.render();
        },
      })
    ),
    el(
      'div',
      { class: 'panel__pad' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--dashed',
          disabled: game.players.length >= M.MAX_PLAYERS,
          onClick: () => {
            const name = (newPlayerName || '').trim() || t('setup.players.placeholder', { n: game.players.length + 1 });
            const added = store.addPlayer(name, newPlayerCarry);
            if (!added) {
              toast(t('setup.players.max'));
              return;
            }
            newPlayerName = '';
            newPlayerCarry = 0;
            store.render();
            toast(t('board.addPlayer.added', { name }));
          },
        },
        icon('userPlus'),
        el('span', { text: t('board.addPlayer') })
      )
    )
  );
}

export function renderBoard() {
  const game = store.state.game;
  if (!game) return emptyState(t('play.noGame.body'));

  const progress = M.progress(game);
  const root = el('div', null, heading(t('board.title'), true));

  if (game.players.length === 0) {
    root.appendChild(emptyState(t('board.empty')));
    return root;
  }

  root.appendChild(standingsPanel(game));

  root.appendChild(
    el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--block',
      style: { 'margin-top': '0.625rem' },
      text: store.state.manageSeats ? t('board.manage.done') : t('board.manage'),
      'aria-pressed': String(store.state.manageSeats),
      onClick: () => {
        store.state.manageSeats = !store.state.manageSeats;
        store.render();
      },
    })
  );

  root.appendChild(
    hint(
      progress.done >= progress.total && progress.total > 0
        ? t('board.complete', { n: progress.total })
        : t('board.progress', { done: progress.done, total: progress.total }),
      true
    )
  );

  root.appendChild(heading(t('board.history')));
  root.appendChild(historyPanel(game));

  root.appendChild(heading(t('board.addPlayer')));
  root.appendChild(addPlayerPanel(game));

  root.appendChild(
    el('button', {
      type: 'button',
      class: ['btn', 'btn--ghost', 'btn--block', game.finished ? null : 'btn--danger'],
      style: { 'margin-top': '1.5rem' },
      text: game.finished ? t('board.reopen') : t('board.finish'),
      onClick: () => {
        store.setFinished(!game.finished);
        toast(game.finished ? t('board.reopened') : t('board.finished'));
      },
    })
  );

  return root;
}
