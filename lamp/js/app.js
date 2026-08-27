// Boot, onboarding, navigation. Screens are loaded on demand and return
// { title, el, back }; the shell swaps them in.

import { h, clear, icon } from './core/dom.js';
import * as router from './core/router.js';
import { getProfile, getSettings, saveProfile, currentBand, greeting, readerScale } from './core/profile.js';
import { toast, heroEl } from './core/ui.js';

const TABS = [
  { name: 'today',      label: 'Today',   icon: 'today' },
  { name: 'bible',      label: 'Bible',   icon: 'bible' },
  { name: 'stories',    label: 'Stories', icon: 'discover' },
  { name: 'journey',    label: 'Journey', icon: 'journey' },
  { name: 'me',         label: 'Me',      icon: 'me' },
];

const SCREENS = {
  today:      () => import('./screens/today.js'),
  bible:      () => import('./screens/bible.js'),
  read:       () => import('./screens/reader.js'),
  stories:    () => import('./screens/stories.js'),
  story:      () => import('./screens/story.js'),
  journey:    () => import('./screens/journey.js'),
  memory:     () => import('./screens/memory.js'),
  challenge:  () => import('./screens/challenge.js'),
  prayer:     () => import('./screens/prayer.js'),
  journal:    () => import('./screens/journal.js'),
  ask:        () => import('./screens/ask.js'),
  me:         () => import('./screens/me.js'),
};

for (const [name, loader] of Object.entries(SCREENS)) router.define(name, loader);

const screenEl = document.getElementById('screen');
const headerEl = document.getElementById('app-header');
const titleEl = document.getElementById('header-title');
const backEl = document.getElementById('header-back');
const actionEl = document.getElementById('header-action');
const tabbarEl = document.getElementById('tabbar');

backEl.addEventListener('click', () => router.back());

// ── Theme and band ──────────────────────────────────────────────────────────

export function applyChrome() {
  const settings = getSettings();
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme;
  else delete root.dataset.theme;
  root.dataset.band = currentBand();
  root.style.setProperty('--reader-scale', String(readerScale(settings, root.dataset.band)));
}

// ── Onboarding ──────────────────────────────────────────────────────────────

function onboarding() {
  headerEl.hidden = true;
  tabbarEl.hidden = true;

  const thisYear = new Date().getFullYear();
  const nameInput = h('input', { type: 'text', id: 'ob-name', autocomplete: 'off', maxlength: '24', placeholder: 'Joshua' });
  const yearInput = h('input', { type: 'number', id: 'ob-year', min: String(thisYear - 25), max: String(thisYear - 4), placeholder: String(thisYear - 12) });
  const error = h('p', { class: 'field-hint state-warn' });

  const form = h('form', { class: 'onboard', onsubmit: (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const year = Number(yearInput.value);
    if (!name) { error.textContent = 'Tell LAMP what to call you.'; nameInput.focus(); return; }
    if (!Number.isInteger(year) || year < thisYear - 25 || year > thisYear - 4) {
      error.textContent = 'Enter the year you were born, like ' + (thisYear - 12) + '.';
      yearInput.focus();
      return;
    }
    saveProfile({ name, birthYear: year });
    applyChrome();
    router.go('today', { replace: true });
    boot();
  } },
    h('div', { class: 'onboard-art' }, heroEl()),
    h('div', { class: 'wordmark', text: 'Lamp' }),
    h('p', { class: 'tagline', text: 'Discover God. Know His Word. Live It.' }),
    h('div', { class: 'field' },
      h('label', { for: 'ob-name', text: 'What should LAMP call you?' }),
      nameInput,
      h('p', { class: 'field-hint', text: 'A first name or a nickname. It stays on this device.' })),
    h('div', { class: 'field' },
      h('label', { for: 'ob-year', text: 'Which year were you born?' }),
      yearInput,
      h('p', { class: 'field-hint', text: 'LAMP asks for the year — never the date — so it can write for your age.' })),
    error,
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Start'),
    h('p', { class: 'field-hint center', style: 'margin-top:1.5rem',
      text: 'No account, no email, no location. Everything you write stays on this device.' }),
  );

  clear(screenEl).appendChild(form);
  nameInput.focus();
}

// ── Tab bar ─────────────────────────────────────────────────────────────────

function renderTabs(activeName) {
  clear(tabbarEl);
  for (const tab of TABS) {
    const button = h('button', {
      class: 'tab',
      type: 'button',
      onclick: () => router.go(tab.name),
    }, icon(tab.icon), h('span', { text: tab.label }));
    if (tab.name === activeName) button.setAttribute('aria-current', 'page');
    tabbarEl.appendChild(button);
  }
  tabbarEl.hidden = false;
}

// ── Rendering ───────────────────────────────────────────────────────────────

const ROOT_SCREENS = new Set(TABS.map((tab) => tab.name));

async function show(route, module) {
  const context = {
    route,
    band: currentBand(),
    profile: getProfile(),
    settings: getSettings(),
    go: router.go,
    back: router.back,
    toast,
    greeting: () => greeting((getProfile() || {}).name),
    refresh: () => show(route, module),
  };

  clear(screenEl);
  let view;
  try {
    view = await module.default(context);
  } catch (error) {
    view = { title: 'Something went wrong', el: h('div', { class: 'empty' },
      h('h2', { text: 'That screen did not open' }),
      h('p', { text: String(error && error.message || error) })) };
  }

  titleEl.textContent = view.title || 'LAMP';
  headerEl.hidden = false;
  backEl.hidden = ROOT_SCREENS.has(route.name);
  if (view.action) {
    actionEl.hidden = false;
    actionEl.textContent = view.action.label;
    actionEl.onclick = view.action.onclick;
  } else {
    actionEl.hidden = true;
    actionEl.onclick = null;
  }
  screenEl.appendChild(view.el);
  screenEl.scrollTop = 0;
  window.scrollTo(0, 0);
  renderTabs(ROOT_SCREENS.has(route.name) ? route.name : view.tab || null);
}

// ── Boot ────────────────────────────────────────────────────────────────────

function boot() {
  applyChrome();
  if (!getProfile()) { onboarding(); return; }
  router.start(show);
}

boot();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
  });
}
