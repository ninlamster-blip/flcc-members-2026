/**
 * Larger, one-off decorative scenes — as opposed to the small per-concept
 * icons in dom.js. Just the dashboard hero art for now. Same constraint as
 * everything else here: no build step, no image pipeline, so this is a
 * hand-authored inline SVG string, not a shipped asset.
 */

import { h } from './dom.js';

const DASHBOARD_HERO_SVG = `
<svg viewBox="0 0 1600 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="heroSky" x1="0" y1="0" x2="0.75" y2="1">
      <stop offset="0%" stop-color="#e7f5ec"/>
      <stop offset="55%" stop-color="#f6f2da"/>
      <stop offset="100%" stop-color="#fbe9cd"/>
    </linearGradient>
    <radialGradient id="heroSun" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffdf3" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#fff3c9" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#fff3c9" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="1600" height="500" fill="url(#heroSky)"/>

  <circle cx="250" cy="335" r="150" fill="url(#heroSun)"/>
  <circle cx="250" cy="335" r="40" fill="#fffaf0"/>

  <g stroke="#5b6b60" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6">
    <path d="M150 225 q10 -12 20 0 q10 -12 20 0"/>
    <path d="M205 252 q8 -9 16 0 q8 -9 16 0"/>
  </g>

  <g fill="#ffffff" opacity="0.8">
    <ellipse cx="1330" cy="108" rx="55" ry="21"/>
    <ellipse cx="1380" cy="96" rx="40" ry="17"/>
    <ellipse cx="1288" cy="98" rx="32" ry="14"/>
  </g>
  <g fill="#ffffff" opacity="0.55">
    <ellipse cx="610" cy="66" rx="46" ry="16"/>
    <ellipse cx="652" cy="56" rx="28" ry="11"/>
  </g>

  <path d="M0 330 C 150 280, 300 300, 460 260 C 620 220, 760 300, 920 270
           C 1080 240, 1220 290, 1380 250 C 1470 226, 1550 245, 1600 235
           L1600 500 L0 500 Z" fill="#c7d9cd" opacity="0.6"/>

  <path d="M0 382 C 180 332, 340 362, 520 332 C 680 307, 820 352, 980 322
           C 1120 297, 1260 242, 1600 300 L1600 500 L0 500 Z" fill="#aad19d"/>

  <path d="M0 432 C 160 402, 300 422, 440 402 C 600 380, 760 422, 920 402
           C 1040 387, 1140 302, 1270 264 C 1360 238, 1480 302, 1600 340
           L1600 500 L0 500 Z" fill="#7fbb72"/>

  <g fill="#3f7d46" opacity="0.9">
    <path d="M330 402 q9 -34 0 -46 q-9 12 0 46 Z"/>
    <path d="M356 406 q7 -26 0 -35 q-7 9 0 35 Z"/>
    <path d="M980 404 q9 -34 0 -46 q-9 12 0 46 Z"/>
  </g>

  <path d="M0 480 C 200 450, 380 470, 560 452 C 760 432, 900 470, 1100 452
           C 1280 436, 1420 460, 1600 440 L1600 500 L0 500 Z" fill="#4f9750"/>

  <path d="M1432 440 C 1372 410, 1362 372, 1312 342 C 1282 324, 1292 298, 1270 272"
        stroke="#eee2bd" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.85"/>

  <g>
    <ellipse cx="1270" cy="268" rx="48" ry="9" fill="#3f7d46" opacity="0.35"/>
    <path d="M1214 272 q9 -40 0 -54 q-9 14 0 54 Z" fill="#3f7d46"/>
    <path d="M1320 270 q9 -34 0 -46 q-9 12 0 46 Z" fill="#3f7d46"/>
    <rect x="1238" y="230" width="64" height="42" fill="#f6f1e2"/>
    <rect x="1252" y="248" width="12" height="22" fill="#c7bfa0"/>
    <rect x="1274" y="240" width="10" height="10" fill="#c7bfa0"/>
    <polygon points="1238,230 1270,198 1302,230" fill="#5b6b55"/>
    <rect x="1260" y="178" width="20" height="30" fill="#f6f1e2"/>
    <polygon points="1260,178 1270,162 1280,178" fill="#5b6b55"/>
    <line x1="1270" y1="162" x2="1270" y2="146" stroke="#3d4a38" stroke-width="3"/>
    <line x1="1263" y1="152" x2="1277" y2="152" stroke="#3d4a38" stroke-width="3"/>
  </g>

  <path d="M0 500 C 10 440, 40 410, 30 360 C 55 400, 60 440, 40 480
           C 60 450, 90 430, 100 460 C 80 480, 60 500, 0 500 Z" fill="#2c5230"/>
  <path d="M1600 500 C 1585 445, 1550 420, 1560 370 C 1535 410, 1525 450, 1548 485
           C 1525 460, 1500 445, 1490 470 C 1512 490, 1540 500, 1600 500 Z" fill="#2c5230" opacity="0.9"/>
</svg>
`.trim();

/** A sunrise-over-hills scene with a hilltop church — the dashboard hero's background art. */
export function dashboardHeroArt() {
  return h('div.hero-art', { 'aria-hidden': 'true', html: DASHBOARD_HERO_SVG });
}
