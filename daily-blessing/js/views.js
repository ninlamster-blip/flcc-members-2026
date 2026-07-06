import { getState } from './state.js';
import { xpProgress, formatNumber, todayKey } from './utils.js';

const $ = (id) => document.getElementById(id);

export function switchView(name) {
  document.querySelectorAll('.db-view').forEach((el) => {
    el.hidden = el.dataset.view !== name;
  });
  document.querySelectorAll('.db-nav-btn').forEach((btn) => {
    const active = btn.dataset.nav === name;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

export function greetingFor(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  return name ? `${part}, ${name}` : part;
}

export function renderHome({ name, season, streak, opened }) {
  $('home-greeting').textContent = greetingFor(name);
  const seasonLabel = $('db-season-label');
  if (season && season.label) {
    seasonLabel.textContent = season.label;
    seasonLabel.hidden = false;
  } else {
    seasonLabel.hidden = true;
  }

  const streakText = $('db-streak-text');
  streakText.textContent = streak.current > 0
    ? `${streak.current} Day Journey`
    : 'Begin your journey';

  const openBtn = $('db-open-btn');
  const caption = $('db-box-caption');
  if (opened) {
    openBtn.textContent = "Today's Blessing Opened";
    openBtn.disabled = true;
    caption.textContent = 'Come back tomorrow for a new blessing';
  } else {
    openBtn.textContent = "Open Today's Blessing";
    openBtn.disabled = false;
    caption.textContent = "Today's Blessing awaits";
  }
}

export function renderJourney() {
  const state = getState();
  renderHeatmap(state.history);
  renderTimeline(state.history);
}

function renderHeatmap(history) {
  const el = $('db-heatmap');
  el.innerHTML = '';
  const byDate = new Map();
  history.forEach((h) => {
    byDate.set(h.date, (byDate.get(h.date) || 0) + 1);
  });
  const days = 182; // ~26 weeks
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const count = byDate.get(key) || 0;
    const level = count === 0 ? 0 : count === 1 ? 2 : 4;
    const cell = document.createElement('div');
    cell.className = 'db-heatmap-cell';
    cell.dataset.level = String(level);
    cell.title = `${key}: ${count} ${count === 1 ? 'entry' : 'entries'}`;
    el.appendChild(cell);
  }
  el.scrollLeft = el.scrollWidth;
}

function renderTimeline(history) {
  const el = $('db-timeline');
  el.innerHTML = '';
  if (history.length === 0) {
    el.innerHTML = '<li class="db-empty-note">Open your first blessing to begin your timeline.</li>';
    return;
  }
  history.slice(0, 30).forEach((entry) => {
    const li = document.createElement('li');
    const dateLabel = entry.date === todayKey() ? 'Today' : entry.date;
    li.innerHTML = `<span class="db-timeline-date">${dateLabel}</span>${entry.label}`;
    el.appendChild(li);
  });
}

export function renderCollection(characters) {
  const state = getState();
  const owned = new Set(state.collection.ownedCharacterIds);
  $('db-collection-progress').textContent = `Heroes of Faith · ${owned.size} of ${characters.length} collected`;

  const grid = $('db-collection-grid');
  grid.innerHTML = '';
  characters.forEach((c) => {
    const isOwned = owned.has(c.id);
    const wrap = document.createElement('div');
    wrap.className = 'db-char-card';
    wrap.dataset.rarity = c.rarity;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', isOwned ? `${c.name} card. Tap to flip.` : 'Locked card');

    const monogram = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
    wrap.innerHTML = `
      <div class="db-char-card-inner">
        <div class="db-char-face db-char-face--front ${isOwned ? '' : 'is-locked'}">
          <div class="db-char-monogram">${isOwned ? monogram : '?'}</div>
          <p class="db-char-name">${isOwned ? c.name : 'Locked'}</p>
          <p class="db-char-era">${isOwned ? c.era : 'Keep your journey going'}</p>
        </div>
        <div class="db-char-face db-char-face--back">
          <p class="db-char-verse">&ldquo;${c.verse}&rdquo;</p>
          <p class="db-char-ref">${c.reference}</p>
          <p class="db-char-fact">${c.fact}</p>
        </div>
      </div>`;

    if (isOwned) {
      const flip = () => wrap.classList.toggle('is-flipped');
      wrap.addEventListener('click', flip);
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
      });
    }
    grid.appendChild(wrap);
  });
}

export function renderCommunity(data) {
  const text = $('db-community-text');
  const countEl = $('db-community-count');
  const ring = $('db-ring-fill');
  const CIRCUMFERENCE = 327;

  if (!data.configured) {
    countEl.textContent = '—';
    ring.style.strokeDashoffset = String(CIRCUMFERENCE);
    text.textContent = 'Community counts will appear here once your church enables shared blessings.';
    return;
  }

  countEl.textContent = formatNumber(data.count);
  const pct = Math.min(1, data.count / 50);
  ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - pct));
  text.textContent = data.count === 1
    ? '1 member has opened today’s blessing so far.'
    : `${formatNumber(data.count)} members have opened today's blessing so far.`;
}

export function renderProfile(name) {
  const state = getState();
  const { level, pct } = xpProgress(state.xp);

  $('db-profile-level').textContent = `Faith Journey · Level ${level}`;
  $('db-xp-fill').style.width = `${Math.round(pct * 100)}%`;
  $('db-stat-coins').textContent = formatNumber(state.coins);
  $('db-stat-xp').textContent = formatNumber(state.xp);
  $('db-stat-badges').textContent = formatNumber(state.streak.milestonesUnlocked.length + state.collection.badges.length);

  const distinctDays = new Set(state.history.map((h) => h.date)).size;
  $('db-stat-days').textContent = formatNumber(distinctDays);

  const avatar = $('db-avatar');
  const initials = (name || 'F').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  avatar.textContent = '';
  avatar.style.display = 'flex';
  avatar.style.alignItems = 'center';
  avatar.style.justifyContent = 'center';
  avatar.style.color = '#fff';
  avatar.style.fontWeight = '700';
  avatar.style.fontSize = '24px';
  avatar.textContent = initials;

  const list = $('db-achievements');
  list.innerHTML = '';
  const achievements = [];
  state.streak.milestonesUnlocked.slice(-5).reverse().forEach((m) => {
    achievements.push(`${m} Day Journey milestone reached`);
  });
  state.collection.ownedCharacterIds.slice(-5).reverse().forEach((id) => {
    achievements.push(`Collected a new Bible Character Card`);
  });
  if (achievements.length === 0) {
    list.innerHTML = '<li class="db-empty-note">Your achievements will appear here as you grow.</li>';
  } else {
    achievements.slice(0, 8).forEach((a) => {
      const li = document.createElement('li');
      li.textContent = a;
      list.appendChild(li);
    });
  }
}
