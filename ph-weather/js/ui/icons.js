// Small line icons for the meta rows. 24×24, currentColor, no dependencies.

const P = {
  drop:    '<path d="M12 3.2c3.4 4 5.6 6.9 5.6 9.6A5.6 5.6 0 0 1 12 20.4a5.6 5.6 0 0 1-5.6-7.6c0-2.7 2.2-5.6 5.6-9.6z"/>',
  wind:    '<path d="M3 8h11a3 3 0 1 0-2.9-3.7"/><path d="M3 12.5h15.5a3 3 0 1 1-2.9 3.7"/><path d="M3 17h8a2.4 2.4 0 1 1-2.3 3"/>',
  eye:     '<path d="M1.8 12S5.6 5.6 12 5.6 22.2 12 22.2 12 18.4 18.4 12 18.4 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/>',
  gauge:   '<path d="M4 18a8.6 8.6 0 1 1 16 0"/><path d="m12 18 4.2-5.4"/>',
  clock:   '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.3l3.4 2"/>',
  sun:     '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.6M12 19.6v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M1.8 12h2.6M19.6 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/>',
  pin:     '<path d="M12 21.5s6.8-6.3 6.8-11a6.8 6.8 0 1 0-13.6 0c0 4.7 6.8 11 6.8 11z"/><circle cx="12" cy="10.5" r="2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 4.4v4.2h-4.2"/>',
  rain:    '<path d="M6.8 15.5h10.4a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0-1.1 8.1z"/><path d="M9 18.5 8 21.5M13 18.5 12 21.5M17 18.5 16 21.5"/>',
  hill:    '<path d="M2 19l7-11 4 6 3-4 6 9z"/>',
  lungs:   '<path d="M12 3v9M12 12c0-3-2.5-5-4.5-5S4 9 4 12v5a2 2 0 0 0 3 1.7l3-1.7a2 2 0 0 0 1-1.7z"/><path d="M12 12c0-3 2.5-5 4.5-5S20 9 20 12v5a2 2 0 0 1-3 1.7l-3-1.7a2 2 0 0 1-1-1.7z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};

export function icon(name, { size = 20, className = '' } = {}) {
  const body = P[name] || P.drop;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
