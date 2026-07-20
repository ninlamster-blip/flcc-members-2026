// FLCC Kasama — entry point. Wires navigation, onboarding, settings,
// crisis support, and the five views together.
import { getState, updateState, exportAll, eraseAll, clearChat, deleteMemory } from './js/state.js';
import { getConnection, saveConnection, isConnected, testConnection } from './js/ai.js';
import { loadJson, escapeHtml } from './js/utils.js';
import { initCompanion, startNotOkayConversation, resetHomeHeader, refreshBrainCard, maybeGreetAfterGap } from './js/companion.js';
import {
  dateLine, occasionLine, initWeather, initAudioDrop,
  ritualFor, currentPeriod, openBreathing, closeBreathing, initNotOkay,
} from './js/sanctuary.js';
import { initSanctuaryMode, openSanctuaryMode } from './js/sanctuary-mode.js';
import { initJournal, refreshJournal } from './js/journal.js';
import { initFaith, render as renderFaith } from './js/faith.js';
import { initCommunity } from './js/community.js';
import { initPrayerChain, markPrayersSeen } from './js/prayerchain.js';
import {
  pushConfiguredOnServer, isEnabled as pushIsEnabled, enableNotifications, disableNotifications,
  isEveningNotifyEnabled, enableEveningNotify, disableEveningNotify, migrateLegacySubscription, refreshEveningTzOffset,
} from './js/notifications.js';
import { initSupport, renderCrisisLines } from './js/support.js';
import { initScrollHeader, resetScrollHeader } from './js/header.js';

const context = { toast };

// Set once boot() registers the service worker; read again on visibility
// resume (see setupSanctuary()) so a tab left open for days actually
// re-checks for a new deploy instead of running whatever code happened to
// be loaded whenever it was first opened.
let swRegistration = null;

// Captured install prompt (Android/Chrome fires this when the app qualifies
// for standalone install and isn't installed yet).
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

async function boot() {
  const [comfort, verses, prayers, resources, biblestudy, audiodrops] = await Promise.all([
    loadJson('data/comfort.json'),
    loadJson('data/verses.json'),
    loadJson('data/prayers.json'),
    loadJson('data/resources.json'),
    loadJson('data/biblestudy.json'),
    loadJson('data/audiodrops.json').catch(() => ({ drops: [] })),
  ]);
  Object.assign(context, { comfort, verses, prayers, resources, biblestudy, audiodrops, goTo });

  document.body.classList.toggle('oc-large-text', getState().settings.largeText);
  document.getElementById('oc-nav-faith').style.display = getState().settings.faithEnabled ? '' : 'none';
  document.body.dataset.activeView = 'home';

  setupNav();
  setupSettings();
  setupCrisis();
  setupOnboarding();
  setupSanctuary();
  initScrollHeader();

  initCompanion(context);
  initJournal(context);
  initFaith(context);
  initCommunity(context);
  initPrayerChain(context);
  initSupport(context);
  initSanctuaryMode(context);
  maybeOpenSanctuaryFromNotification();

  if ('serviceWorker' in navigator) {
    // When an updated service worker takes over (skipWaiting + claim), reload
    // once so members see the newest schedule and content without having to
    // know about hard refreshes. Guarded so the very first install (no
    // previous controller) never triggers a reload loop.
    const hadController = !!navigator.serviceWorker.controller;
    if (hadController) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
    swRegistration = await navigator.serviceWorker.register('sw.js').catch(() => null);
    swRegistration?.update().catch(() => {});
  }
}

// Tapping the evening Sanctuary reminder notification (see ask-proxy/
// worker.js sendEveningSanctuaryReminder — url: './index.html?open=sanctuary')
// should land directly in Sanctuary Mode, not require a second tap once the
// app opens. The param is stripped immediately so a later reload of this
// same tab doesn't reopen it unexpectedly.
function maybeOpenSanctuaryFromNotification() {
  const params = new URLSearchParams(location.search);
  if (params.get('open') !== 'sanctuary') return;
  history.replaceState(null, '', location.pathname);
  openSanctuaryMode();
}

// ── Navigation ───────────────────────────────────────────────────────────────

