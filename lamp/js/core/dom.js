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
  lamp:   'M12 2.7c2.5 3 3.8 5.3 3.8 7.4a3.8 3.8 0 11-7.6 0c0-2.1 1.3-4.4 3.8-7.4zM12 13.5v4M6.5 17.5h11M8.5 21h7',
  read:   'M12 6.5C10.4 5 8.3 4.3 5 4.3V18c3.3 0 5.4.7 7 2.2 1.6-1.5 3.7-2.2 7-2.2V4.3c-3.3 0-5.4.7-7 2.2zM12 6.5v13.7',
  reflect:'M4 20.5l1-4L16.2 5.3a2 2 0 012.8 0l1.7 1.7a2 2 0 010 2.8L9.5 21l-4 1zM14.5 7.2l4.3 4.3',
  me:     'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6',
  chevron:'M9 6l6 6-6 6',
  check:  'M20 6L9 17l-5-5',
  discover:'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z',
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
