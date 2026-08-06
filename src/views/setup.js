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
import { check, heading, hint, panel, points, row, seg, stepper } from './../ui.js';

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
    /** Seat that deals the first hand. */
    dealerSeat: 0,
    /** When true the tick column designates the opener rather than the dealer. */
    pickOpener: false,
  };
}

function ensureDraft() {
  if (!draft) draft = newDraft();
  return draft;
}

function openerSeat(d) {
  return (d.dealerSeat + 1) % d.players.length;
}

function seatLabel(d, index) {
  return d.players[index].name.trim() || t('setup.players.placeholder', { n: index + 1 });
}

function playersPanel(d) {
  const box = panel();

  d.players.forEach((player, index) => {
    const designated = d.pickOpener ? openerSeat(d) === index : d.dealerSeat === index;

    box.appendChild(
      el(
        'div',
        { class: 'seat' },
        el('span', { class: 'seat__n', text: formatNumber(index + 1) }),
        el('span', { class: 'dot', style: { background: player.color } }),
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
              d.dealerSeat = d.pickOpener ? (index - 1 + d.players.length) % d.players.length : index;
              store.render();
            },
          },
          icon(d.pickOpener ? 'arrowRight' : 'deal')
        ),
        el(
          'span',
          { class: 'seat__moves' },
          el(
            'button',
            {
              type: 'button',
              'aria-label': t('common.moveUp'),
              disabled: index === 0,
              onClick: () => {
                const [moved] = d.players.splice(index, 1);
                d.players.splice(index - 1, 0, moved);
                store.render();
              },
            },
            icon('chevronUp')
          ),
          el(
            'button',
            {
              type: 'button',
              'aria-label': t('common.moveDown'),
              disabled: index === d.players.length - 1,
              onClick: () => {
                const [moved] = d.players.splice(index, 1);
                d.players.splice(index + 1, 0, moved);
                store.render();
              },
            },
            icon('chevronDown')
          )
        ),
        d.players.length > M.MIN_PLAYERS
          ? el(
              'button',
              {
                type: 'button',
                class: 'seat__remove',
                'aria-label': `${t('common.remove')} — ${seatLabel(d, index)}`,
                onClick: () => {
                  d.players.splice(index, 1);
                  if (d.dealerSeat >= d.players.length) d.dealerSeat = 0;
                  store.render();
                },
              },
              icon('trash')
            )
          : null
      )
    );
  });

  return box;
}

function dealPanel(d) {
  const dealer = seatLabel(d, d.dealerSeat);
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
        { class: 'hint', style: { 'margin-top': '0.5rem', 'margin-bottom': '0' } },
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
      })
    ),
    row(
      t('setup.stairs.parity'),
      null,
      seg({
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
      })
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
        el('small', { text: t('setup.scoring.strict.hint'), style: { 'margin-inline-start': '2.125rem' } })
      )
    ),
    el(
      'div',
      { class: 'panel__pad' },
      el(
        'div',
        { class: 'preview', style: { 'margin-top': '0', 'border-top': 'none', 'padding-top': '0' } },
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
    class: 'input input--right',
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
    panel(row(t('setup.name.label'), null, el('span', { class: 'field', style: { flex: '0 0 11rem' } }, nameInput))),

    heading(t('setup.players.title')),
    hint(t('setup.players.hint')),
    playersPanel(d),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--dashed',
        style: { 'margin-top': '0.625rem' },
        disabled: d.players.length >= M.MAX_PLAYERS,
        onClick: () => {
          d.players.push({ name: '', color: M.PALETTE[d.players.length % M.PALETTE.length] });
          store.render();
        },
      },
      icon('userPlus'),
      el('span', { text: t('setup.players.add') })
    ),

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
            const seat = Math.min(d.dealerSeat, game.players.length - 1);
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
        style: { 'margin-top': '0.25rem' },
        text: t('common.cancel'),
        onClick: () => {
          resetDraft();
          store.setView('games');
        },
      })
    )
  );

  return root;
}
