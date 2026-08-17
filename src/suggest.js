/**
 * Autocomplete for a text input, as an ARIA 1.2 combobox.
 *
 * The list lives in a single element parented to `<body>` rather than beside
 * the input. Panels in this app clip their contents to get rounded corners, and
 * a popup that renders inside one is a popup with its bottom half cut off; a
 * body-level layer also sidesteps every stacking-context surprise. The cost is
 * that it has to be positioned by hand and follow the page as it scrolls.
 *
 * Options are never focused. Focus stays in the input for the whole
 * interaction and the active option is pointed at with `aria-activedescendant`,
 * which is what lets a screen reader read the highlighted name while the
 * caret — and typing — stay where the user put them.
 */

import { el } from './dom.js';

const LIST_ID = 'suggest-listbox';

let popup = null;
let openFor = null; // the input currently owning the popup
let options = []; // [{ name, node }]
let active = -1;
let commit = null;

function ensurePopup() {
  if (popup) return popup;
  popup = el('ul', { class: 'suggest', id: LIST_ID, role: 'listbox', hidden: true });
  document.body.appendChild(popup);
  return popup;
}

function place() {
  if (!openFor || !popup) return;
  // The input can be torn out from under us by a re-render.
  if (!openFor.isConnected) return close();

  const box = openFor.getBoundingClientRect();
  const room = window.innerHeight - box.bottom;
  const height = popup.offsetHeight;
  // Flip above only when below genuinely does not fit and above does better.
  const above = room < height + 8 && box.top > room;

  popup.style.left = `${Math.round(box.left)}px`;
  popup.style.width = `${Math.round(box.width)}px`;
  popup.style.top = above ? `${Math.round(box.top - height - 4)}px` : `${Math.round(box.bottom + 4)}px`;
}

function setActive(index) {
  active = index;
  for (const [i, option] of options.entries()) {
    const on = i === index;
    option.node.setAttribute('aria-selected', on ? 'true' : 'false');
    option.node.classList.toggle('is-active', on);
    if (on) option.node.scrollIntoView({ block: 'nearest' });
  }
  if (openFor) {
    if (index < 0) openFor.removeAttribute('aria-activedescendant');
    else openFor.setAttribute('aria-activedescendant', options[index].node.id);
  }
}

export function close() {
  if (!popup) return;
  popup.hidden = true;
  while (popup.firstChild) popup.removeChild(popup.firstChild);
  if (openFor) {
    openFor.setAttribute('aria-expanded', 'false');
    openFor.removeAttribute('aria-activedescendant');
  }
  openFor = null;
  options = [];
  active = -1;
  commit = null;
}

function pick(index) {
  if (index < 0 || index >= options.length) return;
  const { name } = options[index];
  const done = commit;
  close();
  if (done) done(name);
}

function open(input, names, label, onPick) {
  const list = ensurePopup();
  while (list.firstChild) list.removeChild(list.firstChild);

  openFor = input;
  commit = onPick;
  options = names.map((name, i) => {
    const node = el('li', {
      class: 'suggest__option',
      id: `${LIST_ID}-${i}`,
      role: 'option',
      'aria-selected': false,
      text: name,
      // Acting on pointerdown, with the default prevented, keeps the caret in
      // the input: a plain click would blur it first and close the popup out
      // from under the tap.
      onPointerDown: (event) => {
        event.preventDefault();
        pick(i);
      },
    });
    list.appendChild(node);
    return { name, node };
  });

  list.setAttribute('aria-label', label);
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  setActive(-1);
  place();
}

/**
 * @param {HTMLInputElement} input
 * @param {() => string[]} source names to offer for the input's current value
 * @param {(name: string) => void} onPick
 * @param {string} label accessible name for the list
 */
export function autocomplete(input, { source, onPick, label }) {
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', LIST_ID);
  // The browser's own history dropdown would sit on top of this one.
  input.setAttribute('autocomplete', 'off');

  const refresh = () => {
    const names = source();
    if (!names.length) {
      if (openFor === input) close();
      return;
    }
    open(input, names, label, onPick);
  };

  input.addEventListener('input', refresh);

  // Focusing an empty seat offers the roster straight away — that is the whole
  // point of having one. A seat with a name in it stays quiet.
  input.addEventListener('focus', () => {
    if (input.value.trim()) return;
    refresh();
  });

  input.addEventListener('keydown', (event) => {
    const isOpen = openFor === input && options.length > 0;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) return refresh();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // Wraps through n+1 states, the extra one being "nothing selected", so
      // the text actually typed can always be got back to.
      const states = options.length + 1;
      setActive(((active + 1 + step + states) % states) - 1);
      return;
    }

    if (!isOpen) return;

    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      pick(active);
      return;
    }
    if (event.key === 'Escape') {
      // Only the popup closes. Escape also backs out of a stacked screen, and
      // dismissing a suggestion list should not do both at once.
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab') close();
  });

  input.addEventListener('blur', () => {
    if (openFor === input) close();
  });
}

// One set of listeners for the lifetime of the page: the popup has to track
// the input when the page moves under it, and give up when the user scrolls
// something else entirely.
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', place, { passive: true, capture: true });
  window.addEventListener('resize', place, { passive: true });
}
