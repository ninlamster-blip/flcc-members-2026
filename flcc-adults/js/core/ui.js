// The component kit.
//
// Two shapes carry this app. A LIST is a `stack()` of full-bleed `band()`s,
// torn apart by seeded waves and marked with a hand-drawn texture. Everything
// else is a `card()`: warm paper, a soft lift, and no border.
//
// The third shape, `sheet()`, is for the screens that ask the reader to make
// something: a white page, a two-tone heading, a short column of choices, and
// one full-width action along the bottom.
//
// What is deliberately absent is as much of the design as what is here. There
// is no badge pill, no star row and no character with a face — all three were
// in an earlier version of this app and all three are why it read as an app
// for children rather than for the adults of a church.

import { h, clear, navIcon } from './dom.js';
import * as art from './art.js';
import { showFigures } from './profile.js';

/**
 * A card.
 *
 * @param {object} options
 * @param {string}  options.tone   tints the card — a tenth of a colour, not
 *                                 the colour, so a paragraph still sits on it
 * @param {boolean} options.solid  the ONE full-colour block a screen may have
 * @param {string}  options.symbol an icon from js/core/art.js, placed in the
 *                                 card's header rather than under its text
 * @param {*}       options.foot   small print along the bottom, above a
 *                                 hairline — a string, an element, or [l, r]
 * @param {boolean} options.tall   a hero card: taller, and its content spreads
 */
export function card({ tone = 'paper', solid = false, symbol = '', figureSize = '', foot = null,
                       tall = false, as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  const el = h(as, {
    class: `card ${className}`.trim(),
    dataset: { tone, ...(solid ? { solid: '' } : {}), ...(tall ? { tall: '' } : {}) },
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  });
  // The one loud block on a screen wears a texture, the way every band does.
  // It is what stops it reading as a plain rectangle of colour.
  if (solid && showFigures()) {
    const mark = h('div', { class: 'texture-holder', dataset: { at: 'br' }, 'aria-hidden': 'true' });
    mark.innerHTML = art.texture(art.pickTexture(symbol || tone), symbol || tone);
    el.appendChild(mark);
  }
  // The icon goes at the top-right, level with the first line of type. Placed
  // under the text it becomes a mascot sitting in a field of colour, which is
  // the look this app is trying to leave behind.
  //
  // The pairing is built BEFORE the body exists. Wrapping a child that is
  // already in the DOM with `replaceWith` puts the child inside its own
  // replacement, which the DOM rejects outright.
  let kids = children.flat(Infinity).filter(Boolean);
  if (symbol) {
    const mark = figure(symbol, { size: figureSize });
    kids = kids.length ? [h('div', { class: 'card-head' }, kids[0], mark), ...kids.slice(1)] : [mark];
  }
  el.appendChild(h('div', { class: 'card-body' }, kids));
  if (foot !== null && foot !== undefined && foot !== false) el.appendChild(cardFoot(foot));
  return el;
}

/** The small print along the bottom of a card, above a hairline.
 *  Named `foot` rather than `band` — a band is a layer of a stack now. */
export function cardFoot(content) {
  const parts = (Array.isArray(content) ? content : [content]).filter((one) => one !== null && one !== undefined && one !== false);
  return h('div', { class: 'card-foot' },
    ...parts.map((one) => (one instanceof Node ? one : h('span', { text: String(one) }))));
}

/**
 * One icon.
 *
 * It takes its colour from the text around it — `currentColor` in the SVG,
 * `--captain` in the stylesheet — so there is no per-card colour decision to
 * make and no way for one screen's icons to drift away from another's.
 *
 * The reader's choice to switch the icons off is honoured HERE rather than at
 * each call site: a screen that reaches for one directly must go quiet too,
 * or turning them off in You clears some screens and not others.
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

/**
 * The eyebrow above a heading: small, tracked, uppercase, and grey.
 *
 * It used to be a white pill with a 2px navy outline. Kept as `badge` so the
 * screens did not all need editing, but it is a label now — an outlined pill
 * on every card was a third of what made this app look like a toy.
 */
export function badge(text) { return h('p', { class: 'label', text }); }

// ── The stack ──────────────────────────────────────────────────────────────

/**
 * A list, as a stack of colour.
 *
 * Used for exactly one thing: a set of things with a count. Prayer categories,
 * learning paths, reading plans. A list of Bible books is not this — sixty-six
 * bands is a paint chart, not a list.
 */
export function stack({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `stack ${className}`.trim(), ...rest },
    children.flat(Infinity).filter(Boolean));
}

