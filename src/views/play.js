/**
 * The round view — where the game is actually scored.
 *
 * A round is entered in two explicit phases, and the app never blurs them:
 *
 *   1. Bids    every player's call, in bidding order, dealer last, with the
 *              dealer's forbidden number struck out where the rule applies.
 *   2. Tricks  what each player actually won, with a live "still to place"
 *              counter that must reach zero before the round can be recorded.
 *
 * Numbers are entered by tapping a chip rather than nudging a stepper: one tap
 * per value, no repeated presses, and an unset value stays visibly unset.
 */

import { el, icon } from './../dom.js';
import { formatNumber, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { badge, dot, heading, hint, panel, points, status } from './../ui.js';
import { openPlayerRoundSheet, openRoundSheet } from './roundsheet.js';

/**
 * The core input: 0..max as tappable chips, one tap per value.
 *
 * Chips are used at every hand size, deliberately. A stepper cannot express
 * "no value yet" separately from zero — it would start displaying 0 with its
 * minus button already disabled, so a player bidding zero could never commit
 * that bid and the round could never be locked. An unset chip row is simply
 * one with nothing pressed.
 */
function numberField({ max, value, onPick, forbidden, label, disabled = false }) {
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': label });
  for (let n = 0; n <= max; n += 1) {
    const isForbidden = forbidden === n;
    chips.appendChild(
      el('button', {
        type: 'button',
        class: ['chip', isForbidden ? 'is-forbidden' : null],
        text: formatNumber(n),
        'aria-pressed': String(value === n),
        'aria-label': isForbidden ? t('play.bids.forbidden', { n }) : undefined,
        dataset: { fk: `chip:${label}:${n}` },
        disabled: disabled || (isForbidden && value !== n),
        onClick: () => onPick(n),
      })
    );
  }
  return chips;
}

function roleBadges(game, round, playerId) {
  const out = [];
  if (round.dealerId === playerId) out.push(badge('dealer', 'deal', t('play.dealsBadge')));
  if (M.leadOf(game, round) === playerId && round.dealerId !== playerId) {
    out.push(badge('lead', 'arrowRight', t('play.opensBadge')));
  }
  return out;
}

function entryCard({ game, round, roundIndex, playerId, phase, runningScore, isFocus }) {
  const player = M.playerById(game, playerId);
  const entry = round.entries[playerId];
  const out = entry.out;

  const head = el(
    'div',
    { class: 'entry__head' },
    el('span', { class: 'entry__seat', text: formatNumber(M.seatIndex(game, playerId) + 1) }),
    dot(player.color),
    el('span', { class: 'entry__name', text: player.name }),
    ...roleBadges(game, round, playerId),
    out ? badge('out', null, t('board.absent')) : null,
    el('span', { class: 'entry__score', text: `${formatNumber(runningScore)} ${t('common.points')}` }),
    el(
      'button',
      {
        type: 'button',
        class: 'iconbtn',
        style: { width: '2rem', height: '2rem' },
        'aria-label': `${player.name} — ${t('common.edit')}`,
        onClick: () => openPlayerRoundSheet(roundIndex, playerId),
      },
      icon('dots')
    )
  );

  const card = el('article', { class: ['entry', isFocus ? 'is-focus' : null, out ? 'is-out' : null] }, head);

  if (out) {
    card.appendChild(
      el(
        'div',
        { class: 'entry__body' },
        el(
          'div',
          { class: 'preview', style: { 'border-top': 'none', 'padding-top': '0' } },
          el('span', { text: t('play.out') }),
          el('button', {
            type: 'button',
            class: 'btn btn--ghost',
            style: { 'min-height': '2.25rem', padding: '0.25rem 0.875rem' },
            text: t('play.dealIn'),
            onClick: () => store.setOut(roundIndex, playerId, false),
          })
        )
      )
    );
    return card;
  }

  const body = el('div', { class: 'entry__body' });

  if (phase === M.PHASE.BIDDING) {
    body.appendChild(
      el(
        'div',
        { class: 'entry__label' },
        el('span', { text: t('common.bid') }),
        entry.adj ? el('span', { text: `${t('play.adjust')} ${entry.adj > 0 ? '+' : ''}${formatNumber(entry.adj)}` }) : null
      )
    );
    body.appendChild(
      numberField({
        max: round.cards,
        value: entry.bid,
        forbidden: playerId === round.dealerId ? M.forbiddenDealerBid(game, round) : null,
        label: t('a11y.bidFor', { name: player.name }),
        onPick: (n) => store.setBid(playerId, n),
      })
    );
  } else {
    // Tricks phase: the bid is settled and shown read-only beside the input.
    body.appendChild(
      el(
        'div',
        { class: 'entry__label' },
        el('span', { text: t('common.tricks') }),
        el('span', { class: 'entry__locked' }, el('span', { text: t('common.bid') }), el('b', { text: formatNumber(entry.bid ?? 0) }))
      )
    );
    body.appendChild(
      numberField({
        max: round.cards,
        value: entry.tricks,
        label: t('a11y.tricksFor', { name: player.name }),
        onPick: (n) => store.setTricks(playerId, n),
      })
    );

    if (entry.bid !== null && entry.tricks !== null) {
      const delta = entry.tricks - entry.bid;
      const label =
        delta === 0
          ? t('play.result.made')
          : delta < 0
            ? t('play.result.short', { n: -delta })
            : t('play.result.over', { n: delta });
      body.appendChild(
        el(
          'div',
          { class: 'preview' },
          el('span', { text: label }),
          points(M.entryPoints(entry, game.cfg))
        )
      );
    }
  }

  card.appendChild(body);
  return card;
}

function bidStatus(game, round) {
  const state = M.bidState(game, round);
  const sum = t('play.bids.sum', { sum: formatNumber(state.sum), cards: formatNumber(round.cards) });

  if (state.missing > 0) {
    return status('info', 'info', sum, ' — ', t('play.bids.missing', { n: state.missing }));
  }
  if (state.violates) {
    const dealer = M.playerById(game, round.dealerId);
    return status(
      'bad',
      'alert',
      sum,
      ' — ',
      t('play.bids.banned', { cards: formatNumber(round.cards), name: dealer ? dealer.name : '' })
    );
  }
  if (state.diff > 0) return status('ok', 'check', sum, ' — ', t('play.bids.over', { n: state.diff }));
  if (state.diff < 0) return status('ok', 'check', sum, ' — ', t('play.bids.under', { n: -state.diff }));
  return status('ok', 'check', sum, ' — ', t('play.bids.exact'));
}

function trickStatus(game, round) {
  const state = M.trickState(game, round);
  if (state.diff > 0) return status('bad', 'alert', t('play.tricks.over', { n: state.diff }));
  if (state.remaining > 0) return status('warn', 'info', t('play.tricks.remaining', { n: state.remaining }));
  if (state.missing > 0) return status('warn', 'info', t('play.tricks.missing', { n: state.missing }));
  return status('ok', 'check', t('play.tricks.exact', { n: round.cards }));
}

function phaseBar(phase) {
  const isBidding = phase === M.PHASE.BIDDING;
  return el(
    'div',
    { class: 'phases', role: 'group', 'aria-label': t('play.step', { n: isBidding ? 1 : 2 }) },
    el(
      'div',
      { class: ['phase', isBidding ? null : 'is-complete'], 'aria-current': isBidding ? 'step' : null },
      el('span', { class: 'phase__num' }, isBidding ? '1' : icon('check', { weight: 3 })),
      el('span', { text: t('play.phase.bids') })
    ),
    el(
      'div',
      { class: 'phase', 'aria-current': isBidding ? null : 'step' },
      el('span', { class: 'phase__num', text: '2' }),
      el('span', { text: t('play.phase.tricks') })
    )
  );
}

function completionPanel(game) {
  const board = M.standings(game);
  const top = board.length ? board[0] : null;
  const tied = board.filter((r) => top && r.score === top.score).length > 1;

  return el(
    'div',
    { class: 'stagger' },
    panel(
      el(
        'div',
        { class: 'panel__pad', style: { 'text-align': 'center' } },
        icon('crown', { class: 'board__crown', weight: 1.6 }),
        heading(t('play.complete.title'), true),
        hint(
          top
            ? tied
              ? t('play.complete.tie', { score: formatNumber(top.score) })
              : t('play.complete.body', { name: top.name, score: formatNumber(top.score) })
            : '',
          true
        )
      )
    ),
    el('button', {
      type: 'button',
      class: 'btn btn--primary btn--block',
      text: t('play.complete.board'),
      onClick: () => store.setView('board'),
    }),
    el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--block',
      style: { 'margin-top': '0.625rem' },
      text: t('play.complete.addRound'),
      onClick: () => {
        const last = game.rounds[game.rounds.length - 1];
        store.appendRound(last ? last.cards : 1);
        toast(t('stairs.added'));
      },
    })
  );
}

