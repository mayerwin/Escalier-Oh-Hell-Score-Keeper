/**
 * DOM helpers.
 *
 * The whole UI is built with `el()` and text nodes — there is no innerHTML
 * anywhere in this app. Player names, game names and imported payloads are all
 * untrusted strings, and building nodes directly makes it structurally
 * impossible for any of them to become markup.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProp(node, key, value) {
  if (value === null || value === undefined || value === false) return;

  if (key === 'class' || key === 'className') {
    node.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value));
    return;
  }
  if (key === 'text') {
    node.textContent = String(value);
    return;
  }
  if (key === 'dataset') {
    for (const [k, v] of Object.entries(value)) {
      if (v !== null && v !== undefined) node.dataset[k] = String(v);
    }
    return;
  }
  if (key === 'style' && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (v !== null && v !== undefined) node.style.setProperty(k, String(v));
    }
    return;
  }
  if (key.startsWith('on') && typeof value === 'function') {
    node.addEventListener(key.slice(2).toLowerCase(), value);
    return;
  }
  // Properties that must not go through setAttribute to behave correctly.
  if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') {
    node[key] = value;
    if (key === 'disabled' && value) node.setAttribute('disabled', '');
    return;
  }
  node.setAttribute(key, value === true ? '' : String(value));
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

/** Create an HTML element. `el('div', {class: 'x'}, 'text', childNode)` */
export function el(tag, props = null, ...children) {
  const node = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) applyProp(node, k, v);
  appendChildren(node, children);
  return node;
}

/** Same, in the SVG namespace. */
export function svg(tag, props = null, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, String(v));
    }
  }
  appendChildren(node, children);
  return node;
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function replace(node, ...children) {
  clear(node);
  appendChildren(node, children);
  return node;
}

/* ------------------------------------------------------------------ icons */

/**
 * A small in-house icon set on a 24x24 grid. Stroked, `currentColor`, and
 * deliberately geometric so they hold up at 14px on a dim phone screen.
 * `f` marks a filled path.
 */