/**
 * One band of a stack.
 *
 * @param {object} options
 * @param {string} options.tone     the band's colour, full strength
 * @param {string} options.texture  one of art.TEXTURES; omitted, one is picked
 *                                  from the seed so no band is ever bare
 * @param {string} options.seed     what the wave and texture are drawn from —
 *                                  pass something stable, like an id
 * @param {*}      options.count    the figure on the right
 * @param {boolean} options.tall    a hero band, with room for a heading
 */
export function band({ tone = 'rose', texture = '', seed = '', count = null, tall = false,
                       at = 'tr', as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  const el = h(as, {
    class: `band ${className}`.trim(),
    dataset: { tone, ...(tall ? { tall: '' } : {}) },
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  });

  const edge = h('span', { class: 'wave-holder', style: 'display:contents' });
  edge.innerHTML = art.wave(seed || tone);
  el.appendChild(edge.firstChild);

  if (showFigures()) {
    const mark = h('div', { class: 'texture-holder', dataset: { at }, 'aria-hidden': 'true' });
    mark.innerHTML = art.texture(art.isTexture(texture) ? texture : art.pickTexture(seed || tone), seed || tone);
    el.appendChild(mark);
  }

  const kids = children.flat(Infinity).filter(Boolean);
  el.appendChild(tall ? h('div', { style: 'display:contents' }, kids) : h('div', {}, kids));
  if (count !== null && count !== undefined && count !== false) {
    el.appendChild(h('span', { class: 'band-count', text: String(count) }));
  }
  return el;
}

export function bandName(text) { return h('p', { class: 'band-name', text }); }
export function bandNote(text) { return h('p', { class: 'band-note', text }); }

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

/** A group with no chrome at all: used to hold cards, and on the Bible screen. */
export function section({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `section ${className}`.trim(), style: 'display:flex;flex-direction:column;gap:.55rem', ...rest },
    children.flat(Infinity).filter(Boolean));
}

/** Plain paper. Scripture is read on this, and nothing else uses it. */
export function reader({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `reader ${className}`.trim(), ...rest }, children.flat(Infinity).filter(Boolean));
}

export function label(text) { return h('p', { class: 'label', text }); }
/**
 * A display heading, optionally with one word marked.
 *
 * `display('New list', { mark: 'list' })` sets "list" in ember over a
 * highlighter stroke — the reference's own device, and the only place in this
 * app where a heading changes colour mid-phrase.
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

export function go(text, onclick) { return h('button', { class: 'go', type: 'button', onclick }, text); }

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

/** One row of a list — itself a small card. */
export function row({ eyebrow = '', title: heading, note: lede = '', meta = '', accent = '', number = '', onclick, ...rest } = {}) {
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
  el.appendChild(meta ? h('span', { class: 'row-meta', text: meta }) : h('span'));
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

/** Cards arrive as you scroll. They land once, and never again. */
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
    figure(symbol),
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
      style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(6rem + env(safe-area-inset-bottom));z-index:70;'
        + 'background:#2B4C6D;color:#fff;padding:.65rem 1rem;border-radius:12px;'
        + 'box-shadow:0 8px 24px rgba(43,76,109,.24);font-size:.85rem;font-weight:450;max-width:90vw;text-align:center' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

export { h, clear, navIcon };
