/**
 * Bottom sheets and dialogs, built on `<dialog>`.
 *
 * Everything destructive in this app funnels through `confirmSheet`, which is
 * what makes "you can change anything, but not by accident" work: structural
 * edits are reachable in two taps, but the second tap is always a deliberate
 * one on a sheet that names what is about to happen.
 */

import { el, clear, icon } from './dom.js';
import { t } from './i18n.js';

const supportsDialog = () => typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;

let openCount = 0;

/**
 * Open a bottom sheet. `build(api)` receives `{ close }` and returns the sheet
 * body. Resolves once the sheet has closed, with whatever `close(value)` got.
 */
export function openSheet(build, { onClose } = {}) {
  return new Promise((resolve) => {
    const dialog = el('dialog', { class: 'sheet' });
    let result;
    let settled = false;

    // Remember the opener ourselves. The browser restores focus natively on
    // close, but only if that element still exists — and most sheet actions
    // mutate state and re-render the view before closing, which destroys it.
    const opener = document.activeElement;
    const openerKey = opener && opener.dataset ? opener.dataset.fk : null;

    const restoreFocus = () => {
      if (opener && opener.isConnected && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
        return;
      }
      if (!openerKey) return;
      for (const candidate of document.querySelectorAll('[data-fk]')) {
        if (candidate.dataset.fk === openerKey && !candidate.disabled) {
          candidate.focus({ preventScroll: true });
          return;
        }
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.removeProperty('overflow');
      dialog.remove();
      restoreFocus();
      if (onClose) onClose(result);
      resolve(result);
    };

    const close = (value) => {
      result = value;
      if (dialog.open) dialog.close();
      else finish();
    };

    const panel = el('div', { class: 'sheet__panel' }, el('div', { class: 'sheet__grip' }));
    const body = build({ close });
    if (body) panel.appendChild(body);
    dialog.appendChild(panel);

    // Clicking the backdrop (i.e. outside the panel) dismisses.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close(undefined);
    });
    dialog.addEventListener('close', finish);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(undefined);
    });

    document.body.appendChild(dialog);
    openCount += 1;
    document.body.style.overflow = 'hidden';

    if (supportsDialog()) {
      dialog.showModal();
    } else {
      // Very old browsers: render inline rather than not at all.
      dialog.setAttribute('open', '');
    }

    const focusable = panel.querySelector('button, [href], input, select, textarea');
    if (focusable) focusable.focus({ preventScroll: true });
  });
}

/** Sheet header: title plus optional supporting line. */
export function sheetHeader(title, subtitle) {
  return el(
    'div',
    null,
    el('h2', { class: 'sheet__title', text: title }),
    subtitle ? el('p', { class: 'hint', text: subtitle }) : null
  );
}

/** A row of actions in a sheet. */
export function sheetAction({ label, iconName, danger = false, disabled = false, onClick }) {
  return el(
    'button',
    {
      type: 'button',
      class: ['sheet__action', danger ? 'is-danger' : null],
      disabled,
      onClick,
    },
    iconName ? icon(iconName) : null,
    el('span', { text: label })
  );
}

/**
 * Confirmation sheet. Resolves true only if the user taps the confirm button.
 * Falls back to window.confirm where `<dialog>` is unavailable.
 */
export function confirmSheet({ title, body, confirmLabel, cancelLabel, danger = true }) {
  if (!supportsDialog()) {
    return Promise.resolve(window.confirm(body ? `${title}\n\n${body}` : title));
  }
  return openSheet(({ close }) =>
    el(
      'div',
      null,
      sheetHeader(title, body),
      el(
        'div',
        { class: 'btnrow btnrow--spaced' },
        el('button', {
          type: 'button',
          class: 'btn btn--ghost',
          text: cancelLabel || t('common.cancel'),
          onClick: () => close(false),
        }),
        el('button', {
          type: 'button',
          class: ['btn', danger ? 'btn--ghost btn--danger' : 'btn--primary'],
          text: confirmLabel || t('common.ok'),
          onClick: () => close(true),
        })
      )
    )
  ).then((value) => value === true);
}

/** Single-line text prompt. Resolves to the trimmed string, or null. */
export function promptSheet({ title, body, value = '', placeholder = '', maxLength = 40, confirmLabel }) {
  if (!supportsDialog()) {
    const answer = window.prompt(title, value);
    return Promise.resolve(answer === null ? null : answer.trim());
  }
  return openSheet(({ close }) => {
    const input = el('input', {
      class: 'input',
      type: 'text',
      value,
      placeholder,
      maxlength: maxLength,
      enterkeyhint: 'done',
    });
    const submit = () => close(input.value.trim());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
    const form = el(
      'div',
      null,
      sheetHeader(title, body),
      input,
      el(
        'div',
        { class: 'btnrow' },
        el('button', { type: 'button', class: 'btn btn--ghost', text: t('common.cancel'), onClick: () => close(null) }),
        el('button', { type: 'button', class: 'btn btn--primary', text: confirmLabel || t('common.save'), onClick: submit })
      )
    );
    // Focus the field rather than the first button.
    setTimeout(() => {
      input.focus({ preventScroll: true });
      input.select();
    }, 30);
    return form;
  }).then((v) => (v === undefined ? null : v));
}

/* ------------------------------------------------------------------ toast */

let toastNode = null;
let toastTimer = 0;

export function toast(message) {
  if (!toastNode) {
    toastNode = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  }
  // A modal <dialog> paints in the top layer, which no z-index can reach, so a
  // toast raised while a sheet is open would be invisible behind it. Parent it
  // to the topmost dialog instead.
  const dialogs = document.querySelectorAll('dialog[open]');
  const host = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
  if (toastNode.parentNode !== host) host.appendChild(toastNode);

  clear(toastNode);
  toastNode.appendChild(document.createTextNode(message));
  toastNode.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('is-visible'), 2600);
}
