// The illustration system.
//
// Every scene is drawn here from one small kit of shapes and one fixed palette,
// so fourteen stories look like fourteen pictures by the same hand rather than
// fourteen stock images. Flat paper-cut shapes, a warm limited palette, one
// grain texture over the top — the look is printed picture-book, not gradient
// mesh. Nothing here loads a file: the whole set is a few kilobytes of SVG.

export const INK = {
  night:  '#22303A',
  deep:   '#2E4A55',
  sky:    '#8FB8C9',
  pale:   '#CFE0E4',
  cream:  '#F4E9D8',
  sand:   '#E8C49A',
  clay:   '#C6613A',
  gold:   '#E0A845',
  olive:  '#7C8B5A',
  moss:   '#5A6B45',
  plum:   '#7A4A5E',
  stone:  '#B9A995',
};

const W = 300;
const H = 200;

// ── The kit ─────────────────────────────────────────────────────────────────

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, width = 3) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;

const sky = (fill) => rect(0, 0, W, H, fill);

/** A soft hill. `lift` is how high it rises, `at` where its crown sits. */
const hill = (baseY, lift, at, fill) =>
  path(`M-10 ${H + 10}L-10 ${baseY}Q${at} ${baseY - lift} ${W + 10} ${baseY}L${W + 10} ${H + 10}Z`, fill);

const ground = (y, fill) => rect(-10, y, W + 20, H - y + 10, fill);

/** Water with two wave crests, flat enough to read as a surface. */
const water = (y, fill) =>
  path(`M-10 ${H + 10}L-10 ${y}q38 -9 75 0t75 0t75 0t75 0L${W + 10} ${H + 10}Z`, fill);

const sun = (cx, cy, r, fill) => circle(cx, cy, r, fill);

const rays = (cx, cy, r, fill) => Array.from({ length: 8 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 8 + 0.2;
  const x1 = cx + Math.cos(a) * (r + 5);
  const y1 = cy + Math.sin(a) * (r + 5);
  const x2 = cx + Math.cos(a) * (r + 13);
  const y2 = cy + Math.sin(a) * (r + 13);
  return line(x1, y1, x2, y2, fill, 3);
}).join('');

const star = (cx, cy, s, fill) =>
  path(`M${cx} ${cy - s}L${cx + s * 0.28} ${cy - s * 0.3}L${cx + s} ${cy}L${cx + s * 0.28} ${cy + s * 0.3}L${cx} ${cy + s}L${cx - s * 0.28} ${cy + s * 0.3}L${cx - s} ${cy}L${cx - s * 0.28} ${cy - s * 0.3}Z`, fill);

