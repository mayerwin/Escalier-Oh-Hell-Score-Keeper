/**
 * Reusable pieces of chrome shared by the views: panels, settings rows,
 * steppers, segmented controls, status banners, player pickers.
 */

import { el, icon } from './dom.js';
import { formatNumber } from './i18n.js';

export function panel(...children) {
  return el('section', { class: 'panel' }, ...children);
}

export function pad(...children) {
  return el('div', { class: 'panel__pad' }, ...children);
}

export function heading(text, large = false) {
  return el('h2', { class: ['h', large ? 'h--lg' : null], text });
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

/** A label/control row inside a panel. */
export function row(label, subtitle, control) {
  return el(
    'div',
    { class: 'row' },
    el('div', { class: 'row__label' }, el('span', { text: label }), subtitle ? el('small', { text: subtitle }) : null),
    control
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

export function segRow({ label, subtitle, options, value, onChange }) {
  return row(label, subtitle, seg({ options, value, onChange, label }));
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
    { class: 'check', style: disabled ? { opacity: '0.55' } : null },
    input,
    el('span', { class: 'check__box' }, icon('check', { weight: 3 })),
    el('span', { class: 'check__label', text: label })
  );
}

export function checkRow({ label, subtitle, checked, onChange }) {
  return el(
    'div',
    { class: 'row' },
    el(
      'div',
      { class: 'row__label' },
      check({ label, checked, onChange }),
      subtitle ? el('small', { text: subtitle, style: { 'margin-inline-start': '2.125rem' } }) : null
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

export function badge(kind, iconName, text) {
  return el('span', { class: `badge badge--${kind}` }, iconName ? icon(iconName) : null, el('span', { text }));
}
