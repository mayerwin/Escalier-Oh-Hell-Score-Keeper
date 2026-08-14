/**
 * The staircase: the round plan, drawn as an actual flight of stairs and
 * editable at any point in the game.
 *
 * The drawing at the top is the shape of the whole game at a glance — filled
 * steps are played, the outlined one is in play, hatched ones are skipped —
 * and it now fits the width instead of scrolling away past the sixth round.
 * The list below is the same data in editable form, one row per round on a
 * shared grid, one tap from the round sheet.
 */

import { el, icon } from './../dom.js';
import { formatNumber, t } from './../i18n.js';
import { confirmSheet, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { emptyState, heading, hint, panel, row, seg, staircase, stepper } from './../ui.js';
import { openRoundSheet } from './roundsheet.js';

/**
 * Card count for the "add a round at the end" control. Session-local, and
 * re-seeded per game so switching games does not carry a stale number over.
 */
let appendState = { gameId: null, cards: 1 };

function planRow(game, round, index, currentIndex) {
  const dealer = M.playerById(game, round.dealerId);
  const lead = M.playerById(game, M.leadOf(game, round));
  const isCurrent = index === currentIndex;
  const isSkipped = round.phase === M.PHASE.SKIPPED;

  // Only the two states that need words get them. A played round already
  // reads as played from its filled card, and "to come" is what every row
  // without a marking is — spelling both out was costing the dealer's name
  // half its width on a 320px screen.
  const statusKey = isSkipped ? 'stairs.status.skipped' : isCurrent ? 'stairs.status.current' : null;

  // Who deals and who opens, as the same two glyphs the round view badges
  // them with. Spelling both labels out cost more width than the names
  // themselves and truncated the answer on a 320px screen.
  const meta = el('span', { class: 'plan__meta' });
  if (!isSkipped) {
    if (dealer) {
      meta.appendChild(
        el(
          'span',
          { class: 'plan__who', title: t('common.dealer') },
          icon('deal'),
          el('b', { class: 'plan__dealer', text: dealer.name })
        )
      );
    }
    if (lead && lead.id !== round.dealerId) {
      meta.appendChild(
        el('span', { class: 'plan__who', title: t('common.opens') }, icon('arrowRight'), el('b', { text: lead.name }))
      );
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
        isSkipped ? 'is-skipped' : null,
      ],
      // The state is carried visually; say it out loud for anyone who cannot
      // see the filled card or the brass rail.
      'aria-label': `${t('a11y.openRound', { n: index + 1 })}${t('common.joiner')}${t(
        round.phase === M.PHASE.DONE
          ? 'stairs.status.done'
          : isSkipped
            ? 'stairs.status.skipped'
            : isCurrent
              ? 'stairs.status.current'
              : 'stairs.status.pending'
      )}`,
      dataset: { fk: `plan:${index}` },
      onClick: () => openRoundSheet(index),
    },
    el('span', { class: 'plan__idx', text: t('stairs.step', { n: index + 1 }) }),
    el('span', { class: 'plan__cards', text: formatNumber(round.cards) }),
    meta,
    statusKey ? el('span', { class: 'plan__status', text: t(statusKey) }) : el('span'),
    icon('chevronRight', { class: 'plan__go' })
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
        block: true,
        label: t('setup.stairs.shape'),
        value: spec.shape,
        onChange: (v) => store.setPlanSpec('shape', v),
        options: [
          { value: 'down', label: t('setup.stairs.shape.down') },
          { value: 'up', label: t('setup.stairs.shape.up') },
          { value: 'updown', label: t('setup.stairs.shape.updown') },
          { value: 'downup', label: t('setup.stairs.shape.downup') },
        ],
      }),
      { stack: true }
    ),
    row(
      t('setup.stairs.parity'),
      null,
      seg({
        block: true,
        label: t('setup.stairs.parity'),
        value: spec.parity,
        onChange: (v) => store.setPlanSpec('parity', v),
        options: [
          { value: 'all', label: t('setup.stairs.parity.all') },
          { value: 'odd', label: t('setup.stairs.parity.odd') },
          { value: 'even', label: t('setup.stairs.parity.even') },
        ],
      }),
      { stack: true }
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
  const played = game.rounds.filter((r) => r.phase !== M.PHASE.SKIPPED);
  const totalCards = played.reduce((sum, r) => sum + r.cards * game.players.length, 0);

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
        staircase(game, currentIndex),
        el(
          'div',
          { class: 'panel__foot' },
          el('span', { text: t('stairs.total', { n: played.length, cards: totalCards }) }),
          // The two glyphs the plan below uses in place of two words.
          el(
            'span',
            { class: 'legendline' },
            el('span', { title: t('common.dealer') }, icon('deal'), el('span', { text: t('common.dealer') })),
            el('span', { title: t('common.opens') }, icon('arrowRight'), el('span', { text: t('common.opens') }))
          )
        )
      )
    );

    const list = el('section', { class: 'panel ledger' });
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
      ),
      el(
        'div',
        { class: 'panel__pad' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--dashed',
            onClick: () => {
              store.appendRound(appendCards);
              toast(t('stairs.added'));
            },
          },
          icon('plus'),
          el('span', { text: t('stairs.append') })
        )
      )
    )
  );

  /* ---- rebuild ---- */
  root.appendChild(heading(t('stairs.rebuild')));
  root.appendChild(rebuildPanel(game));

  return root;
}
