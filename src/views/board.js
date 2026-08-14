/**
 * Standings, round-by-round history, and mid-game player management.
 *
 * The history used to wrap `Name 0/0 +5` chips into a paragraph per round,
 * which could not be scanned down a column and told you nothing about how a
 * player's evening had gone. It is now what a paper score pad has always
 * been: rounds down the side, players across the top, one cell each. Fifteen
 * rounds of five players fit in the space the old version gave to three.
 */

import { el, icon } from './../dom.js';
import { formatNumber, formatSigned, t } from './../i18n.js';
import { confirmSheet, openSheet, promptSheet, sheetAction, sheetHeader, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { sortable } from './../sortable.js';
import { emptyState, heading, hint, panel, pip, row, stepper } from './../ui.js';

/**
 * Session-local state for the "add a latecomer" form, cleared when the open
 * game changes so a half-typed name never surfaces in a different game.
 */
let addForm = { gameId: null, name: '', carry: 0 };

function resetAddForm(gameId) {
  addForm = { gameId, name: '', carry: 0 };
}

/**
 * Manage one player: rename, sit them out for the rest, or remove them.
 *
 * Withdrawing is offered first and framed as the ordinary case, because it is:
 * somebody leaves the table, and what they scored still happened. Removal is
 * the destructive one — it strips their entries from rounds already played,
 * which leaves those rounds with tricks that no longer add up to the hand.
 */
function openPlayerSheet(game, playerId) {
  const player = M.playerById(game, playerId);
  if (!player) return;

  openSheet(({ close }) => {
    const actions = el('div', { class: 'sheet__actions' });

    actions.appendChild(
      sheetAction({
        label: t('board.player.rename'),
        iconName: 'pencil',
        onClick: async () => {
          close();
          const name = await promptSheet({
            title: t('board.player.rename'),
            value: player.name,
            maxLength: 24,
          });
          if (name) store.renamePlayer(playerId, name);
        },
      })
    );

    actions.appendChild(
      sheetAction({
        label: player.withdrawn ? t('board.player.rejoin') : t('board.player.withdraw'),
        iconName: player.withdrawn ? 'userPlus' : 'skip',
        onClick: async () => {
          if (!player.withdrawn) {
            const ok = await confirmSheet({
              title: t('board.player.withdraw.confirm', { name: player.name }),
              confirmLabel: t('board.player.withdraw'),
              danger: false,
            });
            if (!ok) return;
          }
          store.setWithdrawn(playerId, !player.withdrawn);
          close();
          toast(player.withdrawn ? t('board.player.rejoined', { name: player.name }) : t('board.player.withdrawn', { name: player.name }));
        },
      })
    );

    actions.appendChild(
      sheetAction({
        label: t('board.player.remove'),
        iconName: 'trash',
        danger: true,
        disabled: game.players.length <= M.MIN_PLAYERS,
        onClick: async () => {
          const ok = await confirmSheet({
            title: t('board.player.remove.confirm', { name: player.name }),
            body: t('board.player.remove.body'),
            confirmLabel: t('common.remove'),
          });
          if (!ok) return;
          if (store.removePlayer(playerId)) {
            close();
            toast(t('board.player.removed', { name: player.name }));
          } else {
            toast(t('board.player.min'));
          }
        },
      })
    );

    return el('div', null, sheetHeader(player.name, t('board.player.sheetHint')), actions);
  });
}

/** How often a player called it exactly right, out of the hands they played. */
function callRecord(game, playerId) {
  let made = 0;
  let played = 0;
  for (const round of game.rounds) {
    if (round.phase !== M.PHASE.DONE) continue;
    const entry = M.entryOf(round, playerId);
    if (!entry || entry.out || entry.bid === null || entry.tricks === null) continue;
    played += 1;
    if (entry.bid === entry.tricks) made += 1;
  }
  return { made, played };
}

function standingsPanel(game) {
  const rows = M.standings(game);
  const played = game.rounds.some((r) => r.phase === M.PHASE.DONE);
  const best = rows.length ? rows[0].score : 0;
  const manage = store.state.manageSeats;

  const box = el('section', { class: 'panel ledger' });

  // Naming the columns costs one 24px strip and stops the "made" figure from
  // reading as a second, mysterious score.
  if (!manage) {
    box.appendChild(
      el(
        'div',
        { class: 'colhead colhead--board' },
        el('span', { text: '#' }),
        el('span', { text: t('common.player') }),
        el('span', { text: t('board.made') }),
        el('span', { text: t('common.total') })
      )
    );
  }

  // Managing players is editing the seating, so the list shows seat order
  // while it is open. Dragging a list sorted by score to change the order
  // around the table would be reordering one thing by manipulating another.
  const listed = manage ? [...rows].sort((a, b) => M.seatIndex(game, a.id) - M.seatIndex(game, b.id)) : rows;

  listed.forEach((entry) => {
    const isLeader = played && !manage && entry.score === best;
    const seat = M.seatIndex(game, entry.id);
    const player = M.playerById(game, entry.id);
    const record = callRecord(game, entry.id);

    // The name and everything that qualifies it share the one flexible cell,
    // so the two numeric columns stay exactly where the header says they are.
    const who = el('span', { class: 'board__who' }, el('span', { class: 'board__name', text: entry.name }));
    if (isLeader) who.appendChild(icon('crown', { class: 'board__crown' }));
    if (player && player.withdrawn) {
      who.appendChild(el('span', { class: 'badge badge--out' }, el('span', { text: t('board.withdrawn') })));
    }

    box.appendChild(
      el(
        'div',
        {
          class: ['board__row', isLeader ? 'is-leader' : null, manage ? 'is-manage' : null],
          dataset: manage ? { sortIndex: seat } : null,
        },
        manage
          ? el(
              'button',
              {
                type: 'button',
                class: 'seat__grip',
                'data-sort-handle': '',
                dataset: { fk: `seatgrip:${entry.id}` },
                'aria-label': t('a11y.reorder', { name: entry.name }),
                title: t('a11y.reorder', { name: entry.name }),
              },
              icon('grip')
            )
          : null,
        pip(entry.color, manage ? seat + 1 : entry.rank),
        who,
        manage
          ? null
          : el('span', {
              class: 'board__made',
              text: record.played ? `${formatNumber(record.made)}/${formatNumber(record.played)}` : '—',
            }),
        manage
          ? el('button', {
              type: 'button',
              class: 'btn btn--ghost btn--inrow',
              text: t('common.edit'),
              'aria-label': `${entry.name}${t('common.joiner')}${t('common.edit')}`,
              onClick: () => openPlayerSheet(game, entry.id),
            })
          : el('span', { class: 'board__score', text: formatNumber(entry.score) })
      )
    );
  });

  if (manage) {
    sortable(box, {
      describe: (from, to) =>
        t('a11y.moved', { name: listed[from] ? listed[from].name : '', n: to + 1, total: listed.length }),
      onMove: (from, to) => store.movePlayer(from, to),
    });
  }

  return box;
}

/**
 * Round by round, as an actual score pad. The round label is the button that
 * reopens the round, so it is a full-height target rather than a pencil
 * hidden at the far end of a wrapping line.
 */
function historyPanel(game) {
  const done = [];
  game.rounds.forEach((round, index) => {
    if (round.phase === M.PHASE.DONE) done.push({ round, index });
  });

  if (done.length === 0) return emptyState(t('board.history.empty'));

  const players = game.players;
  // The round column is fixed; the players share what is left, and the whole
  // grid scrolls sideways once there are more of them than the width allows.
  // The track list is data (how many players there are), so it travels as a
  // custom property and the stylesheet still decides what to do with it.
  const grid = el('div', {
    class: 'sheetgrid__inner',
    style: { '--sheet-cols': `3.25rem repeat(${players.length}, minmax(3.25rem, 1fr))` },
  });

  const head = el('div', { class: 'sheetgrid__head' }, el('span', { class: 'sheetgrid__corner', text: t('common.round') }));
  for (const player of players) {
    head.appendChild(
      el(
        'span',
        { class: 'sheetgrid__player', title: player.name },
        el('span', { class: 'dot', style: { background: player.color } }),
        el('span', { text: player.name })
      )
    );
  }
  grid.appendChild(head);

  for (const { round, index } of done) {
    const line = el(
      'div',
      { class: 'sheetgrid__row' },
      el(
        'button',
        {
          type: 'button',
          class: 'hist',
          'aria-label': `${t('board.correct')}${t('common.joiner')}${t('stairs.detail.title', { n: index + 1 })}`,
          dataset: { fk: `hist:${index}` },
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
        el('span', { class: 'hist__n', text: t('stairs.step', { n: index + 1 }) }),
        el('span', { class: 'hist__cards', text: formatNumber(round.cards) })
      )
    );

    for (const player of players) {
      const entry = M.entryOf(round, player.id);
      if (!entry || entry.out) {
        line.appendChild(
          el('span', { class: 'sheetgrid__cell is-out' }, el('span', { class: 'sheetgrid__call', text: t('board.absent') }))
        );
        continue;
      }
      const pts = M.entryPoints(entry, game.cfg);
      const made = entry.bid !== null && entry.bid === entry.tricks;
      line.appendChild(
        el(
          'span',
          { class: ['sheetgrid__cell', made ? 'is-made' : null] },
          el('span', {
            class: 'sheetgrid__call',
            text: `${formatNumber(entry.bid ?? 0)}·${formatNumber(entry.tricks ?? 0)}`,
          }),
          el('span', {
            class: ['sheetgrid__pts', pts > 0 ? 'sheetgrid__pts--pos' : pts < 0 ? 'sheetgrid__pts--neg' : 'sheetgrid__pts--zero'],
            text: formatSigned(pts),
          })
        )
      );
    }
    grid.appendChild(line);
  }

  return panel(el('div', { class: 'sheetgrid' }, grid));
}

function addPlayerPanel(game) {
  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    maxlength: 24,
    value: addForm.name,
    placeholder: t('setup.players.placeholder', { n: game.players.length + 1 }),
    onInput: (event) => {
      // Deliberately does not re-render: that would drop the caret.
      addForm.name = event.target.value;
    },
  });

  return panel(
    el('div', { class: 'panel__pad' }, hint(t('board.addPlayer.hint'))),
    row(t('board.addPlayer.name'), null, el('span', { class: 'field' }, nameInput)),
    row(
      t('board.addPlayer.carry'),
      null,
      stepper({
        value: addForm.carry,
        min: -999,
        max: 999,
        label: t('board.addPlayer.carry'),
        onChange: (v) => {
          addForm.carry = v;
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
            const name = addForm.name.trim() || t('setup.players.placeholder', { n: game.players.length + 1 });
            const added = store.addPlayer(name, addForm.carry);
            if (!added) {
              toast(t('setup.players.max'));
              return;
            }
            resetAddForm(game.id);
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

  if (addForm.gameId !== game.id) resetAddForm(game.id);

  const progress = M.progress(game);
  const root = el('div', null, heading(t('board.title'), true));

  if (game.players.length === 0) {
    root.appendChild(emptyState(t('board.empty')));
    return root;
  }

  root.appendChild(standingsPanel(game));

  root.appendChild(
    el(
      'div',
      { class: 'subrow' },
      hint(
        progress.done >= progress.total && progress.total > 0
          ? t('board.complete', { n: progress.total })
          : t('board.progress', { done: progress.done, total: progress.total })
      ),
      el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--inrow',
        text: store.state.manageSeats ? t('board.manage.done') : t('board.manage'),
        'aria-pressed': String(store.state.manageSeats),
        dataset: { fk: 'manageseats' },
        onClick: () => {
          store.state.manageSeats = !store.state.manageSeats;
          store.render();
        },
      })
    )
  );

  root.appendChild(heading(t('board.history')));
  root.appendChild(historyPanel(game));

  root.appendChild(heading(t('board.addPlayer')));
  root.appendChild(addPlayerPanel(game));

  root.appendChild(
    el('button', {
      type: 'button',
      class: ['btn', 'btn--ghost', 'btn--block', 'footaction', game.finished ? null : 'btn--danger'],
      text: game.finished ? t('board.reopen') : t('board.finish'),
      onClick: () => {
        store.setFinished(!game.finished);
        toast(game.finished ? t('board.reopened') : t('board.finished'));
      },
    })
  );

  return root;
}
