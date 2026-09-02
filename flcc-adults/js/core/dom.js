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
 * The same single-weight line drawings the kids and teens edition uses, at the
 * same 1.7 stroke, quiet enough to disappear. Three of the five are that app's
 * own icons unchanged (`today`, `explore`, `you`); the two this edition does
 * not share with it are drawn to match.
 */
const NAV = {
  today:     'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  explore:   'M5 4.5A1.5 1.5 0 016.5 3H19v15.5H6.5A1.5 1.5 0 005 20zM5 4.5v15.5M12 7v7M9 10h6',
  community: 'M9 10a3 3 0 100-6 3 3 0 000 6zM17 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 14.5c2.6.4 4.5 2.3 4.5 5',
  watch:     'M9 6.5v11l9-5.5z M4 4v16',
  you:       'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5',
  back:      'M15 5l-7 7 7 7',
};

export function navIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', NAV[name] || NAV.today);
  svg.appendChild(path);
  return svg;
}
