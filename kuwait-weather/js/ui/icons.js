// One line-drawn set, 24×24, currentColor, no dependencies.

const P = {
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.6M12 19.6v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M1.8 12h2.6M19.6 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  partly: '<circle cx="9" cy="8.5" r="3.4"/><path d="M9 1.9v1.8M3.6 8.5H1.8M4.6 4.1 3.3 2.8M14.4 4.1l1.3-1.3"/><path d="M7.5 19.5h9.8a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.8-1 3.4 3.4 0 0 0-1.3 7.4z"/>',
  partlyNight: '<path d="M15.5 9.6A5.4 5.4 0 0 1 10 4.2a5.4 5.4 0 1 0 5.5 5.4z"/><path d="M7.5 19.8h9.8a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.8-1 3.4 3.4 0 0 0-1.3 7.4z"/>',
  cloud: '<path d="M6.8 19h10.4a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.1A3.7 3.7 0 0 0 6.8 19z"/>',
  rain: '<path d="M6.8 15.5h10.4a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0-1.1 8.1z"/><path d="M9 18.5 8 21.5M13 18.5 12 21.5M17 18.5 16 21.5"/>',
  drizzle: '<path d="M6.8 15.5h10.4a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0-1.1 8.1z"/><path d="M9.5 19v1.5M13.5 19v1.5"/>',
  storm: '<path d="M6.8 14.5h10.4a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0-1.1 8.1z"/><path d="m13 16-3.5 4.5h3l-1 3.5"/>',
  snow: '<path d="M6.8 15.5h10.4a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0-1.1 8.1z"/><path d="M9.5 19h.01M13 20.5h.01M16.5 19h.01"/>',
  fog: '<path d="M4 9h16M6 13h14M3 17h12M8 21h12"/>',
  dust: '<path d="M3 7.5h11a3 3 0 1 0-2.9-3.7"/><path d="M3 12.5h15.5a3 3 0 1 1-2.9 3.7"/><path d="M3 17.5h9"/><circle cx="17.5" cy="9.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="7" cy="20.5" r="0.9" fill="currentColor" stroke="none"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-2.9-3.7"/><path d="M3 12.5h15.5a3 3 0 1 1-2.9 3.7"/><path d="M3 17h8a2.4 2.4 0 1 1-2.3 3"/>',
  heat: '<path d="M12 13.5V4.5a2 2 0 1 1 4 0v9a4.5 4.5 0 1 1-4 0z"/><circle cx="14" cy="17.5" r="1.6" fill="currentColor" stroke="none"/><path d="M4 6h4M4 10h4M4 14h4"/>',
  ban: '<circle cx="12" cy="12" r="8.6"/><path d="m6 18 12-12"/>',
  drop: '<path d="M12 3.2c3.4 4 5.6 6.9 5.6 9.6A5.6 5.6 0 0 1 12 20.4a5.6 5.6 0 0 1-5.6-7.6c0-2.7 2.2-5.6 5.6-9.6z"/>',
  eye: '<path d="M1.8 12S5.6 5.6 12 5.6 22.2 12 22.2 12 18.4 18.4 12 18.4 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/>',
  gauge: '<path d="M4 18a8.6 8.6 0 1 1 16 0"/><path d="m12 18 4.2-5.4"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.3l3.4 2"/>',
  pin: '<path d="M12 21.5s6.8-6.3 6.8-11a6.8 6.8 0 1 0-13.6 0c0 4.7 6.8 11 6.8 11z"/><circle cx="12" cy="10.5" r="2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 4.4v4.2h-4.2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};

export function icon(name, { size = 24, className = '' } = {}) {
  const body = P[name] || P.cloud;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
