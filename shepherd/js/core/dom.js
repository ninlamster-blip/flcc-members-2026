/**
 * Tiny DOM helpers — the whole view layer of Shepherd.
 *
 * There is no framework and no build step here on purpose: the app has to be
 * deployable as plain files (the same way the rest of this repo ships), and a
 * church admin's phone on Kuwait mobile data should not pay for 140 KB of
 * runtime before it can show a prayer request.
 *
 * `h()` builds real DOM nodes. Modules render a whole view and hand it back;
 * the shell swaps it in. Re-rendering a view is cheap because views are small
 * and scoped to one purpose (see ARCHITECTURE.md, "One screen, one purpose").
 */

/** @typedef {Node|string|number|null|undefined|false} Child */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'g', 'polyline', 'polygon', 'ellipse']);

/**
 * Create an element.
 *
 * @param {string} tag        `div`, or a shorthand like `div.card.is-open#main`
 * @param {Record<string, any>|null} [props]
 * @param {...(Child|Child[])} children
 * @returns {HTMLElement|SVGElement}
 */
export function h(tag, props, ...children) {
  // `h('div.row', someNode, another)` is as natural to write as passing props
  // first, so anything that is plainly a child is treated as one.
  if (isChild(props)) {
    children.unshift(/** @type {Child} */ (props));
    props = null;
  }
  const { name, classes, id } = parseTag(tag);
  const el = SVG_TAGS.has(name)
    ? document.createElementNS(SVG_NS, name)
    : document.createElement(name);

  if (classes.length) el.setAttribute('class', classes.join(' '));
  if (id) el.setAttribute('id', id);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      applyProp(el, key, value);
    }
  }
  append(el, children);
  return /** @type {HTMLElement} */ (el);
}

/** True for anything that is content rather than a bag of properties. */
function isChild(value) {
  return value instanceof Node
    || Array.isArray(value)
    || typeof value === 'string'
    || typeof value === 'number';
}

function parseTag(tag) {
  const classes = [];
  let id = '';
  const name = tag.replace(/[.#][^.#]+/g, (token) => {
    if (token[0] === '.') classes.push(token.slice(1));
    else id = token.slice(1);
    return '';
  }) || 'div';
  return { name, classes, id };
}

function applyProp(el, key, value) {
  if (value == null || value === false) return;

  if (key === 'class' || key === 'className') {
    const existing = el.getAttribute('class');
    const next = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
    el.setAttribute('class', existing ? `${existing} ${next}` : next);
    return;
  }
  if (key === 'style' && typeof value === 'object') {
    Object.assign(/** @type {HTMLElement} */ (el).style, value);
    return;
  }
  if (key === 'dataset' && typeof value === 'object') {
    Object.assign(/** @type {HTMLElement} */ (el).dataset, value);
    return;
  }
  if (key === 'html') {
    el.innerHTML = String(value);
    return;
  }
  if (key === 'ref' && typeof value === 'function') {
    value(el);
    return;
  }
  if (key.startsWith('on') && typeof value === 'function') {
    el.addEventListener(key.slice(2).toLowerCase(), value);
    return;
  }
  // Properties that must be set as properties, not attributes, to actually take.
  if (key === 'value' || key === 'checked' || key === 'selected' || key === 'disabled') {
    el[key] = value;
    if (key === 'disabled' && value) el.setAttribute('disabled', '');
    return;
  }
  el.setAttribute(key, value === true ? '' : String(value));
}

/**
 * @param {Node} parent
 * @param {(Child|Child[])[]} children
 */
export function append(parent, children) {
  for (const child of children) {
    if (child == null || child === false || child === '') continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
  return parent;
}

/** A document fragment holding `children`. */
export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

/** Replace everything inside `el` with `children`. */
export function render(el, ...children) {
  el.textContent = '';
  append(el, children);
  return el;
}

/** @type {(sel: string, root?: ParentNode) => HTMLElement|null} */
export const qs = (sel, root = document) => root.querySelector(sel);

/** @type {(sel: string, root?: ParentNode) => HTMLElement[]} */
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Feather-style stroke icons, inlined so the app never waits on an icon font.
 * Keys are used across the nav, cards and buttons.
 */
const ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h3v-4h-3z',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  brain: 'M12 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5.7V15a3 3 0 0 0 5 2.2A3 3 0 0 0 17 15v-2.3A3 3 0 0 0 15 7V6a3 3 0 0 0-3-3zM12 3v18',
  sparkles: 'M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14',
  chart: 'M3 3v18h18M7 15V9M12 17V6M17 13v-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 12h18M3 6h18M3 18h18',
  church: 'M12 2v6M9 5h6M6 22V11l6-4 6 4v11M10 22v-5h4v5',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  graduation: 'M12 3 2 8l10 5 10-5-10-5zM6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5M22 8v6',
  play: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4V8z',
};

/**
 * @param {keyof typeof ICON_PATHS|string} name
 * @param {{size?: number, class?: string}} [opts]
 */
export function icon(name, opts = {}) {
  const d = ICON_PATHS[name] || ICON_PATHS.file;
  const size = opts.size || 20;
  const svg = h('svg', {
    class: `icon ${opts.class || ''}`.trim(),
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.6,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.appendChild(h('path', { d }));
  return svg;
}

export const iconNames = Object.keys(ICON_PATHS);
