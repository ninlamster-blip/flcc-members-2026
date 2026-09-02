// Tiny DOM helpers. Screens return elements; the shell swaps them in.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/**
 * Navigation icons.
 *
 * Five destinations, drawn at one weight, open rather than filled. The active
 * tab is marked with colour and a dot under the label, never with a filled
 * capsule behind the icon — a capsule under a thumb is the single most generic
 * thing a phone app can do, and this app is trying not to look like every
 * other one.
 *
 * They are also drawn to be told apart at 23px by somebody who is not looking
 * carefully, which rules out the usual set of near-identical rounded squares.
 */
const NAV = {
  // A roof and a wall — where you are.
  today:     'M4 10.6 12 4l8 6.6M6.4 9.2V19a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V9.2',
  // A compass needle: the tab that asks what you need today.
  explore:   'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6zM15.4 8.6l-2 4.8-4.8 2 2-4.8z',
  // Three people, not two: this tab is the church, not a contact card.
  community: 'M12 11.4a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8zM6.6 19.4a5.4 5.4 0 0 1 10.8 0M5.2 12.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM18.8 12.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM2.6 18a3.6 3.6 0 0 1 2.6-3.4M21.4 18a3.6 3.6 0 0 0-2.6-3.4',
  // A frame with a play mark inside it.
  watch:     'M3.6 6.6a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2zM10.4 9.4l4.4 2.6-4.4 2.6z',
  // One person. The only tab that is about you.
  you:       'M12 11.8a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8zM4.8 20.4a7.2 7.2 0 0 1 14.4 0',
};

export function navIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', NAV[name] || NAV.today);
  svg.appendChild(path);
  return svg;
}

/**
 * A chevron, drawn rather than typed.
 *
 * "›" is a different width, weight and baseline in every font this app might
 * fall back to. Two hairlines rotated are the same mark everywhere.
 */
export function chevron() {
  return h('span', { class: 'chev', 'aria-hidden': 'true' });
}