/** Scattered dots, seeded so a scene is identical every time it is drawn. */
const scatter = (count, fill, seed = 1, box = { x: 0, y: 0, w: W, h: 90 }, size = 1.6) => {
  let value = seed * 9301 + 49297;
  const next = () => ((value = (value * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, () =>
    circle(box.x + next() * box.w, box.y + next() * box.h, size * (0.5 + next()), fill)).join('');
};

/**
 * A person. Deliberately simple — a head, a robe, two legs — so that the
 * characters read as figures in a picture rather than as cartoon faces.
 */
const figure = (x, baseY, h, { robe = INK.clay, skin = INK.sand, arm = null, staff = false } = {}) => {
  const headR = h * 0.16;
  const headY = baseY - h + headR;
  const bodyTop = headY + headR * 1.1;
  const bodyW = h * 0.34;
  return [
    staff ? line(x + bodyW * 0.7, baseY, x + bodyW * 0.55, baseY - h * 1.05, INK.stone, 2.5) : '',
    path(`M${x - bodyW / 2} ${baseY}Q${x - bodyW / 2} ${bodyTop} ${x} ${bodyTop}Q${x + bodyW / 2} ${bodyTop} ${x + bodyW / 2} ${baseY}Z`, robe),
    arm === 'up' ? line(x + bodyW * 0.35, bodyTop + h * 0.14, x + bodyW * 0.95, bodyTop - h * 0.1, robe, h * 0.1) : '',
    arm === 'out' ? line(x - bodyW * 0.35, bodyTop + h * 0.18, x - bodyW * 1.05, bodyTop + h * 0.08, robe, h * 0.1) : '',
    circle(x, headY, headR, skin),
  ].join('');
};

/** A figure whose robe is woven from bands — the coat everyone noticed. */
const stripedFigure = (x, baseY, h, colours) => {
  const headR = h * 0.16;
  const headY = baseY - h + headR;
  const bodyTop = headY + headR * 1.15;
  const bodyW = h * 0.33;
  const band = (baseY - bodyTop) / colours.length;
  const clip = `coat${Math.round(x)}`;
  return [
    `<clipPath id="${clip}"><path d="M${x - bodyW / 2} ${baseY}Q${x - bodyW / 2} ${bodyTop} ${x} ${bodyTop}Q${x + bodyW / 2} ${bodyTop} ${x + bodyW / 2} ${baseY}Z"/></clipPath>`,
    `<g clip-path="url(#${clip})">`,
    colours.map((c, i) => rect(x - bodyW, bodyTop + i * band, bodyW * 2, band + 0.6, c)).join(''),
    '</g>',
    circle(x, headY, headR, INK.sand),
  ].join('');
};

/** A pack animal, seen from the side. */
const donkey = (x, baseY, w, fill = INK.stone) => [
  path(`M${x - w / 2} ${baseY - w * 0.28}q0 -${w * 0.2} ${w * 0.24} -${w * 0.2}h${w * 0.5}q${w * 0.26} 0 ${w * 0.26} ${w * 0.2}v${w * 0.06}h-${w}Z`, fill),
  line(x - w * 0.32, baseY - w * 0.26, x - w * 0.32, baseY, fill, w * 0.1),
  line(x + w * 0.3, baseY - w * 0.26, x + w * 0.3, baseY, fill, w * 0.1),
  path(`M${x + w * 0.4} ${baseY - w * 0.3}l${w * 0.18} -${w * 0.26}l${w * 0.14} ${w * 0.06}l-${w * 0.1} ${w * 0.3}Z`, fill),
  line(x + w * 0.56, baseY - w * 0.56, x + w * 0.52, baseY - w * 0.7, fill, w * 0.07),
].join('');

const tree = (x, baseY, h, leaf = INK.moss) => [
  line(x, baseY, x, baseY - h * 0.55, INK.deep, h * 0.09),
  circle(x, baseY - h * 0.72, h * 0.3, leaf),
  circle(x - h * 0.2, baseY - h * 0.55, h * 0.2, leaf),
  circle(x + h * 0.21, baseY - h * 0.57, h * 0.19, leaf),
].join('');

const flame = (x, y, s, outer = INK.clay, inner = INK.gold) => [
  path(`M${x} ${y - s}c${s * 0.7} ${s * 0.75} ${s * 0.55} ${s * 1.05} ${s * 0.02} ${s}c-${s * 0.6} ${s * 0.05} -${s * 0.72} -${s * 0.25} -${s * 0.02} -${s}Z`, outer),
  path(`M${x} ${y - s * 0.45}c${s * 0.34} ${s * 0.4} ${s * 0.26} ${s * 0.55} 0 ${s * 0.45}c-${s * 0.3} ${0} -${s * 0.34} -${s * 0.14} 0 -${s * 0.45}Z`, inner),
].join('');

const arch = (x, y, w, h, fill) =>
  path(`M${x} ${y + h}L${x} ${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0L${x + w} ${y + h}Z`, fill);

const boat = (cx, y, w, hull = INK.deep, sail = INK.cream) => [
  path(`M${cx - w / 2} ${y}q${w / 2} ${w * 0.34} ${w} 0Z`, hull),
  line(cx, y, cx, y - w * 0.62, INK.stone, 2.5),
  path(`M${cx + 2} ${y - w * 0.6}L${cx + w * 0.4} ${y - w * 0.06}L${cx + 2} ${y - w * 0.06}Z`, sail),
].join('');

const grain = (id) => `
  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.11"/></feComponentTransfer>
    <feComposite operator="in" in2="SourceGraphic"/>
  </filter>`;

// ── The fourteen scenes ─────────────────────────────────────────────────────

const SCENES = {
  // "Let there be light" — darkness on one side, first light on the other.
  creation: () => [
    sky(INK.night),
    scatter(52, INK.pale, 3, { x: 0, y: 4, w: 170, h: 130 }),
    star(46, 34, 8, INK.pale),
    path('M300 0L300 200L120 200q64 -100 0 -200Z', INK.deep),
    sun(214, 84, 40, INK.gold), rays(214, 84, 40, INK.gold),
    water(148, INK.deep),
    hill(160, 34, 70, INK.moss),
  ],
  noah: () => [
    sky(INK.pale),
    // A bow, not a rainbow of stripes: four muted bands, behind everything.
    ...[[INK.clay, 132], [INK.gold, 122], [INK.olive, 112], [INK.sky, 102]].map(([c, r]) =>
      path(`M${150 - r} 210a${r} ${r} 0 0 1 ${r * 2} 0`, 'none', `stroke="${c}" stroke-width="7" fill="none" opacity="0.8"`)),
    water(146, INK.deep),
    // The ark: a long hull, a house along its length, one open door.
    path('M46 128q104 46 208 0l-16 40q-88 26 -176 0Z', INK.clay),
    rect(78, 92, 144, 36, INK.sand),
    path('M70 92L150 66L230 92Z', INK.stone),
    rect(140, 104, 20, 24, INK.deep),
    ...[96, 118, 182, 204].map((x) => rect(x, 104, 12, 12, INK.night)),
  ],
  abraham: () => [
    sky(INK.night),
    scatter(70, INK.cream, 11, { x: 0, y: 4, w: W, h: 128 }, 1.5),
    star(206, 40, 9, INK.gold),
    ground(152, INK.deep),
    path('M186 152L226 96L266 152Z', INK.sand),
    figure(108, 152, 54, { robe: INK.plum, arm: 'up', staff: true }),
  ],
  joseph: () => [
    sky(INK.sand),
    sun(242, 44, 24, INK.gold),
    path('M120 158L182 100L244 158Z', INK.stone),
    path('M188 160L246 108L304 160Z', INK.clay),
    ground(158, INK.olive),
    stripedFigure(76, 164, 100, [INK.clay, INK.gold, INK.plum, INK.deep, INK.olive, INK.clay]),
  ],
  'moses-red-sea': () => [
    sky(INK.night),
    scatter(28, INK.pale, 7, { x: 0, y: 4, w: W, h: 62 }),
    // Two standing walls of water, and dry ground opening between them.
    path('M-10 210L-10 40q30 12 58 0t34 14v156Z', INK.deep),
    path('M310 210L310 40q-30 12 -58 0t-34 14v156Z', INK.deep),
    path('M82 210L112 96h76l30 114Z', INK.sand),
    // Walking away from us, up the path — smaller with distance.
    figure(150, 202, 58, { robe: INK.clay, arm: 'up', staff: true }),
    figure(122, 168, 38, { robe: INK.plum }),
    figure(178, 160, 32, { robe: INK.olive }),
    figure(150, 140, 24, { robe: INK.stone }),
  ],
  'david-goliath': () => [
    sky(INK.pale),
    hill(150, 26, 60, INK.olive),
    ground(158, INK.sand),
    // The giant is a silhouette, and deliberately cropped by the frame.
    path('M212 158L212 78q0 -26 26 -26t26 26L264 158Z', INK.deep),
    circle(238, 44, 17, INK.deep),
    line(272 - 2, 158, 268, 44, INK.night, 5),
    figure(88, 158, 52, { robe: INK.clay, arm: 'up' }),
    // Five smooth stones.
    ...[0, 1, 2, 3, 4].map((i) => circle(52 + i * 9, 168, 3.4, INK.stone)),
  ],
  'daniel-lions': () => [
    sky(INK.night),
    arch(52, 26, 196, 150, INK.deep),
    arch(64, 38, 172, 138, INK.night),
    figure(150, 168, 64, { robe: INK.cream, skin: INK.sand }),
    // Two lions at rest — manes, muzzles, and mouths that stay shut.
    ...[[90, 174], [212, 174]].map(([x, y]) => [
      path(`M${x - 22} ${y}q2 -24 22 -24t22 24Z`, INK.clay),
      circle(x, y - 24, 15, INK.gold),
      circle(x, y - 19, 9, INK.sand),
      circle(x - 5, y - 26, 1.8, INK.night),
      circle(x + 5, y - 26, 1.8, INK.night),
      path(`M${x - 4} ${y - 17}q4 3 8 0`, 'none', `stroke="${INK.night}" stroke-width="1.6" fill="none" stroke-linecap="round"`),
    ].join('')),
  ],
  esther: () => [
    sky(INK.plum),
    ...[46, 150, 254].map((x) => arch(x - 34, 40, 68, 132, INK.deep)),
    ground(172, INK.night),
    figure(150, 172, 68, { robe: INK.gold, skin: INK.sand }),
    // The crown sits above her, clear of the head.
    path('M136 96h28l-3 -15 -7 7 -4 -10 -4 10 -7 -7Z', INK.cream),
  ],
  jonah: () => [
    sky(INK.deep),
    scatter(24, INK.pale, 13, { x: 0, y: 6, w: W, h: 60 }, 1.3),
    water(112, INK.night),
    // The great fish, filling most of the frame.
    path('M40 158q60 -62 150 -30t70 40q-40 26 -104 20t-116 -30Z', INK.sky),
    path('M256 152q26 -20 44 -22 -8 24 2 44 -22 -6 -46 -22Z', INK.sky),
    circle(96, 142, 6, INK.night),
    path('M56 156q22 10 44 6', 'none', `stroke="${INK.deep}" stroke-width="3" fill="none" stroke-linecap="round"`),
    boat(232, 96, 40),
  ],
  'birth-of-jesus': () => [
    sky(INK.night),
    scatter(40, INK.pale, 19, { x: 0, y: 4, w: W, h: 110 }),
    star(150, 40, 15, INK.gold),
    line(150, 52, 150, 104, INK.gold, 2),
    // The stable: a roof, two posts, a manger.
    path('M60 116L150 66L240 116Z', INK.clay),
    rect(70, 116, 10, 62, INK.deep),
    rect(220, 116, 10, 62, INK.deep),
    ground(172, INK.deep),
    path('M124 168q26 -22 52 0Z', INK.sand),
    circle(150, 156, 10, INK.cream),
  ],
  'jesus-calms-the-storm': () => [
    sky(INK.sky),
    // The storm rolls off on the diagonal; behind it the water is already still.
    path('M-10 -10L200 -10L96 210L-10 210Z', INK.night),
    scatter(22, INK.pale, 23, { x: 0, y: 10, w: 150, h: 80 }, 1.4),
    line(52, 22, 40, 56, INK.gold, 3), line(40, 56, 56, 54, INK.gold, 3), line(56, 54, 44, 86, INK.gold, 3),
    path('M-10 200L-10 138q30 -22 62 -6t70 -10v78Z', INK.deep),
    path('M122 200v-72q44 -10 92 0t96 -6v78Z', INK.pale),
    boat(184, 132, 58, INK.clay, INK.cream),
  ],
  'good-samaritan': () => [
    sky(INK.pale),
    hill(116, 24, 40, INK.olive),
    ground(124, INK.sand),
    // The road down to Jericho, running away into the hills.
    path('M20 210L110 124h48L104 210Z', INK.stone),
    // The two who crossed to the other side, already small in the distance.
    figure(180, 122, 18, { robe: INK.deep }),
    figure(196, 118, 15, { robe: INK.night }),
    donkey(238, 172, 54),
    // The wounded man on the road, and the one who stopped, kneeling by him.
    path('M52 186q36 -16 72 -4l-3 13q-36 10 -72 2Z', INK.plum),
    circle(48, 182, 11, INK.sand),
    path('M140 190q-7 -38 18 -40t24 40Z', INK.clay),
    circle(164, 138, 12, INK.sand),
    line(148, 168, 118, 178, INK.clay, 8),
  ],
  'cross-and-resurrection': () => [
    sky(INK.sand),
    sun(228, 66, 30, INK.gold),
    hill(150, 24, 210, INK.olive),
    ground(158, INK.moss),
    // The tomb, open, with the stone rolled aside.
    path('M40 158L40 108a44 44 0 0 1 88 0v50Z', INK.stone),
    path('M56 158L56 112a28 28 0 0 1 56 0v46Z', INK.night),
    circle(154, 140, 20, INK.stone),
    // Three crosses on the hill behind.
    ...[[200, 82, 34], [234, 66, 46], [268, 84, 32]].map(([x, y, h]) =>
      line(x, y + h, x, y, INK.deep, 5) + line(x - 10, y + h * 0.3, x + 10, y + h * 0.3, INK.deep, 5)),
  ],
  pentecost: () => [
    sky(INK.deep),
    ...[46, 150, 254].map((x, i) => rect(x - 30, 60 + i * 6, 60, 120, INK.night)),
    ground(170, INK.night),
    figure(96, 172, 48, { robe: INK.plum }),
    figure(150, 174, 52, { robe: INK.clay }),
    figure(204, 172, 48, { robe: INK.olive }),
    flame(96, 108, 13),
    flame(150, 104, 15),
    flame(204, 108, 13),
    scatter(18, INK.gold, 29, { x: 40, y: 20, w: 220, h: 60 }, 1.3),
  ],
};

export const SCENE_IDS = Object.keys(SCENES);

export function hasScene(id) {
  return Object.prototype.hasOwnProperty.call(SCENES, id);
}

/**
 * One scene as an SVG string. Self-contained: no external references, no
 * script, no fetch — safe to drop straight into the page.
 */
export function scene(id, { title = '', grainId = null } = {}) {
  const draw = SCENES[id];
  if (!draw) return '';
  const filterId = grainId || `grain-${id}`;
  return [
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img"`,
    title ? ` aria-label="${title.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"',
    '>',
    `<defs>${grain(filterId)}</defs>`,
    `<g>${draw().join('')}</g>`,
    `<rect width="${W}" height="${H}" filter="url(#${filterId})" fill="${INK.cream}" opacity="0.5"/>`,
    '</svg>',
  ].join('');
}

/** The time-of-day scene on Today, for the bands that still want a picture. */
export function daypart(hour = new Date().getHours()) {
  if (hour < 12) {
    return `<svg viewBox="0 0 ${W} 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${sky(INK.pale)}${sun(238, 34, 22, INK.gold)}${rays(238, 34, 22, INK.gold)}
      ${hill(78, 26, 70, INK.olive)}${hill(92, 18, 220, INK.moss)}${tree(48, 96, 40)}</svg>`;
  }
  if (hour < 17) {
    return `<svg viewBox="0 0 ${W} 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${sky(INK.sky)}${sun(60, 30, 20, INK.gold)}
      ${scatter(6, INK.cream, 2, { x: 20, y: 12, w: 260, h: 30 }, 5)}
      ${hill(84, 22, 180, INK.moss)}${tree(240, 98, 44)}</svg>`;
  }
  return `<svg viewBox="0 0 ${W} 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${sky(INK.night)}${scatter(34, INK.pale, 6, { x: 0, y: 4, w: W, h: 70 })}
    ${circle(238, 32, 18, INK.cream)}${circle(230, 27, 16, INK.night)}
    ${hill(80, 24, 90, INK.deep)}</svg>`;
}
