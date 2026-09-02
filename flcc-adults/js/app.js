// Boot, onboarding, navigation.
//
// Five destinations, a header that stays out of the way, and screens loaded on
// demand. The shell owns nothing but the frame: a screen returns
// `{ title, el }` and never touches the header or the tab bar.
//
// The frame is the kids and teens edition's frame — the same header, the same
// tab bar, the same uppercase page names. The one thing missing from it is the
// streak badge, because this edition keeps no streak.

import { h, clear, navIcon } from './core/dom.js';
import * as router from './core/router.js';
import { getUser, saveUser, greeting, firstName, SEASONS, FOCUS } from './core/profile.js';
import { poster, label, display, headline, lead, pill, choice, art, toast } from './core/ui.js';

const TABS = [
  { name: 'today',     label: 'Today',     icon: 'today' },
  { name: 'explore',   label: 'Explore',   icon: 'explore' },
  { name: 'community', label: 'Community', icon: 'community' },
  { name: 'watch',     label: 'Watch',     icon: 'watch' },
  { name: 'you',       label: 'You',       icon: 'you' },
];

const SCREENS = {
  today:     () => import('./screens/today.js'),
  explore:   () => import('./screens/explore.js'),
  community: () => import('./screens/community.js'),
  watch:     () => import('./screens/watch.js'),
  you:       () => import('./screens/you.js'),
  bible:     () => import('./screens/bible.js'),
  pray:      () => import('./screens/pray.js'),
  grow:      () => import('./screens/grow.js'),
  moment:    () => import('./screens/moment.js'),
  message:   () => import('./screens/message.js'),
  path:      () => import('./screens/path.js'),
  session:   () => import('./screens/session.js'),
  guide:     () => import('./screens/guide.js'),
  plan:      () => import('./screens/plan.js'),
};
for (const [name, loader] of Object.entries(SCREENS)) router.define(name, loader);

const headEl = document.getElementById('app-head');
const screenEl = document.getElementById('screen');
const tabsEl = document.getElementById('tabs');

const ROOTS = new Set(TABS.map((tab) => tab.name));

/**
 * Which tab a screen belongs under.
 *
 * Everything reachable from Explore stays lit as Explore, so a member three
 * taps into a learning path can still see where they are in the app. A screen
 * missing from here simply lights no tab, which is better than lighting the
 * wrong one.
 */
const UNDER = {
  moment:  'today',
  message: 'watch',
  bible:   'explore',
  pray:    'explore',
  grow:    'explore',
  path:    'explore',
  session: 'explore',
  guide:   'explore',
  plan:    'explore',
};

// ── Onboarding ─────────────────────────────────────────────────────────────
//
// Three questions, and none of them is required to be answered honestly for
// the app to work. Nothing here is verified, nothing is sent anywhere, and a
// reader who taps through without reading gets a working app.

function onboarding() {
  headEl.hidden = true;
  tabsEl.hidden = true;
  const draft = { focus: [] };
  let step = 0;

  const render = () => {
    clear(screenEl);
    screenEl.appendChild([intro, askName, askSeason, askFocus][step]());
    window.scrollTo(0, 0);
  };
  const next = () => { step += 1; if (step > 3) finish(); else render(); };

  const finish = () => {
    saveUser({ name: draft.name, season: draft.season, focus: draft.focus });
    router.go('today', { replace: true });
    boot();
  };

  const intro = () => poster({ tone: 'captain', tall: true },
    label('FLCC NEXT'),
    h('div', {},
      display('FAITH FOR REAL LIFE.'),
      h('p', { class: 'lead dim', style: 'margin-top:1.2rem',
        text: 'Scripture, prayer and teaching for the adults of FLCC — built for a life that is already full.' })),
    h('div', { class: 'poster-foot' },
      pill('Begin', next),
      art('church', { tone: 'captain', size: 'sm' })));

  const askName = () => {
    const input = h('input', { type: 'text', id: 'ob-name', maxlength: '40', autocomplete: 'name', placeholder: 'Your name' });
    const warn = h('p', { class: 'note' });
    const submit = () => {
      const name = input.value.trim();
      if (!name) { warn.textContent = 'We need something to call you.'; input.focus(); return; }
      draft.name = name;
      next();
    };
    const el = poster({ tone: 'sky', tall: true },
      label('One of three'),
      h('div', {},
        display('WHAT SHOULD WE CALL YOU?'),
        h('div', { style: 'margin-top:1.6rem' }, input),
        warn),
      h('div', { class: 'poster-foot' }, pill('Next', submit), art('blob', { tone: 'sky', size: 'sm' })));
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
    setTimeout(() => input.focus(), 60);
    return el;
  };

  const askSeason = () => poster({ tone: 'sunshine', tall: true },
    label('Two of three'),
    h('div', {},
      display('WHERE ARE YOU, HONESTLY?'),
      h('p', { class: 'body dim', style: 'margin-top:1rem',
        text: 'This only changes what we put in front of you first. You can change it whenever you like.' }),
      h('div', { class: 'choice-list', style: 'margin-top:1.4rem' },
        ...SEASONS.map((season) => choice(season.label, () => { draft.season = season.id; next(); })))),
    h('div', { class: 'poster-foot' }, h('span'), art('mountain', { tone: 'sunshine', size: 'sm' })));

  const askFocus = () => {
    const chosen = new Set();
    const list = h('div', { class: 'choice-list', style: 'margin-top:1.4rem' },
      ...FOCUS.map((one) => {
        const button = choice(one.label, () => {
          if (chosen.has(one.id)) chosen.delete(one.id); else chosen.add(one.id);
          button.setAttribute('aria-pressed', String(chosen.has(one.id)));
        }, { 'aria-pressed': 'false' });
        return button;
      }));

    return poster({ tone: 'rose', tall: true },
      label('Three of three'),
      h('div', {}, display('WHAT DID YOU COME FOR?'), list),
      h('div', { class: 'poster-foot' },
        pill('Finish', () => { draft.focus = [...chosen]; next(); }),
        art('sprout', { tone: 'rose', size: 'sm' })));
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
  if (route.name === 'today') {
    headEl.append(
      h('div', {},
        h('p', { class: 'label dimmer', text: greeting() }),
        h('p', { class: 'headline', style: 'margin-top:.35rem', text: firstName().toUpperCase() })),
      h('span'));
  } else if (ROOTS.has(route.name)) {
    headEl.append(h('p', { class: 'headline', text: (view.title || '').toUpperCase() }), h('span'));
  } else {
    headEl.append(
      h('button', { class: 'go', type: 'button', style: 'font-size:.8rem;letter-spacing:.12em;text-transform:uppercase',
        onclick: () => router.back('today') }, '← Back'),
      h('p', { class: 'label dimmer', text: view.title || '' }));
  }
  headEl.hidden = false;
}

async function show(route, module) {
  const context = {
    route,
    user: getUser(),
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
    view = { title: 'Something broke', el: poster({ tone: 'rose' },
      label('Sorry'),
      headline('THAT SCREEN DID NOT OPEN'),
      h('p', { class: 'note', text: String((error && error.message) || error) })) };
  }

  screenEl.appendChild(view.el);
  renderHead(view, route);
  renderTabs(ROOTS.has(route.name) ? route.name : UNDER[route.name] || null);
  window.scrollTo(0, 0);
}

function boot() {
  if (!getUser()) { onboarding(); return; }
  router.start(show);
}

boot();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
  });
}
