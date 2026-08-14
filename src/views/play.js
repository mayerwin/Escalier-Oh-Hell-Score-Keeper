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
 *
 * The players are rows of one ledger rather than five floating cards. Each row
 * is a fixed grid — pip, name, marks, running score, menu — so the scores line
 * up in a straight column down the screen and the standings are readable
 * without leaving the round. That, plus folding the bid into the chip strip
 * instead of giving it a label line of its own, is where the density came
 * from: nothing touchable got smaller.
 */

import { el, icon } from './../dom.js';
import { formatNumber, formatSigned, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { badge, heading, hint, panel, pip, staircase, status } from './../ui.js';
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
function numberField({ max, value, onPick, forbidden, bid, label, fk, disabled = false }) {
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': label });
  for (let n = 0; n <= max; n += 1) {
    const isForbidden = forbidden === n;
    // Marking the called number on the trick row means the bid needs no label
    // of its own, and you can see at a glance whether the chip you are about
    // to tap makes it.
    const isBid = bid !== null && bid !== undefined && bid === n;
    chips.appendChild(
      el('button', {
        type: 'button',
        class: ['chip', isForbidden ? 'is-forbidden' : null, isBid ? 'is-bid' : null],
        text: formatNumber(n),
        'aria-pressed': String(value === n),
        'aria-label': isForbidden ? t('play.bids.forbidden', { n }) : isBid ? `${formatNumber(n)}${t('common.joiner')}${t('common.bid')}` : undefined,
        // Keyed by player id, not name: two players may share a name, and a
        // colliding key would restore focus to the wrong row.
        dataset: { fk: `${fk}:${n}` },
        disabled: disabled || (isForbidden && value !== n),
        onClick: () => onPick(n),
      })
    );
  }
  return chips;
}

/**
 * What sits between the name and the running score.
 *
 * While the bids go in that is who deals and who opens. Once they are locked
 * the deal no longer matters and the space is better spent on the number each
 * player is now trying to make.
 */
function entryMarks(game, round, playerId, phase, entry) {
  const marks = el('span', { class: 'entry__marks' });

  // A one-off bonus or penalty is invisible in the chips and in the score
  // until the round is recorded, so it is named on the row that carries it.
  if (entry.adj) marks.appendChild(badge('lead', null, formatSigned(entry.adj), t('play.adjust')));

  if (entry.out) {
    marks.appendChild(badge('out', null, t('board.absent')));
    return marks;
  }

  if (phase === M.PHASE.BIDDING) {
    if (round.dealerId === playerId) marks.appendChild(badge('dealer', 'deal', t('play.dealsBadge')));
    if (M.leadOf(game, round) === playerId && round.dealerId !== playerId) {
      marks.appendChild(badge('lead', 'arrowRight', t('play.opensBadge')));
    }
    return marks;
  }

  marks.appendChild(badge('bid', null, formatNumber(entry.bid ?? 0), t('common.bid')));
  return marks;
}

/** Running score, with this round's swing under it once it is knowable. */
function scoreCell(game, entry, phase, runningScore) {
  const cell = el('span', { class: 'entry__score' }, el('b', { text: formatNumber(runningScore) }));

  if (phase === M.PHASE.TRICKS && !entry.out && entry.bid !== null && entry.tricks !== null) {
    const pts = M.entryPoints(entry, game.cfg);
    const kind = pts > 0 ? 'pos' : pts < 0 ? 'neg' : 'zero';
    cell.appendChild(el('i', { class: `entry__delta--${kind}`, text: formatSigned(pts) }));
  }
  return cell;
}

function entryRow({ game, round, roundIndex, playerId, phase, runningScore, isFocus }) {
  const player = M.playerById(game, playerId);
  const entry = round.entries[playerId];

  const head = el(
    'div',
    { class: 'entry__head' },
    pip(player.color, M.seatIndex(game, playerId) + 1),
    el('span', { class: 'entry__name', text: player.name }),
    entryMarks(game, round, playerId, phase, entry),
    scoreCell(game, entry, phase, runningScore),
    el(
      'button',
      {
        type: 'button',
        class: 'iconbtn',
        'aria-label': `${player.name}${t('common.joiner')}${t('common.edit')}`,
        dataset: { fk: `entrymenu:${playerId}` },
        onClick: () => openPlayerRoundSheet(roundIndex, playerId),
      },
      icon('dots')
    )
  );

  const card = el('article', { class: ['entry', isFocus ? 'is-focus' : null, entry.out ? 'is-out' : null] }, head);

  if (entry.out) {
    card.appendChild(
      el(
        'div',
        { class: 'entry__body' },
        el(
          'div',
          { class: 'entry__out' },
          el('span', { text: t('play.out') }),
          el('button', {
            type: 'button',
            class: 'btn btn--ghost btn--inrow',
            text: t('play.dealIn'),
            onClick: () => store.setOut(roundIndex, playerId, false),
          })
        )
      )
    );
    return card;
  }

  const isBidding = phase === M.PHASE.BIDDING;
  card.appendChild(
    el(
      'div',
      { class: 'entry__body' },
      numberField({
        max: round.cards,
        value: isBidding ? entry.bid : entry.tricks,
        // The bar falls on whoever bids last — the dealer, unless they are
        // sitting this one out.
        forbidden:
          isBidding && playerId === M.constrainedBidderId(game, round) ? M.forbiddenDealerBid(game, round) : null,
        bid: isBidding ? null : entry.bid,
        label: isBidding ? t('a11y.bidFor', { name: player.name }) : t('a11y.tricksFor', { name: player.name }),
        fk: `${isBidding ? 'bid' : 'tricks'}:${playerId}`,
        onPick: (n) => (isBidding ? store.setBid(playerId, n) : store.setTricks(playerId, n)),
      })
    )
  );

  return card;
}

function bidStatus(game, round) {
  const state = M.bidState(game, round);
  // `n` drives the plural: every descending staircase ends on a one-card
  // round, so without it this reads "for 1 tricks" in every game.
  const sum = t('play.bids.sum', {
    sum: formatNumber(state.sum),
    cards: formatNumber(round.cards),
    n: round.cards,
  });

  if (state.missing > 0) {
    return status('info', 'info', sum, t('common.joiner'), t('play.bids.missing', { n: state.missing }));
  }
  if (state.violates) {
    // Name whoever the rule actually binds, which is not the dealer when the
    // dealer is sitting the round out.
    const bound = M.playerById(game, state.constrainedId);
    return status(
      'bad',
      'alert',
      sum,
      t('common.joiner'),
      t('play.bids.banned', { cards: formatNumber(round.cards), name: bound ? bound.name : '' })
    );
  }
  if (state.diff > 0) return status('ok', 'check', sum, t('common.joiner'), t('play.bids.over', { n: state.diff }));
  if (state.diff < 0) return status('ok', 'check', sum, t('common.joiner'), t('play.bids.under', { n: -state.diff }));
  return status('ok', 'check', sum, t('common.joiner'), t('play.bids.exact'));
}

function trickStatus(game, round) {
  // A player can reach this phase with no bid — deal someone back in after
  // they sat out, or add a latecomer mid-round. Their entry would then score
  // as if they had bid zero, which is not what anyone agreed to, so say so
  // and send the user back rather than recording a fiction.
  const bids = M.bidState(game, round);
  if (!bids.complete) return status('bad', 'alert', t('play.bids.missing', { n: bids.missing }));

  const state = M.trickState(game, round);
  if (state.diff > 0) return status('bad', 'alert', t('play.tricks.over', { n: state.diff }));
  if (state.remaining > 0) return status('warn', 'info', t('play.tricks.remaining', { n: state.remaining }));
  if (state.missing > 0) return status('warn', 'info', t('play.tricks.missing', { n: state.missing }));
  return status('ok', 'check', t('play.tricks.exact', { n: round.cards }));
}

/**
 * The two phases, and the way back.
 *
 * Once the bids are locked, step 1 becomes the control that reopens them. It
 * used to be a second button in the dock, which made the dock tall enough to
 * bury the last player's chips on a five-handed game — and a step you have
 * completed is where anyone looks for the way back to it anyway.
 */
function phaseBar(phase) {
  const isBidding = phase === M.PHASE.BIDDING;

  const bids = isBidding
    ? el(
        'div',
        { class: 'phase', 'aria-current': 'step' },
        el('span', { class: 'phase__num', text: '1' }),
        el('span', { text: t('play.phase.bids') })
      )
    : el(
        'button',
        {
          type: 'button',
          class: 'phase is-complete',
          title: t('play.tricks.back'),
          'aria-label': t('play.tricks.back'),
          dataset: { fk: 'phase:bids' },
          onClick: () => store.backToBids(),
        },
        el('span', { class: 'phase__num' }, icon('check', { weight: 3 })),
        el('span', { text: t('play.phase.bids') })
      );

  return el(
    'div',
    { class: 'phases', role: 'group', 'aria-label': t('play.step', { n: isBidding ? 1 : 2 }) },
    bids,
    el(
      'div',
      { class: 'phase', 'aria-current': isBidding ? null : 'step' },
      el('span', { class: 'phase__num', text: '2' }),
      el('span', { text: t('play.phase.tricks') })
    )
  );
}

/**
 * Everything true about the round in one panel: the hand size, which round of
 * how many, who deals and who opens, the whole staircase with this step
 * marked, and which of the two phases is in progress.
 */
function roundHeader(game, round, roundIndex, phase) {
  const dealer = M.playerById(game, round.dealerId);
  const lead = M.playerById(game, M.leadOf(game, round));

  const sub = el('p', { class: 'roundhead__sub' });
  if (dealer) {
    sub.appendChild(
      el('span', { title: t('common.dealer') }, icon('deal'), ' ', el('b', { text: dealer.name }))
    );
  }
  if (lead && (!dealer || lead.id !== dealer.id)) {
    sub.appendChild(el('span', { title: t('common.opens') }, icon('arrowRight'), ' ', el('b', { text: lead.name })));
  }

  return el(
    'section',
    { class: 'panel roundhead' },
    el(
      'div',
      { class: 'roundhead__top' },
      el(
        'div',
        { class: 'cardcount' },
        el('span', { class: 'cardcount__label', text: t('play.cards') }),
        el('span', { class: 'cardcount__n', text: formatNumber(round.cards) })
      ),
      el(
        'div',
        { class: 'roundhead__text' },
        el(
          'h1',
          { class: 'roundhead__title', tabindex: '-1' },
          el('span', { text: `${t('common.round')} ` }),
          el('em', { text: formatNumber(roundIndex + 1) }),
          el('span', { class: 'muted', text: ` / ${formatNumber(game.rounds.length)}` })
        ),
        sub
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'iconbtn',
          'aria-label': t('stairs.detail.title', { n: roundIndex + 1 }),
          title: t('stairs.detail.title', { n: roundIndex + 1 }),
          dataset: { fk: 'roundtune' },
          onClick: () => openRoundSheet(roundIndex),
        },
        icon('tune')
      )
    ),
    staircase(game, roundIndex, { mini: true }),
    phaseBar(phase)
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
        { class: 'panel__pad center' },
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
    el(
      'div',
      { class: 'dock dock--static' },
      el('button', {
        type: 'button',
        class: 'btn btn--primary btn--block',
        text: t('play.complete.board'),
        onClick: () => store.setView('board'),
      }),
      el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--block',
        text: t('play.complete.addRound'),
        onClick: () => {
          const last = game.rounds[game.rounds.length - 1];
          store.appendRound(last ? last.cards : 1);
          toast(t('stairs.added'));
        },
      })
    )
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
  const running = M.scoresAfter(game, roundIndex);
  const order = M.bidOrder(game, round);

  const root = el('div', null);

  if (store.isCorrecting()) {
    root.appendChild(status('warn', 'pencil', t('play.editing', { n: roundIndex + 1 })));
  }

  root.appendChild(roundHeader(game, round, roundIndex, phase));
  root.appendChild(phase === M.PHASE.BIDDING ? bidStatus(game, round) : trickStatus(game, round));

  /* ---- players, in bidding order, as rows of one ledger ---- */
  const field = phase === M.PHASE.BIDDING ? 'bid' : 'tricks';
  const nextUp = order.find((id) => !round.entries[id].out && round.entries[id][field] === null);

  const list = el('section', { class: 'panel ledger ledger--heads' });
  for (const playerId of order) {
    list.appendChild(
      entryRow({
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
    // Both halves of the round must be complete, not just the tricks.
    const canRecord = state.ok && M.bidState(game, round).complete;
    dock.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary btn--block',
          disabled: !canRecord,
          onClick: () => {
            const index = store.recordRound();
            if (index !== null) toast(t('play.recorded', { n: index + 1 }));
          },
        },
        icon('check'),
        el('span', { text: t('play.record') })
      )
    );
  }

  root.appendChild(dock);
  return root;
}
