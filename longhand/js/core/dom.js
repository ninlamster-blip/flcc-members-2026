/**
 * The view layer: `h()` and a small set of inline icons.
 *
 * There is no framework here for the same reason the rest of this repository
 * has none — the app ships as static files and has to be readable by whoever
 * inherits it. Views build real DOM and hand it back; the shell swaps it in.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'g', 'polyline', 'polygon', 'ellipse']);

/** @typedef {Node|string|number|null|undefined|false} Child */

/**
 * @param {string} tag `div`, or shorthand `div.row.is-open#main`
 * @param {Record<string, any>|Child|Child[]} [props]
 * @param {...(Child|Child[])} children
 */
export function h(tag, props, ...children) {
  if (isChild(props)) { children.unshift(/** @type {Child} */(props)); props = null; }
  const { name, classes, id } = parseTag(tag);
  const el = SVG_TAGS.has(name) ? document.createElementNS(SVG_NS, name) : document.createElement(name);
  if (classes.length) el.setAttribute('class', classes.join(' '));
  if (id) el.id = id;
  if (props) for (const [key, value] of Object.entries(props)) applyProp(el, key, value);
  append(el, children);
  return /** @type {HTMLElement} */(el);
}

function isChild(v) {
  return v instanceof Node || Array.isArray(v) || typeof v === 'string' || typeof v === 'number';
}

function parseTag(tag) {
  const classes = [];
  let id = '';
  const name = tag.replace(/[.#][^.#]+/g, (m) => {
    if (m[0] === '.') classes.push(m.slice(1)); else id = m.slice(1);
    return '';
  }) || 'div';
  return { name, classes, id };
}

function applyProp(el, key, value) {
  if (value == null || value === false) return;
  if (key === 'class' || key === 'className') { el.setAttribute('class', [el.getAttribute('class'), value].filter(Boolean).join(' ')); return; }
  if (key === 'style' && typeof value === 'object') { Object.assign(el.style, value); return; }
  if (key === 'dataset') { Object.assign(el.dataset, value); return; }
  if (key === 'html') { el.innerHTML = value; return; }
  if (key.startsWith('on') && typeof value === 'function') { el.addEventListener(key.slice(2).toLowerCase(), value); return; }
  if (value === true) { el.setAttribute(key, ''); return; }
  el.setAttribute(key, String(value));
}

function append(el, children) {
  for (const child of children.flat(4)) {
    if (child == null || child === false || child === '') continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace everything inside `host` with `node`. */
export function mount(host, node) {
  host.replaceChildren(node);
  return node;
}

export function clear(host) { host.replaceChildren(); }

/* ── icons ───────────────────────────────────────────────────────────────────
   Line icons at a 24-unit grid, stroked in currentColor. Every one of these
   labels an action that already has a word next to it or an aria-label; none
   of them is decoration. */

const PATHS = {
  home:      'M4 10.5 12 4l8 6.5V20h-5v-6h-6v6H4z',
  record:    'M12 4a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4zM5 11a7 7 0 0 0 14 0M12 18v3',
  meetings:  'M4 5h16M4 10h16M4 15h11M4 20h7',
  memory:    'M12 4a5 5 0 0 0-5 5v1a3 3 0 0 0 0 6 4 4 0 0 0 8 1 4 4 0 0 0 5-4 3 3 0 0 0-1-5 5 5 0 0 0-7-4z',
  tasks:     'M4 6h2l1.5 1.5L11 4M4 12h2l1.5 1.5L11 10M4 18h2l1.5 1.5L11 16M14 6h6M14 12h6M14 18h6',
  people:    'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M16 14a6 6 0 0 1 6 6',
  search:    'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  settings:  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.5 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2-1.2L14.7 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z',
  play:      'M8 5.5v13l11-6.5z',
  pause:     'M9 5v14M15 5v14',
  stop:      'M6.5 6.5h11v11h-11z',
  back5:     'M11 8V4L6 8l5 4V8a6 6 0 1 1-6 6',
  fwd5:      'M13 8V4l5 4-5 4V8a6 6 0 1 0 6 6',
  check:     'M5 12.5 9.5 17 19 7',
  circle:    'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  clock:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  chevron:   'M9 5l7 7-7 7',
  chevronDown:'M5 9l7 7 7-7',
  close:     'M6 6l12 12M18 6L6 18',
  more:      'M12 6h.01M12 12h.01M12 18h.01',
  star:      'M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z',
  folder:    'M4 7h5l2 2h9v10H4z',
  download:  'M12 4v11m0 0 4-4m-4 4-4-4M5 20h14',
  edit:      'M4 20h4l10-10-4-4L4 16zM14 6l4 4',
  trash:     'M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13',
  note:      'M6 4h9l3 3v13H6zM15 4v4h3',
  bookmark:  'M7 4h10v16l-5-4-5 4z',
  mic:       'M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 12a6 6 0 0 0 12 0M12 18v2',
  quote:     'M7 7h4v4c0 3-2 5-4 5V7zM15 7h4v4c0 3-2 5-4 5V7z',
  link:      'M10 14a4 4 0 0 0 6 .5l2-2a4 4 0 1 0-5.7-5.7L11 8M14 10a4 4 0 0 0-6-.5l-2 2A4 4 0 1 0 11.7 17L13 16',
  filter:    'M4 6h16l-6 7v6l-4-2v-4z',
  alert:     'M12 4l9 16H3zM12 10v4M12 17h.01',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {{size?: number, title?: string}} [options]
 */
export function icon(name, { size = 18, title } = {}) {
  const svg = h('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.6,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': title ? null : 'true', role: title ? 'img' : null,
  });
  if (title) svg.appendChild(h('title', title));
  const d = PATHS[name] || PATHS.circle;
  for (const part of d.split(' M').map((p, i) => (i ? 'M' + p : p))) {
    svg.appendChild(h('path', { d: part, fill: name === 'play' || name === 'stop' ? 'currentColor' : 'none' }));
  }
  return svg;
}

export const ICON_NAMES = Object.keys(PATHS);