const ICONS = {
  cards: [['rect', { x: 8.5, y: 3, width: 11, height: 15, rx: 2 }], ['path', { d: 'M5 7v11a3 3 0 0 0 3 3h7.5' }]],
  stairs: [['path', { d: 'M3 20h4v-4h4v-4h4V8h4V4' }]],
  podium: [
    ['path', { d: 'M3 20.5h18' }],
    ['path', { d: 'M6.5 20.5V12' }],
    ['path', { d: 'M12 20.5V4' }],
    ['path', { d: 'M17.5 20.5V15' }],
  ],
  curve: [['path', { d: 'M3 19.5 9 12l4 3 8-9.5' }], ['circle', { cx: 21, cy: 5.5, r: 1.6, f: 1 }]],
  dots: [
    ['circle', { cx: 12, cy: 5, r: 1.7, f: 1 }],
    ['circle', { cx: 12, cy: 12, r: 1.7, f: 1 }],
    ['circle', { cx: 12, cy: 19, r: 1.7, f: 1 }],
  ],
  lock: [['rect', { x: 4.5, y: 10.5, width: 15, height: 9.5, rx: 2.2 }], ['path', { d: 'M8 10.5V7.2a4 4 0 0 1 8 0v3.3' }]],
  unlock: [['rect', { x: 4.5, y: 10.5, width: 15, height: 9.5, rx: 2.2 }], ['path', { d: 'M8 10.5V7.2a4 4 0 0 1 7.6-1.7' }]],
  check: [['path', { d: 'M4.5 12.5 9.5 17.5 19.5 6.5' }]],
  close: [['path', { d: 'M6 6 18 18M18 6 6 18' }]],
  chevronRight: [['path', { d: 'M9.5 5 16.5 12 9.5 19' }]],
  chevronUp: [['path', { d: 'M5 15.5 12 8.5 19 15.5' }]],
  chevronDown: [['path', { d: 'M5 8.5 12 15.5 19 8.5' }]],
  arrowRight: [['path', { d: 'M4 12h15' }], ['path', { d: 'M13 6l6 6-6 6' }]],
  arrowLeft: [['path', { d: 'M20 12H5' }], ['path', { d: 'M11 6l-6 6 6 6' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  trash: [['path', { d: 'M4 7h16' }], ['path', { d: 'M9.5 7V4.8h5V7' }], ['path', { d: 'M6.5 7l1 13h9l1-13' }]],
  share: [
    ['circle', { cx: 17.5, cy: 5.5, r: 2.6 }],
    ['circle', { cx: 6.5, cy: 12, r: 2.6 }],
    ['circle', { cx: 17.5, cy: 18.5, r: 2.6 }],
    ['path', { d: 'M8.9 10.7 15.1 6.8M8.9 13.3 15.1 17.2' }],
  ],
  download: [['path', { d: 'M12 3.5v11.5' }], ['path', { d: 'M7.5 10.5 12 15l4.5-4.5' }], ['path', { d: 'M4 20h16' }]],
  tune: [
    ['path', { d: 'M6 20.5V14M6 10V3.5M18 20.5V13M18 9V3.5' }],
    ['circle', { cx: 6, cy: 12, r: 2 }],
    ['circle', { cx: 18, cy: 11, r: 2 }],
  ],
  globe: [
    ['circle', { cx: 12, cy: 12, r: 8.75 }],
    ['path', { d: 'M3.4 12h17.2' }],
    ['path', { d: 'M12 3.25c2.9 3.6 2.9 14 0 17.5M12 3.25c-2.9 3.6-2.9 14 0 17.5' }],
  ],
  crown: [['path', { d: 'M4 18.5h16M4.2 18 5.6 8.2l4.1 3.6L12 5l2.3 6.8 4.1-3.6L19.8 18z', f: 1 }]],
  alert: [['path', { d: 'M12 4.2 21 19.3H3z' }], ['path', { d: 'M12 10v4.2' }], ['circle', { cx: 12, cy: 17, r: 1.05, f: 1 }]],
  info: [['circle', { cx: 12, cy: 12, r: 8.75 }], ['path', { d: 'M12 11.2v5' }], ['circle', { cx: 12, cy: 7.8, r: 1.05, f: 1 }]],
  // A playing card seen face-down: the dealer's button.
  deal: [['rect', { x: 6.5, y: 3, width: 11, height: 18, rx: 2 }], ['path', { d: 'M12 8 15 12l-3 4-3-4z', f: 1 }]],
  copy: [
    ['rect', { x: 9, y: 9, width: 11.5, height: 11.5, rx: 2.2 }],
    ['path', { d: 'M15 9V5.8A2.3 2.3 0 0 0 12.7 3.5H5.8A2.3 2.3 0 0 0 3.5 5.8v6.9A2.3 2.3 0 0 0 5.8 15H9' }],
  ],
  skip: [['path', { d: 'M6 5.5l9 6.5-9 6.5z', f: 1 }], ['path', { d: 'M18.5 5v14' }]],
  pencil: [['path', { d: 'M4 20h4.2L19.4 8.8l-4.2-4.2L4 15.8z' }], ['path', { d: 'M14.6 5.4l4 4' }]],
  refresh: [['path', { d: 'M20.5 12a8.5 8.5 0 1 1-2.5-6' }], ['path', { d: 'M20.5 3.6v4.9h-4.9' }]],
  users: [['circle', { cx: 12, cy: 8, r: 3.6 }], ['path', { d: 'M4.8 20.5a7.2 7.2 0 0 1 14.4 0' }]],
  userPlus: [
    ['circle', { cx: 10, cy: 8, r: 3.4 }],
    ['path', { d: 'M3.5 20.5a6.5 6.5 0 0 1 13 0' }],
    ['path', { d: 'M18.5 7v6M15.5 10h6' }],
  ],
  clock: [['circle', { cx: 12, cy: 12, r: 8.75 }], ['path', { d: 'M12 6.8V12l3.4 2.2' }]],
  file: [['path', { d: 'M6 3h8l4.5 4.5V21H6z' }], ['path', { d: 'M13.8 3v5h4.7' }]],
  link: [
    ['path', { d: 'M10.2 13.8a3.8 3.8 0 0 0 5.4 0l2.9-2.9a3.8 3.8 0 0 0-5.4-5.4L12 6.6' }],
    ['path', { d: 'M13.8 10.2a3.8 3.8 0 0 0-5.4 0l-2.9 2.9a3.8 3.8 0 0 0 5.4 5.4L12 17.4' }],
  ],
  home: [['path', { d: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }]],
};

/**
 * Build an icon. Returns an inert `<svg>` — decorative by default, so screen
 * readers announce the button's label rather than the glyph.
 */
export function icon(name, props = {}) {
  const spec = ICONS[name];
  const node = svg('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': props.weight || 1.9,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    class: props.class || null,
  });
  if (!spec) return node;
  for (const [tag, attrs] of spec) {
    const { f, ...rest } = attrs;
    node.appendChild(svg(tag, { ...rest, fill: f ? 'currentColor' : 'none', stroke: f ? 'none' : 'currentColor' }));
  }
  return node;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

/* ------------------------------------------------------------- utilities */

/** Trigger a client-side file download from a string. */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copy text, preferring the async clipboard and falling back for old Safari. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = el('textarea', { value: text, 'aria-hidden': 'true' });
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
