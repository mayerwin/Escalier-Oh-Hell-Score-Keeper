/**
 * Reusable pieces of chrome shared by the views: panels, settings rows,
 * steppers, segmented controls, status banners, player pickers.
 *
 * Everything visual lives in a class in styles/app.css. Nothing in here — or
 * in any view — sets an inline `style`, except where the value is genuinely
 * data rather than design: a player's colour, and the height of one step of
 * the staircase. Those two go through a custom property so the stylesheet
 * still owns how they are drawn.
 */

import { el, icon } from './dom.js';
import { formatNumber, t } from './i18n.js';
import { PHASE } from './model.js';

export function panel(...children) {
  return el('section', { class: 'panel' }, ...children);
}

export function pad(...children) {
  return el('div', { class: 'panel__pad' }, ...children);
}

/**
 * `large` marks the screen's own title, which is rendered as the single `h1`
 * for that view — every other heading on the screen sits below it as an `h2`.
 * The `tabindex` lets the shell move focus here when the view changes, so a
 * keyboard or screen-reader user lands on the new screen rather than at the
 * top of the document.
 */
export function heading(text, large = false) {
  if (large) return el('h1', { class: 'h h--lg', tabindex: '-1', text });
  // A section heading carries a rule out to the edge of the shell, which
  // groups what follows without wrapping it in another box.
  return el('h2', { class: 'h h--ruled' }, el('span', { text }));
}

export function hint(text, center = false) {
  return el('p', { class: ['hint', center ? 'hint--center' : null], text });
}

export function emptyState(text) {
  return el('div', { class: 'empty' }, el('div', { class: 'empty__pip', text: '♠ ♥ ♦ ♣' }), el('p', { text }));
}

export function dot(color) {
  return el('span', { class: 'dot', style: { background: color } });
}

/**
 * The ledger's index column: a player's colour and their ordinal in one
 * token, exactly one --col-pip wide on every row of every list.
 *
 * The colour is a ring around a wash rather than a solid fill, so the numeral
 * inside keeps full ink contrast in both themes — a white numeral on ten
 * different palette colours could not have been held above 4.5:1.
 */
export function pip(color, label) {
  return el('span', {
    class: 'pip',
    style: color ? { '--pip-color': color } : null,
    text: typeof label === 'number' ? formatNumber(label) : String(label ?? ''),
  });
}

/**
 * A label/control row inside a panel.
 *
 * `stack` puts the control on its own full-width line below the label. Used
 * wherever the control is wider than a right-hand column can honestly offer —
 * a four-option segmented picker at 320px — so the wrap is a decision rather
 * than an accident of flex.
 */
export function row(label, subtitle, control, { stack = false } = {}) {
  return el(
    'div',
    { class: ['row', stack ? 'row--stack' : null] },
    el('div', { class: 'row__label' }, el('span', { text: label }), subtitle ? el('small', { text: subtitle }) : null),
    control ? el('div', { class: 'row__control' }, control) : null
  );
}

/**
 * Numeric stepper. `format` lets a caller render a sentinel value as a word
 * (used by the dealer rule, where 0 means "off").
 */
export function stepper({ value, min, max, onChange, format, label }) {
  const display = format ? format(value) : formatNumber(value);
  // `data-fk` lets the shell put focus back on this exact button after the
  // re-render its own click triggers.
  return el(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': label || undefined },
    el('button', {
      type: 'button',
      'aria-label': label ? `${label} −` : '−',
      dataset: { fk: `step:${label}:-` },
      disabled: value <= min,
      onClick: () => onChange(Math.max(min, value - 1)),
      text: '−',
    }),
    el('span', { class: 'stepper__value', 'aria-live': 'polite', text: display }),
    el('button', {
      type: 'button',
      'aria-label': label ? `${label} +` : '+',
      dataset: { fk: `step:${label}:+` },
      disabled: value >= max,
      onClick: () => onChange(Math.min(max, value + 1)),
      text: '+',
    })
  );
}

export function stepperRow({ label, subtitle, value, min, max, onChange, format }) {
  return row(label, subtitle, stepper({ value, min, max, onChange, format, label }));
}

/** Segmented control. `options` is `[{value, label}]`. */
export function seg({ options, value, onChange, block = false, label }) {
  return el(
    'div',
    { class: ['seg', block ? 'seg--block' : null], role: 'group', 'aria-label': label || undefined },
    ...options.map((option) =>
      el('button', {
        type: 'button',
        text: option.label,
        'aria-pressed': String(option.value === value),
        dataset: { fk: `seg:${label}:${option.value}` },
        onClick: () => onChange(option.value),
      })
    )
  );
}

