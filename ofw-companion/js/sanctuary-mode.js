// Sanctuary Mode — a calm, minimal, full-screen evening ritual: a chosen
// verse, a short reflection, a personalized prayer, a gratitude prompt, and
// the breathing exercise, brought together in one quiet space instead of
// scattered across tabs. Part of the Faith Brain (see js/agent-brain.js for
// the full five-brain map), alongside faith.js. An extension of the "Daily
// Sanctuary" widgets in sanctuary.js (ritual pill, weather, occasion line)
// for the one time of day — evening — that deserves its own dedicated
// moment.
//
// Selection is deliberate, never random: the verse and prayer are chosen
// from what the member has already explicitly shared today (their heart
// check-in, recent wellbeing check-ins) — the exact same signals the Faith
// tab's own prayer button already uses. Nothing here reads or infers
// anything from free-text journal/chat content; that's a bigger, more
// sensitive step this app isn't taking yet.
//
// Offered, never forced: reached only through the evening ritual pill (see
// sanctuary.js ritualFor()) — the same "invite, don't demand" rhythm as
// everything else on the home screen, not an automatic popup.

import { getState, heartFeelingsToday, todaysCheckin, addJournalEntry } from './state.js';
import { personalPrayer, isConnected } from './ai.js';
import { verseForToday } from './faith.js';
import { openBreathing } from './sanctuary.js';
import { todayKey } from './utils.js';

const GRATITUDE_PREFIX = '🌙 Gratitude: ';

// One quiet line per heart category — no AI call needed, so Sanctuary Mode
// opens instantly and works offline. (The Journal tab's own AI-generated
// wellbeingInsight() already covers a deeper reflection on request; this
// stays a small, fast touch rather than duplicating that call.)
const REFLECTIONS = {
  peaceful: 'Panatilihin ang kapayapaang ito. Ito ay kaloob, hindi aksidente.',
  joyful: 'Panatilihin ang ngiting ito — kahit malayo, ang saya mo ay saya rin ng Diyos.',
  grateful: 'Ang pasasalamat, kahit sa maliit, ay nagpapaalala na ikaw ay minamahal.',
  lonely: 'Sa katahimikan ng gabing ito, hindi ka nag-iisa. Kasama mo Siya.',
  homesick: 'Ang layo ay pansamantala lang. Ang pagmamahal ng pamilya mo — at ng Diyos — ay hindi.',
  exhausted: 'Ipahinga mo ang katawan mo ngayong gabi. Kayang tapusin ng Diyos ang bukas.',
  anxious: 'Ilagay mo ang mga alalahanin mo ngayong gabi. Hawak Niya ang bukas.',
  heavy: 'Mabigat man ang puso mo, may pag-asang naghihintay pagkagising mo.',
  invisible: 'Nakikita ka ng Diyos, kahit sino pa ang hindi.',
  neutral: 'Salamat sa isa pang araw na dinaanan mo. Magpahinga ka ngayong gabi.',
};

function primaryHeart() {
  const [feeling] = heartFeelingsToday();
  return feeling || 'neutral';
}

let els = {};
let toast = () => {};

export function initSanctuaryMode(context) {
  toast = context.toast;
  els = {
    overlay: document.getElementById('oc-sanctuary'),
    faithBlock: document.getElementById('oc-sanctuary-faith'),
    verseText: document.getElementById('oc-sanctuary-verse-text'),
    verseRef: document.getElementById('oc-sanctuary-verse-ref'),
    reflection: document.getElementById('oc-sanctuary-reflection'),
    prayerText: document.getElementById('oc-sanctuary-prayer-text'),
    prayerBtn: document.getElementById('oc-sanctuary-prayer-btn'),
    gratitudeInput: document.getElementById('oc-sanctuary-gratitude'),
    gratitudeSave: document.getElementById('oc-sanctuary-gratitude-save'),
    gratitudeDone: document.getElementById('oc-sanctuary-gratitude-done'),
    breatheBtn: document.getElementById('oc-sanctuary-breathe-btn'),
    closeBtn: document.getElementById('oc-sanctuary-close'),
  };

  els.closeBtn.addEventListener('click', closeSanctuaryMode);
  els.breatheBtn.addEventListener('click', () => { navigator.vibrate?.(8); openBreathing(); });
  els.gratitudeSave.addEventListener('click', () => {
    const text = els.gratitudeInput.value.trim();
    if (!text) return;
    addJournalEntry(`${GRATITUDE_PREFIX}${text}`);
    els.gratitudeInput.value = '';
    showGratitudeDone();
    toast('Nakatago na, kapatid 🤍');
  });
}

function showGratitudeDone() {
  els.gratitudeInput.hidden = true;
  els.gratitudeSave.hidden = true;
  els.gratitudeDone.hidden = false;
}

export function openSanctuaryMode() {
  const s = getState();
  const heart = primaryHeart();
  els.reflection.textContent = REFLECTIONS[heart] || REFLECTIONS.neutral;

  // Verse + prayer are faith content — respect the same faithEnabled
  // toggle every other tab already honors, rather than assuming everyone
  // wants Scripture in their evening moment.
  els.faithBlock.hidden = !s.settings.faithEnabled;
  if (s.settings.faithEnabled) {
    const verse = verseForToday(heart);
    els.verseText.textContent = `"${verse.text}"`;
    els.verseRef.textContent = verse.ref;
    setupPrayer(heart);
  }

  // Gratitude: offer once a day — if tonight's already logged, show the
  // done state instead of asking again.
  const today = todayKey();
  const alreadyLogged = s.journal.some((e) => e.date === today && e.text.startsWith(GRATITUDE_PREFIX));
  els.gratitudeInput.hidden = alreadyLogged;
  els.gratitudeSave.hidden = alreadyLogged;
  els.gratitudeDone.hidden = !alreadyLogged;
  els.gratitudeInput.value = '';

  els.overlay.hidden = false;
  navigator.vibrate?.(8);
}

function setupPrayer(heart) {
  els.prayerText.textContent = 'Panginoon, salamat sa araw na ito. Ipagkatiwala ko sa Iyo ang gabing ito at ang bukas. Amen.';
  els.prayerBtn.hidden = !isConnected();
  els.prayerBtn.disabled = false;
  els.prayerBtn.textContent = '🙏 Isang panalangin para sa akin ngayong gabi';
  els.prayerBtn.onclick = async () => {
    els.prayerBtn.disabled = true;
    els.prayerBtn.textContent = 'Naghahanda ng panalangin…';
    try {
      const checkin = todaysCheckin();
      const context = [
        `Heart tonight: ${heart}`,
        checkin ? `Check-in — mood ${checkin.mood}/5, energy ${checkin.energy}/5, loneliness ${checkin.loneliness}/5, hope ${checkin.hope}/5${checkin.gratitude ? `, grateful for: ${checkin.gratitude}` : ''}` : '',
      ].filter(Boolean).join('\n');
      const prayer = await personalPrayer(context);
      els.prayerText.textContent = prayer;
      els.prayerBtn.remove();
    } catch (err) {
      toast(`Hindi makakonekta: ${err.message}`);
      els.prayerBtn.disabled = false;
      els.prayerBtn.textContent = '🙏 Isang panalangin para sa akin ngayong gabi';
    }
  };
}

export function closeSanctuaryMode() {
  els.overlay.hidden = true;
}
