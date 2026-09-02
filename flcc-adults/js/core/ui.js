// The component kit — the NEXT system.
//
// Four shapes carry this app, and knowing which is which is most of knowing
// how to add a screen to it:
//
//   block()   the ONE deep near-black block a screen is allowed. The Daily
//             Word, the featured message, the profile head. 15% of the screen.
//   eblock()  an editorial navigation block: a hairline, a large name, one
//             line of what it is, and the forward arrow. Explore is built out
//             of these, and they are what replaced the four-tile icon grid.
//   rows()    a list. Hairline-separated rows, a 2px colour stem at most.
//   card()    a panel, for a group of things that genuinely has an edge.
//
// What is deliberately absent is as much of the design as what is here. There
// is no coloured band, no wave, no texture, no badge pill, no star row and no
// character with a face — every one of those was in an earlier version of this
// app, and every one of them is why it read first as a toy and then as a
// dashboard.
//
// The rule that keeps it honest: if a thing needs a box around it to be found,
// it is in the wrong place on the page. Reach for a heading and space first.

import { h, clear, navIcon, chevron } from './dom.js';
import * as art from './art.js';
import { showFigures } from './profile.js';

// ── The deep block ─────────────────────────────────────────────────────────

/**
 * The one deep block a screen may have.
 *
 * @param {object} options
 * @param {boolean} options.tall  a hero block: fills most of the first screen
 * @param {boolean} options.arc   the corner geometry — hairline rings, the
 *                                only abstract mark in the system. Off for a
 *                                block whose type reaches the corner.
 */
