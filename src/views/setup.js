/**
 * New-game setup.
 *
 * Seating, the deal, the shape of the staircase, the scoring, and the dealer's
 * constraint — all on one screen with live previews, because every one of them
 * is easier to judge against an example than against a label.
 */

import { el, icon } from './../dom.js';
import { formatDate, formatNumber, t } from './../i18n.js';
import { toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { sortable } from './../sortable.js';
import { check, heading, hint, panel, pip, points, row, seg, stepper } from './../ui.js';

const DEFAULT_SEATS = 4;

let draft = null;

export function resetDraft() {
  draft = null;
}

function newDraft() {
  return {
    name: '',
    players: Array.from({ length: DEFAULT_SEATS }, (_, i) => ({ name: '', color: M.PALETTE[i] })),
    cfg: M.defaultConfig(),
    planSpec: M.defaultPlanSpec(),
    /**
     * The player who deals the first hand, held by reference rather than by
     * seat number: reordering or removing a player must not silently hand the
     * deal to whoever ends up standing in that position.
     */
    dealer: null,
    /** When true the tick column designates the opener rather than the dealer. */
    pickOpener: false,
  };
}

function ensureDraft() {
  if (!draft) draft = newDraft();
  return draft;
}

/** Seat of the opening dealer, falling back to the first seat. */
function dealerIndex(d) {
  const i = d.players.indexOf(d.dealer);
  return i < 0 ? 0 : i;
}

function openerSeat(d) {
  return (dealerIndex(d) + 1) % d.players.length;
}

function seatLabel(d, index) {
  return d.players[index].name.trim() || t('setup.players.placeholder', { n: index + 1 });
}

function playersPanel(d) {
  const box = panel();

  // Name the pick column. It was an icon-only button whose meaning you had to
  // infer from the highlight, which is not a thing to make anyone guess.
  box.appendChild(
    el(
      'div',
      // Deliberately NOT `.seat`: that class is the row list, and adding a
      // header to it shifts every index-based selector by one. It carries the
      // same column template so each caption sits over its own column.
      { class: 'seathead', 'aria-hidden': 'true' },
      el('span'),
      el('span'),
      el('span'),
      el('span', {
        class: 'seat__collabel',
        text: d.pickOpener ? t('setup.deal.columnLead') : t('setup.deal.column'),
      }),
      el('span')
    )
  );

  d.players.forEach((player, index) => {
    const designated = d.pickOpener ? openerSeat(d) === index : dealerIndex(d) === index;

    box.appendChild(
      el(
        'div',
        { class: 'seat', dataset: { sortIndex: index } },
        // Drag to reorder, with the same move on the arrow keys — a gesture
        // that is the only way to do something is not an accessible one.
        el(
          'button',
          {
            type: 'button',
            class: 'seat__grip',
            'data-sort-handle': '',
            'aria-label': t('a11y.reorder', { name: seatLabel(d, index) }),
            title: t('a11y.reorder', { name: seatLabel(d, index) }),
          },
          icon('grip')
        ),
        pip(player.color, index + 1),
        el('input', {
          class: 'seat__input',
          type: 'text',
          maxlength: 24,
          value: player.name,
          placeholder: t('setup.players.placeholder', { n: index + 1 }),
          'aria-label': t('setup.players.placeholder', { n: index + 1 }),
          // No re-render on input: that would move the caret to the end.
          onInput: (event) => {
            d.players[index].name = event.target.value;
          },
        }),
        el(
          'button',
          {
            type: 'button',
            class: 'dealerpick',
            'aria-pressed': String(designated),
            'aria-label': d.pickOpener
              ? t('a11y.setLead', { name: seatLabel(d, index) })
              : t('a11y.setDealer', { name: seatLabel(d, index) }),
            onClick: () => {
              // Tapping the column designates whichever role the checkbox
              // selects; the other is derived from it.
              const seat = d.pickOpener ? (index - 1 + d.players.length) % d.players.length : index;
              d.dealer = d.players[seat];
              store.render();
            },
          },
          icon(d.pickOpener ? 'arrowRight' : 'deal')
        ),
        d.players.length > M.MIN_PLAYERS
          ? el(
              'button',
              {
                type: 'button',
                class: 'seat__remove',
                'aria-label': `${t('common.remove')}${t('common.joiner')}${seatLabel(d, index)}`,
                onClick: () => {
                  d.players.splice(index, 1);
                  // If the dealer themselves was removed, the deal falls back
                  // to the first seat; otherwise it stays with the same person.
                  if (!d.players.includes(d.dealer)) d.dealer = d.players[0];
                  store.render();
                },
              },
              icon('trash')
            )
          : null
      )
    );
  });

  sortable(box, {
    describe: (from, to) => t('a11y.moved', { name: seatLabel(d, from), n: to + 1, total: d.players.length }),
    onMove: (from, to) => {
      const [moved] = d.players.splice(from, 1);
      d.players.splice(to, 0, moved);
      store.render();
    },
  });

  // The action that grows the list belongs to the list, not to the gap below
  // it: inside the panel it reads as one more seat waiting to be filled.
  box.appendChild(
    el(
      'div',
      { class: 'panel__pad' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--dashed',
          disabled: d.players.length >= M.MAX_PLAYERS,
          onClick: () => {
            // Take the first unused colour, not the one at this index — after
            // a removal those differ, and two players would share a dot.
            const used = new Set(d.players.map((p) => p.color));
            const color = M.PALETTE.find((c) => !used.has(c)) || M.PALETTE[d.players.length % M.PALETTE.length];
            d.players.push({ name: '', color });
            store.render();
          },
        },
        icon('userPlus'),
        el('span', { text: t('setup.players.add') })
      )
    )
  );

  return box;
}

