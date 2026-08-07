/**
 * The staircase: the round plan, drawn as an actual flight of stairs and
 * editable at any point in the game.
 *
 * The strip at the top is the shape of the game at a glance — filled steps are
 * played, the outlined one is in play, hatched ones are skipped. The list below
 * is the same data in editable form, one tap from the round sheet.
 */

import { el, icon } from './../dom.js';
import { formatNumber, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { emptyState, heading, hint, panel, row, seg, stepper } from './../ui.js';
import { openRoundSheet } from './roundsheet.js';

/**
 * Card count for the "add a round at the end" control. Session-local, and
 * re-seeded per game so switching games does not carry a stale number over.
 */
let appendState = { gameId: null, cards: 1 };

const BAR_MIN = 10;
const BAR_RANGE = 58;

function stepClass(round, isCurrent) {
  if (round.phase === M.PHASE.SKIPPED) return 'is-skipped';
  if (round.phase === M.PHASE.DONE) return 'is-done';
  return isCurrent ? 'is-current' : 'is-pending';
}

function staircaseStrip(game, currentIndex) {
  const tallest = game.rounds.reduce((max, r) => Math.max(max, r.cards), 1);
  const strip = el('div', { class: 'stairs' });

  game.rounds.forEach((round, index) => {
    const height = BAR_MIN + (round.cards / tallest) * BAR_RANGE;
    strip.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: ['stairs__step', stepClass(round, index === currentIndex)],
          'aria-label': t('a11y.openRound', { n: index + 1 }),
          onClick: () => openRoundSheet(index),
        },
        el('span', { class: 'stairs__n', text: formatNumber(round.cards) }),
        el('span', { class: 'stairs__bar', style: { height: `${height.toFixed(1)}px` } })
      )
    );
  });

  return strip;
}

function planRow(game, round, index, currentIndex) {
  const dealer = M.playerById(game, round.dealerId);
  const lead = M.playerById(game, M.leadOf(game, round));
  const isCurrent = index === currentIndex;

  const statusKey =
    round.phase === M.PHASE.DONE
      ? 'stairs.status.done'
      : round.phase === M.PHASE.SKIPPED
        ? 'stairs.status.skipped'
        : isCurrent
          ? 'stairs.status.current'
          : 'stairs.status.pending';

  const meta = el('div', { class: 'plan__meta' });
  if (round.phase === M.PHASE.SKIPPED) {
    meta.appendChild(el('span', { text: t('stairs.status.skipped') }));
  } else {
    meta.appendChild(el('span', { text: `${t('common.dealer')}: ` }));
    meta.appendChild(el('b', { text: dealer ? dealer.name : '—' }));
    if (lead && lead.id !== round.dealerId) {
      meta.appendChild(el('span', { text: ` · ${t('common.opens')}: ` }));
      meta.appendChild(el('b', { text: lead.name }));
    }
  }

  return el(
    'button',
    {
      type: 'button',
      class: [
        'plan',
        isCurrent ? 'is-current' : null,
        round.phase === M.PHASE.DONE ? 'is-done' : null,
        round.phase === M.PHASE.SKIPPED ? 'is-skipped' : null,
      ],
      'aria-label': t('a11y.openRound', { n: index + 1 }),
      onClick: () => openRoundSheet(index),
    },
    el('span', { class: 'plan__idx', text: t('stairs.step', { n: index + 1 }) }),
    el('span', { class: 'plan__cards', text: formatNumber(round.cards) }),
    el('span', { class: 'plan__body' }, meta, el('span', { class: 'plan__status', text: t(statusKey) })),
    icon('chevronRight', { class: 'hist__go' })
  );
}

