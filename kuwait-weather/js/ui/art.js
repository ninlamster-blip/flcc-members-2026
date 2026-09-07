// The weather illustrations.
//
// Each one is drawn twice: a flat colour shape, and black line art sitting
// slightly off it. That deliberate misregistration — the colour not quite
// inside the lines, the way a two-plate risograph prints — is the whole look.
// It also survives being shrunk: at 28px the flat shape still reads as sun or
// cloud even when the linework has gone to mush.
//
// One 64×64 grid, one 2.6 stroke weight, and no gradients anywhere.

const ART = {
  sun: {
    tone: 'sun',
    flat: '<path d="M12 34c-2-11 6-21 17-22s22 6 23 17-7 22-18 23-20-7-22-18z"/>',
    ink: '<circle cx="34" cy="29" r="11.5"/>'
      + '<path d="M34 12.5V7M34 51v5.5M17.5 29H12M56 29h-5.5'
      + 'M45.6 17.4l3.9-3.9M22.4 40.6l-3.9 3.9M45.6 40.6l3.9 3.9M22.4 17.4l-3.9-3.9"/>',
  },
  moon: {
    tone: 'moon',
    flat: '<path d="M11 33c0-12 9-22 21-22s22 9 22 21-10 22-22 22-21-9-21-21z"/>',
    ink: '<path d="M41 13a20 20 0 1 0 13 33 22 22 0 0 1-13-33z"/>',
  },
  partly: {
    tone: 'sun',
    flat: '<path d="M14 24c-1-8 5-15 13-15s14 5 15 13-5 15-13 16-14-6-15-14z"/>',
    ink: '<circle cx="25" cy="22" r="8"/>'
      + '<path d="M25 9V5M12 22H8M34.4 12.6l2.8-2.8M15.6 12.6l-2.8-2.8"/>'
      + '<path d="M22 51h24a8.5 8.5 0 0 0 1-17 12 12 0 0 0-23-2.5A8.8 8.8 0 0 0 22 51z"/>',
  },
  partlyNight: {
    tone: 'moon',
    flat: '<path d="M14 24c-1-8 5-15 13-15s14 5 15 13-5 15-13 16-14-6-15-14z"/>',
    ink: '<path d="M30 10a11 11 0 1 0 7 18 12 12 0 0 1-7-18z"/>'
      + '<path d="M22 51h24a8.5 8.5 0 0 0 1-17 12 12 0 0 0-23-2.5A8.8 8.8 0 0 0 22 51z"/>',
  },
  cloud: {
    tone: 'cloud',
    flat: '<path d="M13 45h25a9 9 0 0 0 1-18 13 13 0 0 0-24-2.5A9.3 9.3 0 0 0 13 45z"/>',
    ink: '<path d="M19 48h26a9 9 0 0 0 1-18 13 13 0 0 0-25-2.6A9.4 9.4 0 0 0 19 48z"/>',
  },
  rain: {
    tone: 'rain',
    flat: '<path d="M12 38h25a9 9 0 0 0 1-18 13 13 0 0 0-24-2.5A9.3 9.3 0 0 0 12 38z"/>',
    ink: '<path d="M18 41h26a9 9 0 0 0 1-18 13 13 0 0 0-25-2.6A9.4 9.4 0 0 0 18 41z"/>'
      + '<path d="M23 47l-3 8M33 47l-3 8M43 47l-3 8"/>',
  },
  drizzle: {
    tone: 'rain',
    flat: '<path d="M12 38h25a9 9 0 0 0 1-18 13 13 0 0 0-24-2.5A9.3 9.3 0 0 0 12 38z"/>',
    ink: '<path d="M18 41h26a9 9 0 0 0 1-18 13 13 0 0 0-25-2.6A9.4 9.4 0 0 0 18 41z"/>'
      + '<path d="M25 48v4M35 48v4M45 48v4"/>',
  },
  storm: {
    tone: 'storm',
    flat: '<path d="M12 36h25a9 9 0 0 0 1-18 13 13 0 0 0-24-2.5A9.3 9.3 0 0 0 12 36z"/>',
    ink: '<path d="M18 39h26a9 9 0 0 0 1-18 13 13 0 0 0-25-2.6A9.4 9.4 0 0 0 18 39z"/>'
      + '<path d="M34 43l-10 12h9l-3 10 11-13h-9z"/>',
  },
  snow: {
    tone: 'snow',
    flat: '<path d="M14 40c-3-12 4-24 16-26 11-2 21 5 22 16 1 10-8 19-19 20s-17-4-19-10z"/>',
    ink: '<path d="M32 15v34M17 24l30 16M47 24L17 40"/>'
      + '<path d="M27 19l5 5 5-5M27 45l5-5 5 5"/>',
  },
  fog: {
    tone: 'fog',
    flat: '<path d="M16 22c0-4 5-7 10-7s10 3 10 7-4 7-10 7-10-3-10-7z"/>'
      + '<path d="M32 42c0-4 5-7 11-7s10 3 10 7-4 7-10 7-11-3-11-7z"/>',
    ink: '<path d="M9 20c4-4 8-4 12 0s8 4 12 0 8-4 12 0 8 4 12 0"/>'
      + '<path d="M9 32c4-4 8-4 12 0s8 4 12 0 8-4 12 0 8 4 12 0"/>'
      + '<path d="M9 44c4-4 8-4 12 0s8 4 12 0 8-4 12 0 8 4 12 0"/>',
  },
  dust: {
    tone: 'dust',
    flat: '<path d="M10 26c0-8 9-14 20-14s22 5 23 13-9 15-21 15-22-6-22-14z"/>',
    ink: '<path d="M8 20h28a7 7 0 1 0-7-8"/>'
      + '<path d="M8 32h36a7 7 0 1 1-7 8"/>'
      + '<path d="M8 44h21a6 6 0 1 0-6-7"/>',
  },
  wind: {
    tone: 'wind',
    flat: '<path d="M12 28c0-9 9-16 21-16s22 6 22 15-10 16-22 16-21-7-21-15z"/>',
    ink: '<path d="M8 22h27a7.5 7.5 0 1 0-7-9"/>'
      + '<path d="M8 34h30a7.5 7.5 0 1 1-7 9"/>'
      + '<path d="M8 46h17a6 6 0 1 0-6-7"/>',
  },
  heat: {
    tone: 'heat',
    flat: '<path d="M22 44c0-10 6-18 14-19s16 6 16 16-7 18-16 18-14-6-14-15z"/>',
    ink: '<path d="M31 36V14a5.5 5.5 0 1 1 11 0v22a10 10 0 1 1-11 0z"/>'
      + '<circle cx="36.5" cy="45" r="4.5" fill="currentColor" stroke="none"/>'
      + '<path d="M14 18h9M14 27h9M14 36h9"/>',
  },
  ban: {
    tone: 'heat',
    flat: '<circle cx="30" cy="30" r="19"/>',
    ink: '<circle cx="33" cy="33" r="19"/><path d="M19.5 46.5l27-27"/>',
  },
};

/**
 * @param {string} name
 * @param {{size?: number, className?: string}} options
 * @returns {string} an <svg> with the flat shape behind the linework
 */
export function art(name, { size = 64, className = '' } = {}) {
  const piece = ART[name] || ART.cloud;
  return `<svg class="art art--${piece.tone} ${className}" width="${size}" height="${size}"
    viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <g class="art-flat" fill="var(--flat-${piece.tone})" stroke="none">${piece.flat}</g>
    <g class="art-ink" fill="none" stroke="currentColor" stroke-width="2.6"
       stroke-linecap="round" stroke-linejoin="round">${piece.ink}</g>
  </svg>`;
}

export const ART_NAMES = Object.keys(ART);
export const TONES = [...new Set(Object.values(ART).map((a) => a.tone))];
