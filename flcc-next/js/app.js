// Boot, onboarding, navigation.
//
// Five destinations, a header that stays out of the way, and screens loaded on
// demand. The shell owns nothing but the frame.

import { h, clear, navIcon } from './core/dom.js';
import * as router from './core/router.js';
import { getUser, saveUser, mode, greeting, MODE } from './core/profile.js';
import { getProgress } from './core/progress.js';
import { poster, label, display, headline, pill, choice, art, toast } from './core/ui.js';

const TABS = [
  { name: 'today',   label: 'Today',   icon: 'today' },
  { name: 'explore', label: 'Explore', icon: 'explore' },
  { name: 'play',    label: 'Play',    icon: 'play' },
  { name: 'connect', label: 'Connect', icon: 'connect' },
  { name: 'me',      label: 'Me',      icon: 'me' },
];

const SCREENS = {
  today:   () => import('./screens/today.js'),
  explore: () => import('./screens/explore.js'),
  play:    () => import('./screens/play.js'),
  connect: () => import('./screens/connect.js'),
  me:      () => import('./screens/me.js'),
  journey: () => import('./screens/journey.js'),
  lesson:  () => import('./screens/lesson.js'),
  topic:   () => import('./screens/topic.js'),
  ask:     () => import('./screens/ask.js'),
  prayer:  () => import('./screens/prayer.js'),
  game:    () => import('./screens/game.js'),
  devotion:() => import('./screens/devotion.js'),
};
for (const [name, loader] of Object.entries(SCREENS)) router.define(name, loader);

const headEl = document.getElementById('app-head');
const screenEl = document.getElementById('screen');
const tabsEl = document.getElementById('tabs');

const ROOTS = new Set(TABS.map((tab) => tab.name));
const UNDER = { journey: 'explore', lesson: 'explore', topic: 'explore', game: 'play', prayer: 'connect', ask: 'connect', devotion: 'today' };

export function applyMode() {
  document.documentElement.dataset.mode = mode();
}

// ── Onboarding: four posters, no forms that look like forms ────────────────

function onboarding() {
  headEl.hidden = true;
  tabsEl.hidden = true;
  const draft = { interests: [] };
  let step = 0;

  const render = () => {
    clear(screenEl);
    screenEl.appendChild([intro, askName, askAge, askInterests][step]());
    screenEl.scrollTop = 0;
    window.scrollTo(0, 0);
  };
  const next = () => { step += 1; if (step > 3) finish(); else render(); };

  const finish = () => {
    saveUser({ name: draft.name, age: draft.age, interests: draft.interests });
    applyMode();
    router.go('today', { replace: true });
    boot();
  };

  const intro = () => poster({ tone: 'cream', tall: true, className: 'full' },
    label('FLCC NEXT'),
    h('div', {},
      display('THIS IS YOUR JOURNEY.'),
      h('p', { class: 'lead dim', style: 'margin-top:1.2rem', text: 'Grow in faith. Discover the Bible. Have fun along the way.' })),
    h('div', { class: 'poster-foot' }, pill('Start', next), art('rocket', { tone: 'cream', size: 'sm' })));

  const askName = () => {
    const input = h('input', { type: 'text', id: 'ob-name', maxlength: '24', autocomplete: 'off', placeholder: 'Type your name' });
    const warn = h('p', { class: 'label', style: 'color:#161616;opacity:.6' });
    const form = h('form', { onsubmit: (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) { warn.textContent = 'We need something to call you'; input.focus(); return; }
      draft.name = name;
      next();
    } }, input, h('div', { style: 'margin-top:1.6rem' }, pill('Next', null, { type: 'submit' })));

    const block = poster({ tone: 'blue', tall: true, className: 'full' },
      label('Step 1 of 3'),
      h('div', {}, display('WHAT’S YOUR NAME?'), h('div', { style: 'margin-top:1.6rem' }, form), warn),
      h('div', { class: 'poster-foot' }, h('span'), art('star', { tone: 'blue', size: 'sm' })));
    setTimeout(() => input.focus(), 60);
    return block;
  };

  const askAge = () => poster({ tone: 'sage', tall: true, className: 'full' },
    label('Step 2 of 3'),
    h('div', {},
      display('HOW OLD ARE YOU?'),
      h('div', { class: 'choice-list', style: 'margin-top:1.6rem' },
        ...[[MODE.kids, 10], [MODE.teens, 15]].map(([m, defaultAge]) =>
          choice(`${m.range}   ${m.label.toUpperCase()}`, () => {
            const input = h('input', { type: 'number', min: String(m.min), max: String(m.max), value: String(defaultAge),
              style: 'font-size:2rem;font-weight:800;text-align:center' });
            const holder = poster({ tone: 'sage', tall: true, className: 'full' },
              label(`${m.label} · ${m.range}`),
              h('div', {}, display('HOW OLD EXACTLY?'), h('div', { style: 'margin-top:1.4rem' }, input)),
              h('div', { class: 'poster-foot' }, pill('That’s me', () => {
                const age = Math.min(m.max, Math.max(m.min, Number(input.value) || defaultAge));
                draft.age = age;
                next();
              }), art(m === MODE.kids ? 'plant' : 'mountain', { tone: 'sage', size: 'sm' })));
            clear(screenEl).appendChild(holder);
          })))),
    h('div', { class: 'poster-foot' }, h('span'), art('people', { tone: 'sage', size: 'sm' })));

  const askInterests = () => {
    const options = [['bible', 'THE BIBLE', 'book'], ['prayer', 'PRAYER', 'hands'], ['games', 'GAMES', 'grid'], ['real', 'REAL LIFE', 'bulb']];
    const chosen = new Set();
    const list = h('div', { class: 'choice-list', style: 'margin-top:1.6rem' },
      ...options.map(([id, text]) => {
        const button = choice(text, () => {
          if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
          button.setAttribute('aria-pressed', String(chosen.has(id)));
        }, { 'aria-pressed': 'false' });
        return button;
      }));

    return poster({ tone: 'pink', tall: true, className: 'full' },
      label('Step 3 of 3'),
      h('div', {}, display('WHAT DO YOU WANT TO EXPLORE?'), list),
      h('div', { class: 'poster-foot' },
        pill('Let’s go', () => { draft.interests = [...chosen]; next(); }),
        art('light', { tone: 'pink', size: 'sm' })));
  };

  render();
}