// Title/subtitle for the shared header (see index.html) — everything but
// Kaibigan (home), which carries its own header inside its layout.
const VIEW_HEADERS = {
  journal: { title: 'Journal', sub: 'A private place for your heart. Only you can see this.' },
  faith: { title: 'Faith', sub: 'Fellowship and encouragement, wherever you are.' },
  community: { title: 'Kapwa', sub: 'A safe community. No likes, no followers — just kapatiran.' },
  support: { title: 'Tulong', sub: 'Real help, real people, real numbers.' },
};

function setupNav() {
  const buttons = document.querySelectorAll('.oc-nav-btn');
  const sharedHeader = document.getElementById('oc-shared-header');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'faith') renderFaith(); // verse/prayer follow today's heart check-in
      if (target === 'journal') refreshJournal(); // pick up entries saved from other tabs
      if (target === 'community') markPrayersSeen(); // clear the "new prayer" badge on open
      document.querySelectorAll('.oc-view').forEach((v) => { v.hidden = v.dataset.view !== target; });
      buttons.forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        if (b === btn) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      document.body.dataset.activeView = target;
      const headerInfo = VIEW_HEADERS[target];
      sharedHeader.hidden = !headerInfo;
      if (headerInfo) {
        document.getElementById('oc-shared-header-title').textContent = headerInfo.title;
        document.getElementById('oc-shared-header-sub').textContent = headerInfo.sub;
      }
      window.scrollTo({ top: 0 });
      resetScrollHeader();
      if (target === 'home') {
        resetHomeHeader(); // never reopen Kaibigan with a stale collapsed header
        refreshBrainCard(); // reflect anything just done on another tab (e.g. a journal entry)
      }
    });
  });
}

// ── Daily sanctuary (home extras) ────────────────────────────────────────────

function goTo(tab) {
  document.querySelector(`.oc-nav-btn[data-nav="${tab}"]`)?.click();
}

// The ritual pill's own click handler; kept live here (not captured in a
// closure at setup time) so a refresh() while the app was merely
// backgrounded — not reloaded — actually changes what tapping the pill
// does, not just its label.
let currentRitual = null;

function setupSanctuary() {
  refreshDailySanctuaryBits();

  initWeather(document.getElementById('oc-weather-chip'));
  initAudioDrop(context.audiodrops);

  document.getElementById('oc-ritual-pill').addEventListener('click', () => {
    navigator.vibrate?.(8);
    if (!currentRitual) return;
    if (currentRitual.action === 'breathe') openBreathing();
    else if (currentRitual.action === 'sanctuary') openSanctuaryMode();
    else goTo(currentRitual.action);
  });

  document.getElementById('oc-breathe-close').addEventListener('click', closeBreathing);

  initNotOkay({
    verses: context.verses,
    toast,
    goTo,
    onTalk: () => { goTo('home'); startNotOkayConversation(); },
  });

  // The date, "is it evening yet" ritual, and family-occasion line are all
  // computed from the clock at the moment they're set — but on mobile,
  // reopening a backgrounded PWA usually doesn't reload the page, so none
  // of this ever re-ran even hours (or a full day) later. A member opening
  // the app the next morning could see last night's "time to sleep" ritual
  // and land in an evening-themed Sanctuary. Refresh whenever the tab
  // actually becomes visible again, not just once at boot.
  //
  // The service-worker update check has the exact same blind spot, and a
  // more consequential one: boot() only ran reg.update() once, at whatever
  // moment this tab first loaded. A tab kept open (just backgrounded and
  // resumed) for days never re-checked, so it could go on running JS from
  // before any later deploy indefinitely — every fix since then would
  // silently never reach it, no matter how many times the member "reopens"
  // the app, because switching back to an already-open tab isn't a reload.
  // Re-checking here means the very next resume picks up whatever's newest
  // and reloads once via the controllerchange listener above.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshDailySanctuaryBits();
    refreshBrainCard(); // same staleness risk — journal/mood context can be hours old
    maybeGreetAfterGap(); // proactive "kumusta ka" if they've been away a while
    swRegistration?.update().catch(() => {});
  });
}