export function block({ tall = false, arc = true, as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  const el = h(as, {
    class: `block ${tall ? 'block--tall ' : ''}${className}`.trim(),
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  });
  if (arc) el.appendChild(h('span', { class: 'arc', 'aria-hidden': 'true' }));
  el.append(...children.flat(Infinity).filter(Boolean));
  return el;
}

// ── The editorial block ────────────────────────────────────────────────────

/**
 * A large navigation block: READ, PRAY, GROW, PLAN.
 *
 * The name is set at display size, so it is found by reading rather than by
 * hunting for an icon, and the whole block is the tap target — which is what
 * makes this shape work for a fifty-year-old holding a phone in one hand.
 */
export function eblock({ name, what = '', go: label = 'Open', onclick, ...rest } = {}) {
  return h('button', { class: 'eblock', type: 'button', onclick, ...rest },
    h('p', { class: 'eblock-name', text: name }),
    what ? h('p', { class: 'eblock-what', text: what }) : null,
    h('span', { class: 'eblock-go' }, label, h('i'), h('u')));
}

// ── The signature ──────────────────────────────────────────────────────────

/**
 * A section heading with the forward line running out of it.
 *
 *     NEXT UP ─────────────────────→
 *
 * This is the app's signature and the reason it is called NEXT. It belongs on
 * section headings and nowhere else — put it on every element and it stops
 * being a signature and becomes a texture.
 *
 * @param {string} text        the heading
 * @param {object} options
 * @param {string} options.more  a text action at the end of the line
 */
export function nextLine(text, { more = '', onmore = null } = {}) {
  return h('div', { class: 'next-line' },
    h('p', { class: 'label', text }),
    h('span', { class: 'track', 'aria-hidden': 'true' }),
    more && onmore
      ? h('button', { class: 'more', type: 'button', onclick: onmore, text: more })
      : h('span', { class: 'tip', 'aria-hidden': 'true' }));
}

/** The name of a root screen, set as the page's own title. */
export function pageTitle(name, line = '') {
  return h('header', { class: 'page-title' },
    h('h1', { text: name }),
    line ? h('p', { text: line }) : null,
    h('span', { class: 'under', 'aria-hidden': 'true' }));
}

// ── The panel ──────────────────────────────────────────────────────────────

/**
 * A panel — what used to be a card, kept under the same name so the screens
 * did not all need editing.
 *
 * @param {object} options
 * @param {string}  options.tone   tints it at about a tenth of a colour
 * @param {boolean} options.solid  renders it as the deep block instead
 * @param {string}  options.symbol an icon from js/core/art.js, in the header
 * @param {*}       options.foot   small print along the bottom, above a rule
 * @param {boolean} options.tall   a hero panel: taller, its content spread
 */
export function card({ tone = 'paper', solid = false, symbol = '', figureSize = '', foot = null,
                       tall = false, as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  const el = h(as, {
    class: `card ${className}`.trim(),
    dataset: { tone, ...(solid ? { solid: '' } : {}), ...(tall ? { tall: '' } : {}) },
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  });
  if (solid) el.appendChild(h('span', { class: 'arc', 'aria-hidden': 'true' }));
  // The icon goes at the top-right, level with the first line of type. Placed
  // under the text it becomes a mascot sitting in a field of colour, which is
  // the look this app left behind two designs ago.
  //
  // The pairing is built BEFORE the body exists. Wrapping a child that is
  // already in the DOM with `replaceWith` puts the child inside its own
  // replacement, which the DOM rejects outright.
  let kids = children.flat(Infinity).filter(Boolean);
  if (symbol) {
    const mark = figure(symbol, { size: figureSize || 'sm' });
    kids = kids.length ? [h('div', { class: 'card-head' }, kids[0], mark), ...kids.slice(1)] : [mark];
  }
  el.appendChild(h('div', { class: 'card-body' }, kids));
  if (foot !== null && foot !== undefined && foot !== false) el.appendChild(cardFoot(foot));
  return el;
}

/** The small print along the bottom of a panel, above a hairline. */
export function cardFoot(content) {
  const parts = (Array.isArray(content) ? content : [content]).filter((one) => one !== null && one !== undefined && one !== false);
  return h('div', { class: 'card-foot' },
    ...parts.map((one) => (one instanceof Node ? one : h('span', { text: String(one) }))));
}

/**
 * One icon.
 *
 * It takes its colour from the text around it — `currentColor` in the SVG —
 * so there is no per-screen colour decision to make and no way for one
 * screen's icons to drift away from another's.
 *
 * The reader's choice to switch the icons off is honoured HERE rather than at
 * each call site: a screen that reaches for one directly must go quiet too, or
 * turning them off in You clears some screens and not others.
 */
export function figure(name, { size = '', well = false } = {}) {
  if (!showFigures()) return h('span', { hidden: true });
  const el = h('div', {
    class: 'figure',
    dataset: { ...(size ? { size } : {}), ...(well ? { well: '' } : {}) },
  });
  el.innerHTML = art.icon(art.isIcon(name) ? name : art.pick(name));
  return el;
}

/** The eyebrow above a heading: small, tracked, uppercase, and grey. */
export function badge(text) { return h('p', { class: 'label', text }); }
export function label(text) { return h('p', { class: 'label', text }); }

// ── The media rail ─────────────────────────────────────────────────────────

/** A row of things you are part-way through. It scrolls inside itself. */
export function rail({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `rail ${className}`.trim(), ...rest },
    children.flat(Infinity).filter(Boolean));
}

/**
 * One tile on a rail.
 *
 * There is no photograph behind it and there is not going to be a stock one:
 * a message this church has not published a still for gets the deep block and
 * the corner geometry, which is honest and does not look like a placeholder.
 */
export function tile({ name, by = '', meta = '', percent = null, onclick, ...rest } = {}) {
  return h('button', { class: 'tile', type: 'button', onclick, ...rest },
    h('span', { class: 'tile-art' },
      h('span', { class: 'arc', 'aria-hidden': 'true' }),
      h('span', { class: 'tile-play', 'aria-hidden': 'true' })),
    h('p', { class: 'tile-name', text: name }),
    by ? h('p', { class: 'tile-by', text: by }) : null,
    meta ? h('p', { class: 'tile-by', text: meta }) : null,
    // Only once there is progress to show. A bar at 0% is a grey rule under a
    // tile, which reads as a stray divider rather than as "not started".
    percent > 0 ? thread(percent, 'gold') : null);
}

// ── The sheet ──────────────────────────────────────────────────────────────

/** A white page that asks the reader to make something. */
export function sheet({ action = '', onaction = null, disabled = false, className = '', ...rest } = {}, ...children) {
  const el = h('div', { class: `sheet ${className}`.trim(), ...rest },
    children.flat(Infinity).filter(Boolean));
  if (action) {
    el.appendChild(h('button', {
      class: 'sheet-foot', type: 'button', text: action,
      ...(disabled ? { disabled: true } : {}),
      ...(onaction ? { onclick: onaction } : {}),
    }));
  }
  return el;
}

/** One choice on a sheet: a soft filled block with a name and what it is. */
export function pick(name, what, { tone = 'sky', chosen = false, onclick } = {}) {
  return h('button', {
    class: 'pick', type: 'button', dataset: { tone },
    'aria-pressed': String(Boolean(chosen)), onclick,
  }, h('p', { class: 'pick-name', text: name }), what ? h('p', { class: 'pick-what', text: what }) : null);
}

/** A group with no chrome at all: used to hold a heading and its list. */
export function section({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `section ${className}`.trim(), ...rest },
    children.flat(Infinity).filter(Boolean));
}

