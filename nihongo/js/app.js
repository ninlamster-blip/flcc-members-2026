// App shell: sidebar nav + hash router. Views are lazy-loaded per route.
import { State, save, level, touchActivity, el } from './core.js';
import { checkMissions } from './missions.js';
import { evaluateAchievements } from './achievements.js';

const NAV = [
  { group: 'Learn', items: [
    { route: 'home', icon: '🏠', label: 'Home' },
    { route: 'kana?script=hiragana', match: 'kana', icon: 'あ', label: 'Hiragana / Katakana' },
    { route: 'vocab', icon: '📇', label: 'Word Cards' },
    { route: 'kanji', icon: '漢', label: 'Kanji Explorer' },
    { route: 'breakdown', icon: '🧩', label: 'Sentence Breakdown' },
  ]},
  { group: 'Practice', items: [
    { route: 'flash', icon: '🔁', label: 'Flashcards' },
    { route: 'chat', icon: '💬', label: 'AI Conversation' },
    { route: 'speak', icon: '🎙️', label: 'Pronunciation' },
    { route: 'write', icon: '✍️', label: 'Writing Practice' },
    { route: 'jlpt', icon: '🎓', label: 'JLPT Prep' },
  ]},
  { group: 'You', items: [
    { route: 'progress', icon: '📊', label: 'Progress' },
  ]},
];

// Lazy view loaders. Each returns a module exposing render(root, params, nav).
const VIEWS = {
  home:      () => import('./views/home.js'),
  kana:      () => import('./views/kana.js'),
  vocab:     () => import('./views/vocab.js'),
  kanji:     () => import('./views/kanji.js'),
  breakdown: () => import('./views/breakdown.js'),
  flash:     () => import('./views/flash.js'),
  chat:      () => import('./views/chat.js'),
  speak:     () => import('./views/speak.js'),
  write:     () => import('./views/write.js'),
  jlpt:      () => import('./views/jlpt.js'),
  progress:  () => import('./views/progress.js'),
};

function parseHash() {
  const raw = (location.hash || '#home').slice(1);
  const [name, query] = raw.split('?');
  const params = {};
  if (query) for (const kv of query.split('&')) {
    const [k, v] = kv.split('=');
    params[k] = decodeURIComponent(v || '');
  }
  return { name: name || 'home', params };
}

function nav(route) {
  location.hash = '#' + route;
  document.body.classList.remove('nav-open');
}

function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="nav-scrim" id="scrim"></div>
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="mark jp">桜</div>
        <div>
          <div class="title">Nihongo Journey</div>
          <div class="sub">Learn Japanese, beautifully</div>
        </div>
      </div>
      <nav id="nav"></nav>
      <div class="sidebar-foot">
        <div class="streak-pill">
          <span class="flame">🔥</span>
          <div style="flex:1;">
            <div class="n" id="streakN">${State.streak || 0}</div>
            <div class="l">day streak · Lv.${level()}</div>
          </div>
        </div>
      </div>
    </aside>
    <main class="main">
      <div class="mobile-top">
        <button class="icon-btn" id="menuBtn" aria-label="Menu">☰</button>
        <span class="m-title jp">桜 Nihongo Journey</span>
      </div>
      <div class="main-inner"><div id="view"></div></div>
    </main>`;

  const navEl = app.querySelector('#nav');
  for (const g of NAV) {
    navEl.appendChild(el(`<div class="nav-group-label">${g.group}</div>`));
    for (const it of g.items) {
      const a = el(`<button class="nav-item" data-route="${it.route}" data-match="${it.match || it.route}">
        <span class="ico jp" style="display:grid;place-items:center;">${it.icon}</span>
        <span>${it.label}</span></button>`);
      a.onclick = () => nav(it.route);
      navEl.appendChild(a);
    }
  }

  app.querySelector('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  app.querySelector('#scrim').onclick = () => document.body.classList.remove('nav-open');
}

function highlightNav(name) {
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.match === name);
  });
  const sn = document.getElementById('streakN');
  if (sn) sn.textContent = State.streak || 0;
}

async function route() {
  const { name, params } = parseHash();
  const old = document.getElementById('view');
  if (!old) return;
  // Swap in a fresh #view node so any pending timers/async callbacks held by
  // the previous view write into the now-detached old node, never the live UI.
  const view = document.createElement('div');
  view.id = 'view';
  old.replaceWith(view);
  highlightNav(name);
  const loader = VIEWS[name] || VIEWS.home;
  view.innerHTML = `<div class="empty-state"><div class="big">桜</div>Loading…</div>`;
  try {
    const mod = await loader();
    view.innerHTML = '';
    mod.render(view, params, nav);
    document.querySelector('.main-inner').scrollIntoView({ block: 'start' });
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty-state"><div class="big">🚧</div>
      This module isn't available yet.</div>`;
  }
  checkMissions();
  evaluateAchievements();
}

export function start() {
  touchActivity();
  buildShell();
  window.addEventListener('hashchange', route);
  window.addEventListener('xp', () => { highlightNav(parseHash().name); evaluateAchievements(); });
  if (!location.hash) location.hash = '#home';
  route();
}
