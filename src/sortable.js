/**
 * Drag-to-reorder for a vertical list.
 *
 * Pointer Events rather than HTML5 drag-and-drop, because the latter does not
 * exist on touch — and this app is used on a phone. One code path therefore
 * covers mouse, touch and pen.
 *
 * The rows are not re-rendered while a drag is in progress: re-rendering would
 * destroy the node holding the pointer capture and the drag would die mid-
 * gesture. Instead the rows are translated with a transform, the model is left
 * alone, and the move is committed once on release.
 *
 * The handle is a real button, so the same reorder is available from the
 * keyboard with the arrow keys, and each move is announced. Drag-and-drop that
 * is the *only* way to reorder is not accessible.
 */

const HANDLE = '[data-sort-handle]';
const ROW = '[data-sort-index]';

/**
 * @param {HTMLElement} container element whose children carry data-sort-index
 * @param {(from: number, to: number) => void} onMove commit a move
 * @param {(from: number, to: number) => string} describe announcement for a move
 */
export function sortable(container, { onMove, describe }) {
  const rows = [...container.querySelectorAll(ROW)];
  if (rows.length < 2) return;

  // Announcements go through a polite live region: a sighted user sees the row
  // move, everyone else needs telling.
  let live = container.querySelector('[data-sort-live]');
  if (!live) {
    live = document.createElement('p');
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('data-sort-live', '');
    container.appendChild(live);
  }

  // The row is named by where it came from — after the move it is no longer
  // the row sitting at the destination index.
  const announce = (from, to) => {
    if (describe) live.textContent = describe(from, to);
  };

  for (const row of rows) {
    const handle = row.querySelector(HANDLE);
    if (!handle) continue;

    /* ---------------- keyboard ---------------- */
    handle.addEventListener('keydown', (event) => {
      const from = Number(row.dataset.sortIndex);
      const to = event.key === 'ArrowUp' ? from - 1 : event.key === 'ArrowDown' ? from + 1 : null;
      if (to === null || to < 0 || to >= rows.length) return;
      event.preventDefault();
      announce(from, to);
      onMove(from, to);
    });

    /* ---------------- pointer ---------------- */
    handle.addEventListener('pointerdown', (event) => {
      // Ignore secondary buttons; let the browser handle them normally.
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      event.preventDefault();

      const from = Number(row.dataset.sortIndex);
      const startY = event.clientY;
      const geometry = rows.map((r) => {
        const box = r.getBoundingClientRect();
        return { top: box.top, height: box.height };
      });
      const step = geometry[0].height;
      let to = from;
      let dragging = false;

      const shift = (delta) => {
        for (const [i, r] of rows.entries()) {
          if (i === from) continue;
          // Rows between the origin and the target slide one place to fill the
          // gap the dragged row left behind.
          const moves = (i > from && i <= delta) || (i < from && i >= delta);
          const direction = i > from ? -1 : 1;
          r.style.transform = moves ? `translateY(${direction * step}px)` : '';
        }
      };

      const onPointerMove = (move) => {
        const dy = move.clientY - startY;
        if (!dragging && Math.abs(dy) < 4) return; // let a tap stay a tap
        if (!dragging) {
          dragging = true;
          container.classList.add('is-sorting');
          row.classList.add('is-dragging');
          handle.setPointerCapture(move.pointerId);
        }
        row.style.transform = `translateY(${dy}px)`;

        // Which slot is the row's centre now over?
        const centre = geometry[from].top + geometry[from].height / 2 + dy;
        let next = from;
        for (const [i, g] of geometry.entries()) {
          if (centre > g.top && centre < g.top + g.height) next = i;
        }
        if (next !== to) {
          to = next;
          shift(to);
        }
      };

      const finish = () => {
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        container.classList.remove('is-sorting');
        row.classList.remove('is-dragging');
        for (const r of rows) r.style.transform = '';
        if (!dragging || to === from) return;
        announce(from, to);
        onMove(from, to);
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
  }
}