/** Plain paper. Scripture is read on this, and nothing else uses it. */
export function reader({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `reader ${className}`.trim(), ...rest }, children.flat(Infinity).filter(Boolean));
}

// ── Type ───────────────────────────────────────────────────────────────────

/**
 * A display heading, optionally with one word marked.
 *
 * `display('New list', { mark: 'list' })` sets "list" in gold — the only place
 * in this app where a heading changes colour mid-phrase.
 */
export function display(text, { mark = '' } = {}) {
  const source = String(text || '');
  if (!mark || !source.toLowerCase().includes(String(mark).toLowerCase())) {
    return h('h1', { class: 'display', text: source });
  }
  const at = source.toLowerCase().indexOf(String(mark).toLowerCase());
  return h('h1', { class: 'display' },
    source.slice(0, at),
    h('span', { class: 'mark', text: source.slice(at, at + mark.length) }),
    source.slice(at + mark.length));
}

export function title(text, tag = 'h2') { return h(tag, { class: 'title', text }); }
export function lead(text) { return h('p', { class: 'lead', text }); }
export function body(text) { return h('p', { class: 'body', text }); }
export function note(text, level = '') { return h('p', { class: 'note', ...(level ? { dataset: { level } } : {}), text }); }
export function small(text) { return h('p', { class: 'small', text }); }
export function rule() { return h('hr', { class: 'rule' }); }
export function waiting() { return h('div', { class: 'wait', role: 'status', 'aria-label': 'Loading' }); }

/**
 * Scripture, set as Scripture.
 *
 * The serif is the one typographic signal in the app that says this text is
 * not ours. The size steps down as the passage gets longer, because a setting
 * that is right for one line of Micah turns four verses of Psalm 139 into a
 * wall that fills a phone.
 */
