import { getState, updateState, addHistoryEntry } from './js/state.js';
import { resolveTodaysBlessing, markOpened } from './js/blessing.js';
import { registerOpen } from './js/streak.js';
import { loadPools } from './js/contentPool.js';
import { fetchCommunityCount, reportOpened } from './js/community.js';
import { switchView, renderHome, renderJourney, renderCollection, renderCommunity, renderProfile } from './js/views.js';
import { prefersReducedMotion, todayKey } from './js/utils.js';

const $ = (id) => document.getElementById(id);

let memberName = '';
let characters = [];
let currentResolved = null;

async function resolveMemberName() {
  try {
    const id = localStorage.getItem('flcc-members-me');
    if (!id) return '';
    const res = await fetch(new URL('../data.json', import.meta.url));
    const data = await res.json();
    const worker = (data.workers || []).find((w) => w.id === id);
    if (!worker || !worker.name) return '';
    return worker.name.replace(/^(Bro\.|Sis\.|Pastor|Rev\.)\s*/i, '').split(' ')[0];
  } catch {
    return '';
  }
}

function setupNav() {
  document.querySelectorAll('.db-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.nav;
      switchView(view);
      if (view === 'journey') renderJourney();
      if (view === 'collection') renderCollection(characters);
      if (view === 'community') fetchCommunityCount().then(renderCommunity);
      if (view === 'profile') renderProfile(memberName);
    });
  });
}

function renderHomeFromResolved(resolved) {
  const state = getState();
  renderHome({
    name: memberName,
    season: resolved.season,
    streak: state.streak,
    opened: resolved.opened,
  });
}

// `reference` doubles as the "show Read Full Chapter link" flag — only
// scripture-like content (with a real citation) links out.
const CARD_COPY = {
  scripture: (c) => ({ kicker: "Today's Scripture", heading: '', body: c.verse, reference: c.reference }),
  prayer: (c) => ({ kicker: "Today's Prayer", heading: c.title, body: c.body, reference: '' }),
  encouragement: (c) => ({ kicker: "Today's Encouragement", heading: '', body: c.body, reference: '' }),
  reflection: (c) => ({ kicker: 'Reflection Question', heading: '', body: c.question, reference: '' }),
  devotional: (c) => ({ kicker: 'Mini Devotional', heading: c.title, body: c.body, reference: c.reference }),
  memoryVerse: (c) => ({ kicker: 'Memory Verse', heading: '', body: c.verse, reference: c.reference }),
  historicalFact: (c) => ({ kicker: 'Did You Know?', heading: c.title, body: c.body, reference: '' }),
  challenge: (c) => ({ kicker: "Today's Bible Challenge", heading: c.title, body: c.body, reference: '' }),
  kindness: (c) => ({ kicker: 'Kindness Challenge', heading: c.title, body: c.body, reference: '' }),
  mission: (c) => ({ kicker: 'Mission Challenge', heading: c.title, body: c.body, reference: '' }),
  friday: (c) => ({ kicker: c.title, heading: '', body: c.body, reference: '' }),
};

function populateBlessingCard(resolved) {
  const copy = (CARD_COPY[resolved.category] || CARD_COPY.encouragement)(resolved.content);
  const card = $('db-blessing-card');
  card.dataset.rarity = resolved.rarity;

  $('db-card-kicker').textContent = copy.kicker;
  const heading = $('db-card-title');
  heading.textContent = copy.heading;
  heading.hidden = !copy.heading;
  $('db-card-body').textContent = copy.body;
  const ref = $('db-card-reference');
  ref.textContent = copy.reference;
  ref.hidden = !copy.reference;
  const link = $('db-card-link');
  link.hidden = !copy.reference;
  link.target = '_blank';
  link.rel = 'noopener';

  $('db-reward-coins').textContent = `+${resolved.coins}`;
  $('db-reward-xp').textContent = `+${resolved.xp}`;

  const charReveal = $('db-character-reveal');
  if (resolved.characterCard) {
    charReveal.hidden = false;
    charReveal.innerHTML = `
      <p class="db-char-label">Bible Character Card Unlocked</p>
      <p class="db-char-name">${resolved.characterCard.name}</p>`;
  } else {
    charReveal.hidden = true;
    charReveal.innerHTML = '';
  }
}