export function segRow({ label, subtitle, options, value, onChange, stack = false }) {
  return row(label, subtitle, seg({ options, value, onChange, label, block: stack }), { stack });
}

/** Checkbox styled as a brass tick. */
export function check({ label, checked, onChange, id, disabled = false }) {
  const input = el('input', {
    type: 'checkbox',
    checked,
    id,
    disabled,
    onChange: (event) => onChange(event.target.checked),
  });
  return el(
    'label',
    { class: ['check', disabled ? 'is-disabled' : null] },
    input,
    el('span', { class: 'check__box' }, icon('check', { weight: 3 })),
    el('span', { class: 'check__label', text: label })
  );
}

export function checkRow({ label, subtitle, checked, onChange, disabled = false }) {
  return el(
    'div',
    { class: 'row' },
    el(
      'div',
      { class: 'row__label' },
      check({ label, checked, onChange, disabled }),
      subtitle ? el('small', { class: 'is-indented', text: subtitle }) : null
    )
  );
}

/** Status banner. `kind` is one of ok | warn | bad | info. */
export function status(kind, iconName, ...children) {
  return el(
    'div',
    { class: `status status--${kind}`, role: kind === 'bad' ? 'alert' : 'status' },
    icon(iconName, { class: 'status__icon' }),
    el('span', null, ...children)
  );
}

/** Bold, tabular-numeral fragment for use inside status text. */
export function num(value) {
  return el('b', { text: typeof value === 'number' ? formatNumber(value) : String(value) });
}

/** Horizontal list of players to choose from. */
export function playerPicker({ players, selectedId, onPick, labelFor }) {
  return el(
    'div',
    { class: 'picker' },
    ...players.map((player) =>
      el(
        'button',
        {
          type: 'button',
          'aria-pressed': String(player.id === selectedId),
          'aria-label': labelFor ? labelFor(player) : undefined,
          onClick: () => onPick(player.id),
        },
        dot(player.color),
        el('span', { text: player.name })
      )
    )
  );
}

/** Points, coloured by sign. */
export function points(value) {
  const kind = value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero';
  const text = value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
  return el('span', { class: `pts pts--${kind}`, text });
}

export function badge(kind, iconName, text, title) {
  return el(
    'span',
    { class: `badge badge--${kind}`, title: title || text },
    iconName ? icon(iconName) : null,
    el('span', { text })
  );
}

/* ------------------------------------------------------------- staircase */

function stepClass(round, isCurrent) {
  if (round.phase === PHASE.SKIPPED) return 'is-skipped';
  if (round.phase === PHASE.DONE) return 'is-done';
  return isCurrent ? 'is-current' : 'is-pending';
}

/**
 * The staircase: the whole round plan drawn as a flight of stairs.
 *
 * Every round is one step and the steps share the width, so the shape of the
 * game is visible in one glance instead of scrolling off past the sixth round.
 * The treads meet their neighbours' risers, which is what makes it read as a
 * staircase rather than a bar chart, and the card counts sit below the floor
 * on one shared baseline — floating them at the top of each bar was what made
 * the old strip look ragged.
 *
 * It is a drawing, not a control: at fifteen rounds on a 320px screen a step
 * is 20px wide, which is not a tap target. Every round is editable from the
 * list underneath, at full size.
 */
export function staircase(game, currentIndex, { mini = false } = {}) {
  const rounds = game.rounds;
  const tallest = rounds.reduce((max, r) => Math.max(max, r.cards), 1);
  const cards = rounds.filter((r) => r.phase !== PHASE.SKIPPED).reduce((sum, r) => sum + r.cards * game.players.length, 0);

  const strip = el('div', {
    class: [
      'stairs',
      mini ? 'stairs--mini' : null,
      // Past about twenty steps the labels stop being legible and start being
      // noise; the silhouette carries the shape on its own.
      rounds.length > 20 ? 'stairs--dense' : null,
    ],
    role: 'img',
    'aria-label': `${t('stairs.title')}${t('common.joiner')}${t('stairs.total', {
      n: rounds.filter((r) => r.phase !== PHASE.SKIPPED).length,
      cards,
    })}`,
  });

  rounds.forEach((round, index) => {
    strip.appendChild(
      el(
        'div',
        {
          class: ['stairs__step', stepClass(round, index === currentIndex)],
          // Data, not design: the stylesheet still owns how a step is drawn.
          style: { '--h': `${Math.round((round.cards / tallest) * 100)}%` },
        },
        el('span', { class: 'stairs__bar' }),
        el('span', { class: 'stairs__n', text: formatNumber(round.cards) })
      )
    );
  });

  return strip;
}