function dealPanel(d) {
  const dealer = seatLabel(d, dealerIndex(d));
  const opener = seatLabel(d, openerSeat(d));

  return panel(
    el(
      'div',
      { class: 'panel__pad' },
      hint(d.pickOpener ? t('setup.deal.leadPick') : t('setup.deal.hint')),
      check({
        label: t('setup.deal.leadFollows'),
        checked: d.pickOpener,
        onChange: (value) => {
          d.pickOpener = value;
          store.render();
        },
      }),
      el(
        'p',
        // A stable hook: the summary used to be found by searching for the
        // word "deals", which now also appears as a column caption.
        { class: 'hint dealsummary' },
        el('b', { text: dealer }),
        el('span', { text: ` ${t('play.dealsBadge')} · ` }),
        el('b', { text: opener }),
        el('span', { text: ` ${t('play.opensBadge')}` })
      )
    )
  );
}

function stairsPanel(d) {
  const deckMax = M.maxCardsFor(d.players.length);
  const preview = M.buildPlan(d.planSpec);

  return panel(
    row(
      t('setup.stairs.max'),
      d.planSpec.maxCards > deckMax ? t('setup.stairs.deckLimit', { players: d.players.length, max: deckMax }) : null,
      stepper({
        value: d.planSpec.maxCards,
        min: 1,
        max: M.MAX_CARDS,
        label: t('setup.stairs.max'),
        onChange: (v) => {
          d.planSpec.maxCards = v;
          store.render();
        },
      })
    ),
    row(
      t('setup.stairs.min'),
      null,
      stepper({
        value: d.planSpec.minCards,
        min: 1,
        max: M.MAX_CARDS,
        label: t('setup.stairs.min'),
        onChange: (v) => {
          d.planSpec.minCards = v;
          store.render();
        },
      })
    ),
    row(
      t('setup.stairs.shape'),
      null,
      seg({
        block: true,
        label: t('setup.stairs.shape'),
        value: d.planSpec.shape,
        onChange: (v) => {
          d.planSpec.shape = v;
          store.render();
        },
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
        value: d.planSpec.parity,
        onChange: (v) => {
          d.planSpec.parity = v;
          store.render();
        },
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
      hint(
        t('setup.stairs.preview', {
          n: preview.length,
          list: preview.slice(0, 12).join(' · ') + (preview.length > 12 ? ' …' : ''),
        })
      )
    )
  );
}

function scoringPanel(d) {
  // A worked example beats four abstract numbers.
  const example = M.calcPoints(3, 3, d.cfg);
  const missed = M.calcPoints(3, 1, d.cfg);

  return panel(
    row(
      t('setup.scoring.ptsBid'),
      t('setup.scoring.ptsBid.hint'),
      stepper({
        value: d.cfg.ptsBid,
        min: 0,
        max: 50,
        label: t('setup.scoring.ptsBid'),
        onChange: (v) => {
          d.cfg.ptsBid = v;
          store.render();
        },
      })
    ),
    row(
      t('setup.scoring.ptsTrick'),
      t('setup.scoring.ptsTrick.hint'),
      stepper({
        value: d.cfg.ptsTrick,
        min: 0,
        max: 50,
        label: t('setup.scoring.ptsTrick'),
        onChange: (v) => {
          d.cfg.ptsTrick = v;
          store.render();
        },
      })
    ),
    row(
      t('setup.scoring.ptsMiss'),
      t('setup.scoring.ptsMiss.hint'),
      stepper({
        value: d.cfg.ptsMiss,
        min: 0,
        max: 50,
        label: t('setup.scoring.ptsMiss'),
        onChange: (v) => {
          d.cfg.ptsMiss = v;
          store.render();
        },
      })
    ),
    el(
      'div',
      { class: 'row' },
      el(
        'div',
        { class: 'row__label' },
        check({
          label: t('setup.scoring.strict'),
          checked: d.cfg.strict,
          onChange: (value) => {
            d.cfg.strict = value;
            store.render();
          },
        }),
        el('small', { class: 'is-indented', text: t('setup.scoring.strict.hint') })
      )
    ),
    el(
      'div',
      { class: 'panel__pad' },
      el(
        'div',
        { class: 'preview' },
        el('span', { text: t('setup.scoring.example', { bid: 3, tricks: 3 }) }),
        points(example)
      ),
      el(
        'div',
        { class: 'preview' },
        el('span', { text: t('setup.scoring.example', { bid: 3, tricks: 1 }) }),
        points(missed)
      )
    )
  );
}

function rulePanel(d) {
  return panel(
    row(
      t('setup.rule.banFrom'),
      t('setup.rule.banFrom.hint'),
      stepper({
        value: d.cfg.banFrom,
        min: 0,
        max: M.MAX_CARDS,
        label: t('setup.rule.banFrom'),
        format: (v) => (v === 0 ? t('setup.rule.off') : `${formatNumber(v)}`),
        onChange: (v) => {
          d.cfg.banFrom = v;
          store.render();
        },
      })
    ),
    el('div', { class: 'panel__pad' }, hint(t('setup.rule.explain')))
  );
}

export function renderSetup() {
  const d = ensureDraft();

  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    maxlength: 40,
    value: d.name,
    placeholder: t('setup.name.placeholder'),
    'aria-label': t('setup.name.label'),
    onInput: (event) => {
      d.name = event.target.value;
    },
  });

  const root = el(
    'div',
    null,
    heading(t('setup.title'), true),
    panel(row(t('setup.name.label'), null, nameInput, { stack: true })),

    heading(t('setup.players.title')),
    hint(t('setup.players.hint')),
    playersPanel(d),

    heading(t('setup.deal.title')),
    dealPanel(d),

    heading(t('setup.stairs.title')),
    stairsPanel(d),

    heading(t('setup.scoring.title')),
    scoringPanel(d),

    heading(t('setup.rule.title')),
    rulePanel(d)
  );

  const plan = M.buildPlan(d.planSpec);

  root.appendChild(
    el(
      'div',
      { class: 'dock dock--static' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary btn--block',
          disabled: plan.length === 0,
          onClick: () => {
            const players = d.players.map((p, i) => ({
              name: p.name.trim() || t('setup.players.placeholder', { n: i + 1 }),
              color: p.color,
            }));
            const game = M.createGame({
              name: d.name.trim() || t('setup.name.auto', { date: formatDate(Date.now()) }),
              players,
              cfg: d.cfg,
              plan,
            });
            game.planSpec = { ...d.planSpec };
            // createGame assigned ids; point the first deal at the chosen seat.
            const seat = Math.min(dealerIndex(d), game.players.length - 1);
            game.firstDealerId = game.players[seat].id;
            M.normalizeDealers(game);

            store.adoptGame(game);
            resetDraft();
            store.setView('play');
            toast(t('setup.start'));
          },
        },
        el('span', { text: t('setup.start') }),
        icon('arrowRight')
      ),
      el('button', {
        type: 'button',
        class: 'btn btn--quiet btn--block',
        text: t('common.cancel'),
        onClick: () => {
          resetDraft();
          store.goBack();
        },
      })
    )
  );

  return root;
}
