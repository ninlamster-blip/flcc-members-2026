// Faith — daily verse, personalized prayer, and the Virtual Bible Study
// community led by Pastor Anson Dionisio.
import { getState, updateState, heartToday, todaysCheckin } from './state.js';
import { personalPrayer, isConnected } from './ai.js';
import { escapeHtml, todayKey } from './utils.js';

let data = {}; // { verses, prayers, biblestudy }
let toast = () => {};

export function initFaith(context) {
  data = context;
  toast = context.toast;
  render();
}

export function render() {
  const body = document.getElementById('oc-faith-body');
  const s = getState();

  if (!s.settings.faithEnabled) {
    body.innerHTML = `
      <div class="oc-card oc-faith-off">
        <p>Faith features are turned off.</p>
        <p class="oc-muted" style="margin-top:8px">You can turn them on anytime in Settings — walang pilitan, and you are just as welcome here either way. 🤍</p>
      </div>`;
    return;
  }

  const heart = heartToday() || 'neutral';
  const verse = verseForToday(heart);
  const bs = data.biblestudy;
  const bringing = s.bringing?.date === weekKey() ? s.bringing : null;

  body.innerHTML = `
    <div class="oc-verse-card">
      <p class="oc-verse-text">“${escapeHtml(verse.text)}”</p>
      <p class="oc-verse-ref">${escapeHtml(verse.ref)}</p>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">A prayer for you today</h2>
      <p class="oc-prayer-text" id="oc-prayer-text">${escapeHtml(data.prayers[heart] || data.prayers.neutral)}</p>
      ${isConnected() ? '<button type="button" class="oc-ghost-btn" id="oc-prayer-btn">🙏 Pray with me — a prayer just for my heart</button>' : ''}
    </div>

    <div class="oc-card">
      <div class="oc-pastor-card">
        <div class="oc-pastor-avatar" aria-hidden="true">A</div>
        <div>
          <p class="oc-pastor-name">${escapeHtml(bs.pastor.name)}</p>
          <p class="oc-pastor-role">${escapeHtml(bs.pastor.role)}</p>
          <p class="oc-pastor-message">“${escapeHtml(bs.pastor.message)}”</p>
          <p class="oc-verse-ref" style="text-align:left;margin-top:10px">${escapeHtml(bs.pastor.verse.ref)}</p>
        </div>
      </div>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Virtual Church &amp; Bible study schedule</h2>
      ${bs.schedule.map((it) => `
        <div class="oc-schedule-item">
          <div>
            <div class="oc-schedule-day">${escapeHtml(it.day)}</div>
            <div class="oc-schedule-time">${escapeHtml(it.time)}</div>
          </div>
          <div>
            <div class="oc-schedule-title">${escapeHtml(it.title)}</div>
            <div class="oc-schedule-note">${escapeHtml(it.note)}</div>
          </div>
        </div>`).join('')}
      <p class="oc-muted" style="margin-top:10px">${escapeHtml(bs.joinNote)}</p>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">What are you bringing into this week's Bible study?</h2>
      ${bringing ? renderBringingDone(bringing) : bs.bringingOptions.map((opt) => `
        <button type="button" class="oc-bring-option" data-bring="${opt.id}">
          <span class="oc-bring-icon">${opt.icon}</span>
          <span>
            <strong>${escapeHtml(opt.label)}</strong><br>
            <span class="oc-muted">${escapeHtml(opt.prompt)}</span>
          </span>
        </button>`).join('')}
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Previous teachings</h2>
      ${bs.teachings.map((t) => `
        <div class="oc-teaching">
          <div class="oc-teaching-date">${escapeHtml(t.date)}</div>
          <div class="oc-teaching-title">${escapeHtml(t.title)}</div>
          <div class="oc-teaching-passage">${escapeHtml(t.passage)}</div>
          <div class="oc-teaching-summary">${escapeHtml(t.summary)}</div>
          <ul class="oc-teaching-questions">
            ${t.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}
          </ul>
        </div>`).join('')}
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">${escapeHtml(bs.afterStudy.title)}</h2>
      <ul class="oc-values-list">
        ${bs.afterStudy.prompts.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
      </ul>
    </div>`;

  body.querySelectorAll('[data-bring]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = bs.bringingOptions.find((o) => o.id === btn.dataset.bring);
      const note = prompt(choice.prompt + '\n\n(Optional — press OK to keep it between you and God.)') || '';
      updateState((st) => { st.bringing = { date: weekKey(), choiceId: choice.id, note: note.trim() }; });
      toast('Dala mo na — see you at Bible study 🤍');
      render();
    });
  });

  const prayerBtn = body.querySelector('#oc-prayer-btn');
  if (prayerBtn) {
    prayerBtn.addEventListener('click', async () => {
      prayerBtn.disabled = true;
      prayerBtn.textContent = 'Praying with you…';
      try {
        const checkin = todaysCheckin();
        const context = [
          `Heart today: ${heart}`,
          checkin ? `Check-in — mood ${checkin.mood}/5, energy ${checkin.energy}/5, loneliness ${checkin.loneliness}/5, hope ${checkin.hope}/5${checkin.gratitude ? `, grateful for: ${checkin.gratitude}` : ''}` : '',
          getState().memories.slice(0, 5).map((m) => m.text).join('; '),
        ].filter(Boolean).join('\n');
        const prayer = await personalPrayer(context);
        document.getElementById('oc-prayer-text').textContent = prayer;
        prayerBtn.remove();
      } catch (err) {
        toast(`Hindi makakonekta: ${err.message}`);
        prayerBtn.disabled = false;
        prayerBtn.textContent = '🙏 Pray with me — a prayer just for my heart';
      }
    });
  }
}

function renderBringingDone(bringing) {
  const opt = data.biblestudy.bringingOptions.find((o) => o.id === bringing.choiceId);
  return `
    <div class="oc-checkin-done">
      <span class="oc-big-check">${opt ? opt.icon : '🤍'}</span>
      <div>
        You're bringing: <strong>${opt ? escapeHtml(opt.label.toLowerCase()) : 'something on your heart'}</strong>
        <div class="oc-checkin-summary">${bringing.note ? `“${escapeHtml(bringing.note)}”` : 'Held quietly between you and God.'}</div>
      </div>
    </div>`;
}

// Stable verse pick per (day, heart-state) so it doesn't shuffle on re-render.
function verseForToday(heart) {
  const pool = data.verses[heart] || data.verses.neutral;
  const seed = todayKey().split('-').reduce((n, part) => n + Number(part), 0);
  return pool[seed % pool.length];
}

// The "bringing" answer refreshes each week (ISO week key).
function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${week}`;
}