function applyRewards(resolved) {
  updateState((s) => {
    s.coins += resolved.coins;
    s.xp += resolved.xp;
    if (resolved.characterCard && !s.collection.ownedCharacterIds.includes(resolved.characterCard.id)) {
      s.collection.ownedCharacterIds.push(resolved.characterCard.id);
    }
  });
  const label = resolved.characterCard
    ? `Opened Daily Blessing · collected ${resolved.characterCard.name} · +${resolved.xp} XP`
    : `Opened Daily Blessing · +${resolved.xp} XP`;
  addHistoryEntry({ label, coins: resolved.coins, xp: resolved.xp, category: resolved.category });
}

function showToast(message) {
  const toast = $('db-toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3600);
}

function spawnParticles(container) {
  container.innerHTML = '';
  const count = prefersReducedMotion() ? 0 : 14;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const dx = (Math.random() - 0.5) * 140;
    const dy = -120 - Math.random() * 100;
    p.style.setProperty('--db-particle-end', `translate(${dx}px, ${dy}px)`);
    p.style.left = `${45 + Math.random() * 10}%`;
    p.style.animationDelay = `${0.7 + Math.random() * 0.6}s`;
    container.appendChild(p);
  }
}

async function playCeremony() {
  const overlay = $('db-ceremony');
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  spawnParticles(overlay.querySelector('.db-ceremony-particles'));

  const duration = prefersReducedMotion() ? 150 : 2500;
  await new Promise((resolve) => setTimeout(resolve, duration));

  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
}

function openBlessingCard(resolved) {
  populateBlessingCard(resolved);
  const overlay = $('db-card-overlay');
  overlay.hidden = false;
  $('db-blessing-card').focus();
}

function closeBlessingCard() {
  $('db-card-overlay').hidden = true;
  $('db-gift-box').focus();
}

async function handleGiftBoxClick() {
  // Already opened today — just reopen the same card, no ceremony, no re-earning.
  if (currentResolved && currentResolved.opened) {
    openBlessingCard(currentResolved);
    return;
  }
  await handleOpen();
}

async function handleOpen() {
  const openBtn = $('db-open-btn');
  if (openBtn.disabled) return;
  openBtn.disabled = true;

  await playCeremony();

  currentResolved = await resolveTodaysBlessing();
  markOpened();
  applyRewards(currentResolved);
  const milestone = registerOpen();

  openBlessingCard(currentResolved);
  renderHomeFromResolved({ ...currentResolved, opened: true });

  reportOpened();

  if (milestone) {
    setTimeout(() => showToast(`${milestone} Day Journey milestone reached`), 400);
  }
}

// If the tab is left open past midnight, refresh once the user comes back to
// it so they see a fresh, unopened box for the new day instead of yesterday's
// cached blessing.
function refreshIfNewDay() {
  if (currentResolved && currentResolved.date !== todayKey()) {
    window.location.reload();
  }
}

async function init() {
  const [name, pools] = await Promise.all([
    resolveMemberName(),
    loadPools(['characters']),
  ]);
  memberName = name;
  characters = pools.characters;

  currentResolved = await resolveTodaysBlessing();
  renderHomeFromResolved(currentResolved);

  setupNav();

  $('db-gift-box').addEventListener('click', handleGiftBoxClick);
  $('db-open-btn').addEventListener('click', handleOpen);
  $('db-card-close').addEventListener('click', closeBlessingCard);
  $('db-card-backdrop').addEventListener('click', closeBlessingCard);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('db-card-overlay').hidden) closeBlessingCard();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIfNewDay();
  });
  window.addEventListener('focus', refreshIfNewDay);
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', import.meta.url)).catch(() => {});
  });
}