export function scripture(text, { flow = false, tag = 'p' } = {}) {
  const source = String(text || '').trim();
  const length = source.length > 300 ? 'xl' : source.length > 150 ? 'l' : 'm';
  // Some passages open with a quotation mark of their own — anything Jesus
  // says, for a start — and wrapping those again prints ““Come to me.
  const quoted = /^[“"]/.test(source);
  return h(tag, { class: `scripture${flow ? ' scripture--flow' : ''}`, dataset: { length },
    text: quoted ? source : `“${source}”` });
}

export function cite(text) { return h('p', { class: 'cite', text }); }

// ── Action ─────────────────────────────────────────────────────────────────

/** The secondary action: text, a rule, an arrow. There is no third style. */
export function go(text, onclick) { return h('button', { class: 'go', type: 'button', onclick }, text); }

/** The one filled button a screen is allowed. `quiet` makes it text instead. */
export function act(text, onclick, { quiet = false, small: compact = false, ...rest } = {}) {
  return h('button', {
    class: 'act', type: 'button', onclick,
    ...(quiet ? { 'data-quiet': '' } : {}),
    ...(compact ? { 'data-small': '' } : {}),
    ...rest,
  }, text);
}

export function actions(...children) { return h('div', { class: 'act-row' }, children.flat(Infinity).filter(Boolean)); }

export function thread(percent, accent = '') {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return h('div', { class: 'thread', ...(accent ? { dataset: { accent } } : {}),
    role: 'progressbar', 'aria-valuenow': String(value), 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('i', { style: `width:${value}%` }));
}

export function tag(text, accent = '') {
  return h('span', { class: 'tag', ...(accent ? { dataset: { accent } } : {}), text });
}

/** The mark that says a thing landed: one pulse, then still. */
export function doneMark(text) { return h('span', { class: 'done-mark', text }); }

// ── Rows ───────────────────────────────────────────────────────────────────

/** One row of a list. Hairline below, a 2px colour stem at most. */
export function row({ eyebrow = '', title: heading, note: lede = '', meta = '', accent = '', number = '',
                      chev = false, onclick, ...rest } = {}) {
  const el = h(onclick ? 'button' : 'div', {
    class: 'row', ...(onclick ? { onclick, type: 'button' } : {}), ...rest,
  });
  if (accent) el.appendChild(h('i', { class: 'stem', dataset: { accent } }));
  else if (number !== '' && number !== null) el.appendChild(h('span', { class: 'row-num', text: String(number) }));
  else el.appendChild(h('span'));

  el.appendChild(h('div', {},
    eyebrow ? h('p', { class: 'label', style: 'margin-bottom:.3rem', text: eyebrow }) : null,
    h('p', { class: 'row-title', text: heading }),
    lede ? h('p', { class: 'row-note', text: lede }) : null));

  if (meta) el.appendChild(h('span', { class: 'row-meta', text: meta }));
  else if (chev && onclick) el.appendChild(chevron());
  else el.appendChild(h('span'));
  return el;
}

export function rows({ tight = false } = {}, ...children) {
  return h('div', { class: 'rows', ...(tight ? { dataset: { tight: '' } } : {}) },
    children.flat(Infinity).filter(Boolean));
}

export function choice(text, onclick, props = {}) {
  return h('button', { class: 'choice', type: 'button', onclick, ...props }, text);
}

/**
 * A Scripture reference that opens the Bible.
 *
 * The whole Bible ships with this app, so a reference rendered as dead text is
 * an adult retyping "Lamentations 3:22" into the Bible tab. `scripture.js` is
 * imported on the click rather than at the top of the file: every screen loads
 * this kit, and only a reader who taps a reference needs the parser.
 */
export function reference(text, navigate, { className = 'cite', style = '' } = {}) {
  if (!text) return h('span');
  if (typeof navigate !== 'function') return h('p', { class: className, style, text });
  return h('button', {
    class: `${className} ref-link`, type: 'button', style,
    'aria-label': `Open ${text} in the Bible`,
    onclick: async () => {
      try {
        const module = await import('./scripture.js');
        const { books } = await module.manifest();
        const found = module.parseRef(text, books);
        if (!found) { navigate(`bible/search?q=${encodeURIComponent(text)}`); return; }
        navigate(`bible/${found.book.n}/${found.chapter}${found.verse ? `?v=${found.verse}` : ''}`);
      } catch { toast('The Bible could not be opened just now.'); }
    },
  }, text);
}

/**
 * Replace an element's children, dropping the ones that are not there.
 *
 * `Element.replaceChildren()` stringifies whatever it is given, so a
 * conditional child written as `condition ? thing() : null` — the pattern used
 * everywhere in these screens — puts the word "null" on the page. This is the
 * only way a screen should swap its contents, and `test/modules.test.mjs`
 * fails a screen that calls `replaceChildren` directly.
 */
export function swap(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return el;
}

/** Content arrives as you scroll. It lands once, and never again. */
export function rise(elements) {
  const nodes = [].concat(elements).filter(Boolean);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof IntersectionObserver === 'undefined') return nodes;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.in = '';
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -5% 0px' });
  nodes.forEach((node, i) => {
    node.classList.add('rise');
    node.style.transitionDelay = `${Math.min(i, 5) * 50}ms`;
    observer.observe(node);
  });
  return nodes;
}

/**
 * A full-screen moment. The app has exactly one interruption, and this is it:
 * the end of a guided prayer, the end of a path. One line, one way out.
 */
export function moment({ eyebrow = '', big, line = '', action = 'Amen', symbol = 'star', onclose }) {
  const screen = h('div', { class: 'moment', role: 'dialog', 'aria-modal': 'true' });
  screen.append(
    figure(symbol, { size: 'lg' }),
    eyebrow ? badge(eyebrow) : null,
    h('p', { class: 'display', text: big }),
    line ? lead(line) : null,
    h('div', { style: 'margin-top:.4rem' }, act(action, () => { screen.remove(); if (onclose) onclose(); })));
  document.body.appendChild(screen);
  screen.querySelector('.act').focus();
  return screen;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite',
      // `pointer-events:none` matters more than it looks. The toast sits just
      // above the tab bar for two and a half seconds, and without this it
      // swallows taps on Community and Watch — the two tabs directly under it —
      // for every one of them. It is announced to a screen reader and is
      // untouchable by a finger, which is what a toast should be.
      style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(6rem + env(safe-area-inset-bottom));z-index:70;'
        + 'pointer-events:none;'
        + 'background:#151515;color:#fff;padding:.7rem 1.1rem;border-radius:12px;'
        + 'box-shadow:0 8px 28px rgba(21,21,21,.28);font-size:.85rem;font-weight:500;max-width:90vw;text-align:center' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

export { h, clear, navIcon, chevron };
