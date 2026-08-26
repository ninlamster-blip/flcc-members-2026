// Tiny DOM helpers. No framework: screens return elements, the shell swaps them.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
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

export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// Inline icons — a handful, drawn on the same 24px grid, stroked not filled.
const ICONS = {
  today:  'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  bible:  'M5 4.5A2.5 2.5 0 017.5 2H19v16H7.5A2.5 2.5 0 005 20.5zM5 4.5v16M12 6v6M9.5 8.5h5',
  discover: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z',
  journey: 'M6 21V9M6 9a3 3 0 100-6 3 3 0 000 6zM18 3v10M18 13a3 3 0 100 6 3 3 0 000-6zM6 12h6a3 3 0 003-3V6',
  me:     'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6',
  pray:   'M12 21c-1 0-2-.6-2.5-1.6L7 14.5c-.6-1.2-.2-2.6 1-3.2M12 21c1 0 2-.6 2.5-1.6l2.5-4.9c.6-1.2.2-2.6-1-3.2M9.8 11.2L11 4.8a1.2 1.2 0 012.4 0l1.2 6.4',
  journal: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
  ask:    'M21 12a9 9 0 11-3.2-6.9M12 8.5a2 2 0 112.6 1.9c-.9.3-1.6 1-1.6 2v.6M12 17h.01',
  lamp:   'M12 2.7c2.5 3 3.8 5.3 3.8 7.4a3.8 3.8 0 11-7.6 0c0-2.1 1.3-4.4 3.8-7.4zM12 13.5v4M6.5 17.5h11M8.5 21h7',
  check:  'M20 6L9 17l-5-5',
  chevron:'M9 6l6 6-6 6',
};

export function icon(name, size = 21) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name] || ICONS.lamp);
  svg.appendChild(path);
  return svg;
}