function refreshDailySanctuaryBits() {
  document.getElementById('oc-date-line').textContent = dateLine();

  const occasionEl = document.getElementById('oc-occasion');
  const occasion = occasionLine();
  occasionEl.textContent = occasion;
  occasionEl.hidden = !occasion;

  currentRitual = ritualFor(currentPeriod());
  document.getElementById('oc-ritual-pill').textContent = currentRitual.text;
  document.getElementById('oc-ritual-pill').hidden = false;
}

// ── Onboarding ───────────────────────────────────────────────────────────────

function setupOnboarding() {
  if (getState().onboarded) return;
  const overlay = document.getElementById('oc-onboarding');
  overlay.hidden = false;
  document.getElementById('oc-onboard-start').addEventListener('click', () => {
    const name = document.getElementById('oc-onboard-name').value.trim();
    const country = document.getElementById('oc-onboard-country').value.trim();
    const faith = document.getElementById('oc-onboard-faith').checked;
    updateState((s) => {
      s.profile.name = name;
      s.profile.country = country;
      s.settings.faithEnabled = faith;
      s.onboarded = true;
    });
    overlay.hidden = true;
    // Re-render what depends on name/faith.
    initCompanion(context);
    renderFaith();
  });
}

// ── Crisis support ───────────────────────────────────────────────────────────

function setupCrisis() {
  const sheet = document.getElementById('oc-crisis');
  renderCrisisLines(context.resources);
  document.addEventListener('oc:crisis', () => { sheet.hidden = false; });
  document.getElementById('oc-crisis-close').addEventListener('click', () => { sheet.hidden = true; });
}

// ── Settings & privacy ───────────────────────────────────────────────────────

function setupSettings() {
  const sheet = document.getElementById('oc-settings');
  const openBtn = document.getElementById('oc-settings-btn');
  openBtn.addEventListener('click', () => { renderSettings(); sheet.hidden = false; });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
}