export function renderPlay() {
  const game = store.state.game;
  if (!game) {
    return el(
      'div',
      null,
      heading(t('play.noGame.title'), true),
      hint(t('play.noGame.body')),
      el('button', {
        type: 'button',
        class: 'btn btn--primary btn--block',
        text: t('games.new'),
        onClick: () => store.setView('setup'),
      })
    );
  }

  const roundIndex = M.currentRoundIndex(game);
  if (roundIndex < 0) return completionPanel(game);

  const round = game.rounds[roundIndex];
  // A pending round displays exactly like a bidding one; the phase is only
  // written to storage once the first bid lands, so rendering stays free of
  // side effects.
  const phase = round.phase === M.PHASE.TRICKS ? M.PHASE.TRICKS : M.PHASE.BIDDING;
  const playable = M.playableRounds(game);
  const ordinal = playable.indexOf(round) + 1;
  const running = M.scoresAfter(game, roundIndex);
  const order = M.bidOrder(game, round);

  const root = el('div', null);

  if (store.isCorrecting()) {
    root.appendChild(
      status('warn', 'pencil', t('play.editing', { n: roundIndex + 1 }))
    );
  }

  /* ---- header ---- */
  root.appendChild(
    el(
      'div',
      { class: 'roundhead' },
      el(
        'div',
        { class: 'roundhead__text' },
        el(
          'h1',
          { class: 'roundhead__title' },
          el('span', { text: `${t('common.round')} ` }),
          el('em', { text: formatNumber(ordinal) })
        ),
        el('p', {
          class: 'roundhead__sub',
          text: `${t('common.of')} ${formatNumber(playable.length)} · ${t('play.step', { n: phase === M.PHASE.BIDDING ? 1 : 2 })}`,
        })
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'iconbtn',
          'aria-label': t('stairs.detail.title', { n: roundIndex + 1 }),
          onClick: () => openRoundSheet(roundIndex),
        },
        icon('tune')
      ),
      el(
        'div',
        { class: 'cardcount' },
        el('span', { class: 'cardcount__label', text: t('play.cards') }),
        el('span', { class: 'cardcount__n', text: formatNumber(round.cards) })
      )
    )
  );

  root.appendChild(phaseBar(phase));
  root.appendChild(phase === M.PHASE.BIDDING ? bidStatus(game, round) : trickStatus(game, round));

  /* ---- player cards, in bidding order ---- */
  const field = phase === M.PHASE.BIDDING ? 'bid' : 'tricks';
  const nextUp = order.find((id) => !round.entries[id].out && round.entries[id][field] === null);

  const list = el('div', { class: 'stagger' });
  for (const playerId of order) {
    list.appendChild(
      entryCard({
        game,
        round,
        roundIndex,
        playerId,
        phase,
        runningScore: running[playerId] || 0,
        isFocus: playerId === nextUp,
      })
    );
  }
  root.appendChild(list);

  /* ---- the action that moves the game on ---- */
  const dock = el('div', { class: 'dock' });

  if (phase === M.PHASE.BIDDING) {
    const state = M.bidState(game, round);
    dock.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary btn--block',
          disabled: !state.ok,
          onClick: () => store.lockBids(),
        },
        el('span', { text: t('play.bids.lock') }),
        icon('arrowRight')
      )
    );
    if (state.complete && state.violates) {
      dock.appendChild(
        el('button', {
          type: 'button',
          class: 'btn btn--ghost btn--block',
          style: { 'margin-top': '0.5rem' },
          text: t('play.bids.override'),
          onClick: async () => {
            const ok = await confirmSheet({
              title: t('play.bids.overrideConfirm', {
                cards: formatNumber(round.cards),
                from: formatNumber(game.cfg.banFrom),
              }),
              confirmLabel: t('play.bids.override'),
            });
            if (ok) store.lockBids();
          },
        })
      );
    }
  } else {
    const state = M.trickState(game, round);
    dock.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary btn--block',
          disabled: !state.ok,
          onClick: () => {
            const index = store.recordRound();
            if (index !== null) toast(t('play.recorded', { n: index + 1 }));
          },
        },
        icon('check'),
        el('span', { text: t('play.record') })
      )
    );
    dock.appendChild(
      el('button', {
        type: 'button',
        class: 'btn btn--quiet btn--block',
        style: { 'margin-top': '0.25rem' },
        text: t('play.tricks.back'),
        onClick: () => store.backToBids(),
      })
    );
  }

  root.appendChild(dock);
  return root;
}
