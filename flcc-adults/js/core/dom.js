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
 * Single-weight line drawings at 1.5px, drawn open rather than filled. The
 * active tab is marked with colour and a dot underneath, never with a pill
 * behind the icon — a filled capsule under a thumb is the single most generic
 * thing a phone app can do, and this app is trying not to look like every
 * other one.
 */
const NAV = {
  home:    'M4 10.6 12 4l8 6.6M6.4 9.2V19a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V9.2',
  bible:   'M5 4.6A1.6 1.6 0 0 1 6.6 3H19v15.6H6.6A1.6 1.6 0 0 0 5 20.2zM5 4.6v15.6M12 7.2v6.2M9.2 10h5.6',
  // A flame, not a pair of hands. Praying hands drawn in line at 23 pixels
  // collapse into a dark blob; a candle flame stays legible at any size and
  // carries the same meaning without the piety.
  pray:    'M12 3.6c3.1 3 4.7 5.6 4.7 8.4a4.7 4.7 0 1 1-9.4 0c0-1.4.5-2.7 1.5-3.9.4 1 1 1.7 1.7 2.1-.1-2.4.4-4.5 1.5-6.6z',
  grow:    'M12 20.5v-7.2M12 13.3c0-3.4 2.4-6.1 5.6-6.6.5 3.6-2 6.6-5.6 6.6zM12 15.6C9.2 15.6 7 13.4 6.4 10.2c3 .3 5.2 2.5 5.6 5.4z',
  connect: 'M9.2 10.4a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2zM17.2 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.4 20.2c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8M16.8 14.6c2.4.5 4 2.5 4 5',
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
  path.setAttribute('d', NAV[name] || NAV.home);
  svg.appendChild(path);
  return svg;
}