function renderSettings() {
  const body = document.getElementById('oc-settings-body');
  const s = getState();
  const conn = getConnection();

  body.innerHTML = `
    <div class="oc-settings-section">About you</div>
    <div class="oc-setting-row">
      <div style="flex:1">
        <div class="oc-setting-label">Your name</div>
        <input type="text" class="oc-text-input" id="oc-set-name" value="${escapeHtml(s.profile.name)}" maxlength="30" placeholder="Your name or palayaw" style="margin-top:8px">
        <div class="oc-setting-label" style="margin-top:14px">Country of origin</div>
        <div class="oc-setting-sub" style="margin-bottom:8px">Shown alongside your first name when you send a prayer request in Kapwa.</div>
        <input type="text" class="oc-text-input" id="oc-set-country" value="${escapeHtml(s.profile.country || '')}" maxlength="60" placeholder="e.g. Philippines">
      </div>
    </div>

    <div class="oc-settings-section">Experience</div>
    ${settingSwitch('faithEnabled', 'Faith features', 'Prayers, devotionals, and the Bible study community')}
    ${settingSwitch('voiceReplies', 'Spoken replies', 'Kaibigan reads replies aloud in a warm, natural voice. Needs the church voice key (ELEVENLABS_API_KEY) on the Worker — otherwise stays quiet.')}
    ${settingSwitch('largeText', 'Larger text', 'Bigger, easier-to-read letters everywhere')}

    <div class="oc-settings-section" id="oc-notify-section" hidden>Mga Abiso</div>
    <div class="oc-setting-row" id="oc-notify-row" hidden>
      <div style="flex:1">
        <div class="oc-setting-label">🔔 Bagong panalangin sa Kadena</div>
        <div class="oc-setting-sub">Ipaalam sa akin kapag may bagong prayer request — kahit sarado ang app.</div>
      </div>
      <button type="button" class="oc-switch" role="switch" aria-checked="false" id="oc-notify-switch" aria-label="Bagong panalangin notifications"></button>
    </div>
    <div class="oc-setting-row" id="oc-evening-notify-row" hidden>
      <div style="flex:1">
        <div class="oc-setting-label">🌙 Paalala sa gabi</div>
        <div class="oc-setting-sub">Isang gentle na abiso tuwing gabi — isang paanyaya papasok sa Sanctuary. Isang beses sa isang araw lang, hindi ito personalized — ang totoong papasok sa Sanctuary ay tinitignan lang paglabas mo ng app. Para dumating ito sa gabi (hindi sa kung anong oras), ibinabahagi ng device mo ang general time zone lang — hindi eksaktong lokasyon.</div>
      </div>
      <button type="button" class="oc-switch" role="switch" aria-checked="false" id="oc-evening-notify-switch" aria-label="Evening Sanctuary reminder notifications"></button>
    </div>

    ${installSection()}

    <div class="oc-settings-section">AI model</div>
    <div class="oc-setting-row"><div style="flex:1">
      <div class="oc-scale-row">
        <button type="button" class="oc-scale-dot${s.settings.model.includes('haiku') ? ' is-selected' : ''}" data-model="claude-haiku-4-5-20251001">Matipid</button>
        <button type="button" class="oc-scale-dot${s.settings.model.includes('haiku') ? '' : ' is-selected'}" data-model="claude-sonnet-4-6">Malalim</button>
      </div>
    </div></div>

    <div class="oc-settings-section">AI connection</div>
    <div class="oc-setting-row">
      <div style="flex:1">
        <div class="oc-setting-label">${isConnected() ? '✅ Connected' : 'Not connected yet'}</div>
        <div class="oc-setting-sub">${isConnected()
          ? 'Kaibigan is fully awake. This uses your church’s shared Ask FLCC connection.'
          : 'Kaibigan still works offline with caring responses, but connecting makes conversations personal. Paste your church’s Worker URL below (ask your church admin), or set it up once in Ask FLCC.'}</div>
        <input type="url" class="oc-text-input" id="oc-set-proxy" value="${escapeHtml(conn.proxyUrl)}" placeholder="https://flcc-ask.yourname.workers.dev" style="margin-top:10px" autocomplete="off">
        <input type="password" class="oc-text-input" id="oc-set-secret" value="${escapeHtml(conn.proxySecret)}" placeholder="Proxy secret (if your church set one)" style="margin-top:8px" autocomplete="off">
        <input type="password" class="oc-text-input" id="oc-set-apikey" value="${escapeHtml(conn.apiKey)}" placeholder="API key (sk-ant-…) — optional, instead of a proxy" style="margin-top:8px" autocomplete="off">
        <button type="button" class="oc-ghost-btn" id="oc-test-conn" style="margin-top:10px">Test connection</button>
        <div class="oc-setting-sub" id="oc-test-result" style="margin-top:8px"></div>
      </div>
    </div>

    <div class="oc-settings-section">What Kaibigan remembers</div>
    <div class="oc-setting-row"><div style="flex:1">
      <div class="oc-setting-sub" style="margin-bottom:6px">${s.memories.length ? 'Tap ✕ to make Kaibigan forget something. All of this stays on this device only.' : 'Nothing yet — memories appear as you share in conversations.'}</div>
      ${s.memories.map((m, i) => `
        <div class="oc-entry-meta" style="padding:6px 0">
          <span style="color:var(--ink-soft);flex:1">${escapeHtml(m.text)}</span>
          <button type="button" class="oc-entry-delete" data-forget="${i}" aria-label="Forget this">✕</button>
        </div>`).join('')}
    </div></div>

    <div class="oc-settings-section">Privacy</div>
    <div class="oc-setting-row"><div>
      <div class="oc-setting-label">Everything stays on this phone</div>
      <div class="oc-setting-sub">Your journal, check-ins, and conversations are stored only on this device. No ads, no selling data, no tracking. Conversations are sent to the AI only to generate replies, through your church's private connection. The one exception: turning on the evening Sanctuary reminder shares this device's rough time zone (not your exact location) so that reminder arrives in the evening instead of any random hour — nothing else about you is attached to it.</div>
    </div></div>
    <button type="button" class="oc-ghost-btn" id="oc-export-btn" style="width:100%;margin-top:10px">Download a copy of my data</button>
    <button type="button" class="oc-danger-btn" id="oc-clear-chat-btn">Clear conversation history</button>
    <button type="button" class="oc-danger-btn" id="oc-erase-btn">Erase everything on this device</button>
    <button type="button" class="oc-primary-btn" id="oc-settings-done" style="margin-top:18px">Done</button>`;

  body.querySelectorAll('.oc-switch[data-setting]').forEach((sw) => {
    sw.addEventListener('click', () => {
      const key = sw.dataset.setting;
      const next = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(next));
      updateState((st) => { st.settings[key] = next; });
      if (key === 'largeText') document.body.classList.toggle('oc-large-text', next);
      if (key === 'faithEnabled') {
        renderFaith();
        document.getElementById('oc-nav-faith').style.display = next ? '' : 'none';
      }
    });
  });

  wireNotifySwitch(body);

  const installBtn = body.querySelector('#oc-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') toast('Salamat! Hanapin ang 🤍 sa home screen mo.');
        installPrompt = null;
        return;
      }
      // No prompt available: already installed, or the browser hides it behind its own menu.
      toast('Sa browser menu (⋮), piliin ang “Add to Home screen” o “Install app”.');
    });
  }

  body.querySelector('#oc-test-conn').addEventListener('click', async () => {
    const btn = body.querySelector('#oc-test-conn');
    const result = body.querySelector('#oc-test-result');
    // Test exactly what's typed in the fields right now.
    saveConnection({
      proxyUrl: body.querySelector('#oc-set-proxy').value,
      proxySecret: body.querySelector('#oc-set-secret').value,
      apiKey: body.querySelector('#oc-set-apikey').value,
    });
    if (!isConnected()) {
      result.textContent = 'Wala pang Worker URL o API key na nakalagay sa taas.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      await testConnection();
      result.textContent = '✅ Gumagana! Kaibigan is ready to talk.';
    } catch (err) {
      result.textContent = `❌ ${err.message}\n${connectionHint(err.message)}`;
    }
    btn.disabled = false;
    btn.textContent = 'Test connection';
  });

  body.querySelectorAll('[data-model]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateState((st) => { st.settings.model = btn.dataset.model; st.settings.modelChosenByUser = true; });
      body.querySelectorAll('[data-model]').forEach((b) => b.classList.toggle('is-selected', b === btn));
    });
  });

  body.querySelectorAll('[data-forget]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteMemory(Number(btn.dataset.forget));
      renderSettings();
    });
  });

  body.querySelector('#oc-export-btn').addEventListener('click', () => {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flcc-kasama-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  body.querySelector('#oc-clear-chat-btn').addEventListener('click', () => {
    if (!confirm('Clear your conversation with Kaibigan? Memories and journal stay.')) return;
    clearChat();
    initCompanion(context);
    toast('Conversation cleared');
  });

  body.querySelector('#oc-erase-btn').addEventListener('click', () => {
    if (!confirm('Erase EVERYTHING — journal, check-ins, conversations, memories? This cannot be undone.')) return;
    eraseAll();
    location.reload();
  });

  body.querySelector('#oc-settings-done').addEventListener('click', () => {
    const name = body.querySelector('#oc-set-name').value.trim();
    const country = body.querySelector('#oc-set-country').value.trim();
    updateState((st) => { st.profile.name = name; st.profile.country = country; });
    saveConnection({
      proxyUrl: body.querySelector('#oc-set-proxy').value,
      proxySecret: body.querySelector('#oc-set-secret').value,
      apiKey: body.querySelector('#oc-set-apikey').value,
    });
    document.getElementById('oc-settings').hidden = true;
    initCompanion(context);
    renderFaith();
  });
}

// Install-as-app section: one-tap on Android/Chrome, instructions on iPhone,
// hidden entirely once already running standalone.
// Push notifications (two independent toggles — "bagong panalangin" and the
// evening Sanctuary reminder, see js/notifications.js): a device
// preference, so they live in Settings rather than inline elsewhere. The
// whole section stays hidden — never shown half-broken — until we know the
// church Worker actually has a VAPID key configured.
async function wireNotifySwitch(body) {
  const configured = await pushConfiguredOnServer();
  if (!configured) return;
  await migrateLegacySubscription();

  const section = body.querySelector('#oc-notify-section');
  const row = body.querySelector('#oc-notify-row');
  const sw = body.querySelector('#oc-notify-switch');
  const eveningRow = body.querySelector('#oc-evening-notify-row');
  const eveningSw = body.querySelector('#oc-evening-notify-switch');
  if (!section || !row || !sw || !eveningRow || !eveningSw) return; // settings sheet was closed/re-rendered before this resolved
  section.hidden = false;
  row.hidden = false;
  eveningRow.hidden = false;
  sw.setAttribute('aria-checked', String(pushIsEnabled()));
  eveningSw.setAttribute('aria-checked', String(isEveningNotifyEnabled()));
  refreshEveningTzOffset(); // fire-and-forget — keeps the server's timing current if the member has traveled since last enabling it

  wireSwitch(sw, enableNotifications, disableNotifications, 'Naka-on na ang abiso — salamat! 🔔', 'Naka-off na ang abiso.');
  wireSwitch(eveningSw, enableEveningNotify, disableEveningNotify, 'Naka-on na ang paalala sa gabi 🌙', 'Naka-off na ang paalala sa gabi.');
}

function wireSwitch(sw, enable, disable, onMessage, offMessage) {
  sw.addEventListener('click', async () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.disabled = true;
    try {
      if (next) {
        await enable();
        toast(onMessage);
      } else {
        await disable();
        toast(offMessage);
      }
      sw.setAttribute('aria-checked', String(next));
    } catch (err) {
      toast(err.message || 'Hindi na-set up ang abiso.');
    }
    sw.disabled = false;
  });
}