// ── Frame ──────────────────────────────────────────────────────────────────

function renderTabs(active) {
  clear(tabsEl);
  for (const tab of TABS) {
    const button = h('button', { class: 'tab', type: 'button', onclick: () => router.go(tab.name) },
      navIcon(tab.icon), h('span', { text: tab.label }));
    if (tab.name === active) button.setAttribute('aria-current', 'page');
    tabsEl.appendChild(button);
  }
  tabsEl.hidden = false;
}

function renderHead(view, route) {
  clear(headEl);
  const user = getUser() || {};
  if (ROOTS.has(route.name) && route.name === 'today') {
    const streak = getProgress().streak.count;
    headEl.append(
      h('div', {},
        h('p', { class: 'label dimmer', text: greeting() }),
        h('p', { class: 'headline', style: 'margin-top:.35rem', text: (user.name || 'Friend').toUpperCase() })),
      streak > 0 ? h('span', { class: 'streak', title: `${streak} day streak` }, `${streak} day${streak === 1 ? '' : 's'}`) : h('span'));
  } else if (ROOTS.has(route.name)) {
    headEl.append(h('p', { class: 'headline', text: (view.title || '').toUpperCase() }), h('span'));
  } else {
    headEl.append(
      h('button', { class: 'go', type: 'button', style: 'font-size:.8rem;letter-spacing:.12em;text-transform:uppercase',
        onclick: () => router.back() }, '← Back'),
      h('p', { class: 'label dimmer', text: view.title || '' }));
  }
  headEl.hidden = false;
}

async function show(route, module) {
  const context = {
    route,
    user: getUser(),
    mode: mode(),
    go: router.go,
    back: router.back,
    toast,
    refresh: () => show(route, module),
  };

  clear(screenEl);
  let view;
  try {
    view = await module.default(context);
  } catch (error) {
    view = { title: 'Something broke', el: poster({ tone: 'pink', className: 'full' },
      label('Sorry'), headline('THAT SCREEN DID NOT OPEN'), h('p', { class: 'body dim', text: String(error && error.message || error) })) };
  }

  screenEl.appendChild(view.el);
  renderHead(view, route);
  renderTabs(ROOTS.has(route.name) ? route.name : UNDER[route.name] || null);
  screenEl.scrollTop = 0;
  window.scrollTo(0, 0);
}

function boot() {
  applyMode();
  if (!getUser()) { onboarding(); return; }
  router.start(show);
}

boot();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
  });
}