function rebuildPanel(game) {
  const spec = { ...M.defaultPlanSpec(), ...game.planSpec };
  const preview = M.buildPlan(spec);
  const unplayed = game.rounds.filter((r) => r.phase !== M.PHASE.DONE).length;
  const deckMax = M.maxCardsFor(game.players.length);

  return panel(
    row(
      t('setup.stairs.max'),
      spec.maxCards > deckMax ? t('setup.stairs.deckLimit', { players: game.players.length, max: deckMax }) : null,
      stepper({
        value: spec.maxCards,
        min: 1,
        max: M.MAX_CARDS,
        label: t('setup.stairs.max'),
        onChange: (v) => store.setPlanSpec('maxCards', v),
      })
    ),
    row(
      t('setup.stairs.min'),
      null,
      stepper({
        value: spec.minCards,
        min: 1,
        max: M.MAX_CARDS,
        label: t('setup.stairs.min'),
        onChange: (v) => store.setPlanSpec('minCards', v),
      })
    ),
    row(
      t('setup.stairs.shape'),
      null,
      seg({
        label: t('setup.stairs.shape'),
        value: spec.shape,
        onChange: (v) => store.setPlanSpec('shape', v),
        options: [
          { value: 'down', label: t('setup.stairs.shape.down') },
          { value: 'up', label: t('setup.stairs.shape.up') },
          { value: 'updown', label: t('setup.stairs.shape.updown') },
          { value: 'downup', label: t('setup.stairs.shape.downup') },
        ],
      })
    ),
    row(
      t('setup.stairs.parity'),
      null,
      seg({
        label: t('setup.stairs.parity'),
        value: spec.parity,
        onChange: (v) => store.setPlanSpec('parity', v),
        options: [
          { value: 'all', label: t('setup.stairs.parity.all') },
          { value: 'odd', label: t('setup.stairs.parity.odd') },
          { value: 'even', label: t('setup.stairs.parity.even') },
        ],
      })
    ),
    el(
      'div',
      { class: 'panel__pad' },
      hint(t('setup.stairs.preview', { n: preview.length, list: preview.slice(0, 12).join(' · ') + (preview.length > 12 ? ' …' : '') })),
      hint(t('stairs.rebuild.hint')),
      el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--block',
        disabled: preview.length === 0,
        text: t('stairs.rebuild'),
        onClick: async () => {
          const ok = await confirmSheet({
            title: t('stairs.rebuild.confirm', { n: unplayed }),
            body: t('stairs.rebuild.hint'),
            confirmLabel: t('stairs.rebuild'),
          });
          if (!ok) return;
          store.rebuildPlan(spec);
          toast(t('stairs.rebuilt'));
        },
      })
    )
  );
}

export function renderStairs() {
  const game = store.state.game;
  if (!game) return emptyState(t('play.noGame.body'));

  const currentIndex = M.currentRoundIndex(game);
  const totalCards = game.rounds
    .filter((r) => r.phase !== M.PHASE.SKIPPED)
    .reduce((sum, r) => sum + r.cards * game.players.length, 0);

  if (appendState.gameId !== game.id) {
    appendState = {
      gameId: game.id,
      cards: game.rounds.length ? game.rounds[game.rounds.length - 1].cards : 1,
    };
  }
  const appendCards = appendState.cards;

  const root = el('div', null, heading(t('stairs.title'), true), hint(t('stairs.hint')));

  if (game.rounds.length === 0) {
    root.appendChild(emptyState(t('board.history.empty')));
  } else {
    root.appendChild(
      panel(
        staircaseStrip(game, currentIndex),
        el('div', { class: 'stairs__floor' }),
        el(
          'div',
          { class: 'panel__pad', style: { 'padding-top': '0' } },
          hint(t('stairs.total', { n: game.rounds.filter((r) => r.phase !== M.PHASE.SKIPPED).length, cards: totalCards }))
        )
      )
    );

    const list = panel();
    game.rounds.forEach((round, index) => list.appendChild(planRow(game, round, index, currentIndex)));
    root.appendChild(list);
  }

  /* ---- append ---- */
  root.appendChild(heading(t('stairs.append')));
  root.appendChild(
    panel(
      row(
        t('stairs.appendCards'),
        appendCards > M.maxCardsFor(game.players.length)
          ? t('stairs.deckLimit', { players: game.players.length })
          : null,
        stepper({
          value: appendCards,
          min: 1,
          max: M.MAX_CARDS,
          label: t('stairs.appendCards'),
          onChange: (v) => {
            appendState.cards = v;
            store.render();
          },
        })
      )
    )
  );
  root.appendChild(
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--dashed',
        style: { 'margin-top': '0.625rem' },
        onClick: () => {
          store.appendRound(appendCards);
          toast(t('stairs.added'));
        },
      },
      icon('plus'),
      el('span', { text: t('stairs.append') })
    )
  );

  /* ---- rebuild ---- */
  root.appendChild(heading(t('stairs.rebuild')));
  root.appendChild(rebuildPanel(game));

  return root;
}
