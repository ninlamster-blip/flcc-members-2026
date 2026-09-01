// Boot, onboarding, navigation.
//
// Five destinations, a header that stays out of the way, and screens loaded on
// demand. The shell owns the frame and nothing else: a screen returns
// `{ title, el }` and never touches the header or the tab bar.
//
// The header is deliberately thin. Every root screen sets its own title at
// display size inside the page — which is what an editorial layout does and
// what a chrome bar with a centred word in it does not — so up here there is
// room for the date, and one round control, and nothing else.

import { h, clear, navIcon } from './core/dom.js';
import * as router from './core/router.js';
import { getUser, saveUser, SEASONS, FOCUS } from './core/profile.js';
import { block, card, badge, display, lead, title, act, choice, toast } from './core/ui.js';

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

const longDate = () => new Date().toLocaleDateString(undefined,
  { weekday: 'long', day: 'numeric', month: 'long' });

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

  const intro = () => block({ tall: true, className: 'full' },
    h('div', {},
      badge('FLCC NEXT'),
      h('div', { style: 'margin-top:1rem' }, display('Faith for real life.')),
      h('p', { class: 'lead', style: 'margin-top:1rem',
        text: 'Scripture, prayer and teaching for the adults of FLCC — built for a life that is already full.' })),
    h('div', {},
      act('Begin', next),
      h('p', { class: 'cite', style: 'margin-top:1.2rem', text: 'FLCC Church · Kuwait' })));

  const askName = () => {
    const input = h('input', { type: 'text', id: 'ob-name', maxlength: '40', autocomplete: 'name', placeholder: 'Your name' });
    const warn = h('p', { class: 'small' });
    const form = h('form', { onsubmit: (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) { warn.textContent = 'We need something to call you.'; input.focus(); return; }
      draft.name = name;
      next();
    } }, input, h('div', { style: 'margin-top:1.6rem' }, act('Next', null, { type: 'submit' })));

    const el = card({ tone: 'paper', tall: true, className: 'full', foot: 'One of three' },
      badge('Your name'),
      h('div', {}, display('What should we call you?'), h('div', { style: 'margin-top:1.4rem' }, form), warn));
    setTimeout(() => input.focus(), 60);
    return el;
  };

  const askSeason = () => card({ tone: 'paper', className: 'full', foot: 'Two of three' },
    badge('Where you are'),
    h('div', {},
      display('Where are you, honestly?'),
      h('p', { class: 'lead', style: 'margin-top:.7rem', text: 'This only changes what we put in front of you first. You can change it whenever you like.' }),
      h('div', { class: 'choice-list', style: 'margin-top:1.2rem' },
        ...SEASONS.map((season) => choice(season.label, () => { draft.season = season.id; next(); })))));

  const askFocus = () => {
    const chosen = new Set();
    const list = h('div', { class: 'choice-list', style: 'margin-top:1.2rem' },
      ...FOCUS.map((one) => {
        const button = choice(one.label, () => {
          if (chosen.has(one.id)) chosen.delete(one.id); else chosen.add(one.id);
          button.setAttribute('aria-pressed', String(chosen.has(one.id)));
        }, { 'aria-pressed': 'false' });
        return button;
      }));

    return card({ tone: 'paper', className: 'full', foot: 'Three of three' },
      badge('What you came for'),
      h('div', {}, display('What did you come for?'), list),
      h('div', {}, act('Finish', () => { draft.focus = [...chosen]; next(); })));
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
  if (ROOTS.has(route.name)) {
    // Every root screen sets its own name inside the page, at display size, so
    // the header carries the date, one control, and nothing else. An earlier
    // draft repeated the greeting up here as well, which said the same thing
    // twice within forty pixels of itself.
    headEl.append(
      h('p', { class: 'day', text: longDate() }),
      route.name === 'you' ? h('span') : profileButton());
  } else {
    headEl.append(
      h('button', { class: 'back', type: 'button', 'aria-label': 'Back',
        onclick: () => router.back('today') }, '←'),
      h('p', { class: 'page-name', text: view.title || '' }));
  }
  headEl.hidden = false;
}

function profileButton() {
  const button = h('button', { class: 'head-btn', type: 'button', 'aria-label': 'You',
    onclick: () => router.go('you') });
  button.appendChild(navIcon('you'));
  return button;
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
    view = { title: 'Something broke', el: card({ tone: 'paper', className: 'full', symbol: 'cloud' },
      badge('Sorry'), title('That screen did not open'),
      h('p', { class: 'note', 'data-level': 'warn', text: String((error && error.message) || error) })) };
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