function installSection() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) return '';
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return `
    <div class="oc-settings-section">Install as app</div>
    <div class="oc-setting-row"><div style="flex:1">
      <div class="oc-setting-sub" style="margin-bottom:8px">Ilagay ang FLCC Kasama sa home screen mo — bubukas ito na parang sariling app, kahit offline.</div>
      ${isIOS
        ? '<div class="oc-setting-sub">Sa iPhone: i-tap ang <strong>Share</strong> button (kahon na may arrow) sa Safari, tapos <strong>“Add to Home Screen”</strong>.</div>'
        : '<button type="button" class="oc-ghost-btn" id="oc-install-btn" style="width:100%">📲 Install FLCC Kasama</button>'}
    </div></div>`;
}

// Plain-language advice for the usual connection failures.
function connectionHint(message) {
  if (/proxy secret/i.test(message)) return 'Ang Proxy secret ay hindi tugma sa nakalagay sa Worker — itama o burahin ito.';
  if (/ANTHROPIC_API_KEY secret not set/i.test(message)) return 'Ang Worker mismo ay walang API key pa. Sa Cloudflare: Worker → Settings → Variables → add Secret na ANTHROPIC_API_KEY.';
  if (/invalid x-api-key|authentication_error|invalid api key/i.test(message)) return 'Mukhang mali o expired ang API key — dapat nagsisimula sa sk-ant- at kumpleto ang kopya.';
  if (/credit|billing|balance/i.test(message)) return 'Walang load ang API account — mag-add ng credits sa console.anthropic.com → Billing.';
  if (/model/i.test(message)) return 'Hindi available ang model sa key na ito — subukan ang kabilang pagpipilian sa AI model sa taas.';
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Hindi maabot ang address — tingnan ang spelling ng Worker URL at ang internet mo.';
  if (/404/.test(message)) return 'Mali yata ang Worker URL — dapat ito ang address ng Worker mo, hal. https://pangalan.workers.dev.';
  return 'Kung hindi malinaw, kopyahin ang error na ito at ipakita sa church admin.';
}

function settingSwitch(key, label, sub) {
  const on = !!getState().settings[key];
  return `
    <div class="oc-setting-row">
      <div>
        <div class="oc-setting-label">${label}</div>
        <div class="oc-setting-sub">${sub}</div>
      </div>
      <button type="button" class="oc-switch" role="switch" aria-checked="${on}" data-setting="${key}" aria-label="${label}"></button>
    </div>`;
}

// ── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('oc-toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

boot().catch((err) => {
  document.getElementById('oc-root').innerHTML =
    `<div class="oc-card" style="margin-top:80px;text-align:center">
       <p>May problema sa pag-load ng app.</p>
       <p class="oc-muted" style="margin-top:8px">${escapeHtml(err.message)}</p>
     </div>`;
});
