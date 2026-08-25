/* =============================================================================
   NOTES — the rules, with no screen and no storage attached.
   -----------------------------------------------------------------------------
   A note belongs to a service, and a service is a row of the church's published
   schedule. That is the whole model: there is no "new note" button, because
   there is never a note without a service to hang it on, and a member opening
   this on a Sunday evening should find the right one already waiting.

   The id — `2026-08-30|Sunday` — is the same one the members app has always
   written, on the same localStorage key, so every note anybody has already
   taken opens here untouched.
   ========================================================================== */

/** The members app browses its journal through a note id that is not a real
 *  service. It is never a note somebody wrote, so it never appears in a list. */
const PSEUDO_SERVICES = new Set(['journal-browse']);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ── Dates ────────────────────────────────────────────────────────────────── */

/** Today where the member is standing, as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Midday UTC, so a date never slips across a day boundary by timezone. */
function dateAt(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from, to) {
  return Math.round((dateAt(to) - dateAt(from)) / 86400000);
}

/** "Sunday, 30 August 2026" — spelled out here rather than left to the device,
 *  so every member sees the same thing and a test can check it. */
export function dateLabel(iso) {
  const d = dateAt(iso);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "30 Aug" — for a list, where the year is noise. */
export function shortDate(iso) {
  const d = dateAt(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** "August 2026" — the heading a list of notes is grouped under. */
export function monthLabel(monthKey) {
  const [y, m] = String(monthKey).split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Today", "Yesterday", "In 3 days", "Last Sunday" — how near this service is. */
export function relativeDay(iso, today) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  if (diff < -1 && diff >= -6) return `${diff * -1} days ago`;
  return '';
}

/* ── Where the data is ────────────────────────────────────────────────────── */

/**
 * FLCC.data() answers relative to the **site root** — './data.json' for
 * Abundance, './churches/shekinah/data.json' for everyone else — because every
 * page that has ever called it sits at the root. This app is one directory
 * below, so a root-relative answer has to be walked back up before it can be
 * fetched. Without this, a member of Abundance asks for
 * /sermon-notes/data.json and gets a 404.
 */
export function fromSiteRoot(path) {
  return '../' + String(path).replace(/^\.?\//, '');
}

/* ── Services ─────────────────────────────────────────────────────────────── */

export function noteId(date, service) { return `${date}|${service}`; }

export function parseNoteId(id) {
  const [date, service = ''] = String(id).split('|');
  return { date, service };
}

/**
 * The church's schedule, flattened into what a note needs to know: when it was,
 * what it was called, who preached and what the month's theme was. A schedule
 * row names its preacher by worker id, which means nothing to a member reading
 * notes a year later, so the name is resolved once, here.
 */
export function servicesFrom(data) {
  if (!data || !Array.isArray(data.schedule)) return [];
  const workers = new Map((data.workers || []).map((w) => [w.id, w]));
  const times = (data.meta && data.meta.serviceTimes) || {};
  const themes = data.themes || {};

  return data.schedule
    .filter((entry) => entry && entry.date && entry.service)
    .map((entry) => {
      const worker = workers.get(entry.roles && entry.roles.preacher);
      return {
        id: noteId(entry.date, entry.service),
        date: entry.date,
        service: entry.service,
        label: `${entry.service} Service`,
        time: times[entry.service] || '',
        preacher: worker ? [worker.title, worker.name].filter(Boolean).join(' ') : '',
        theme: themes[entry.date.slice(0, 7)] || '',
        special: entry.isSpecial ? (entry.specialNote || '').trim() : '',
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.service.localeCompare(b.service));
}

/**
 * Which service the app opens on.
 *
 * The order matters more than it looks. Somebody opening this during a service
 * wants today's, obviously. Somebody opening it on Monday is almost always
 * finishing Sunday's notes, not starting Friday's — so a service inside the
 * last few days beats the next one coming. Only once that window has passed
 * does looking forward make sense.
 */
export function chooseService(services, today, graceDays = 3) {
  if (!services.length) return null;

  const todays = services.filter((s) => s.date === today);
  if (todays.length) return todays[todays.length - 1];

  const past = services.filter((s) => s.date < today);
  const recent = past[past.length - 1];
  if (recent && daysBetween(recent.date, today) <= graceDays) return recent;

  const next = services.find((s) => s.date > today);
  return next || recent || services[services.length - 1];
}

/** The services worth offering in the switcher: everything near enough to be
 *  the one somebody means, newest first, plus any service they already wrote
 *  a note against however old it is. */
export function switchableServices(services, today, notes = {}, back = 120, ahead = 30) {
  return services
    .filter((s) => {
      const away = daysBetween(today, s.date);
      return (away <= ahead && away >= -back) || Object.prototype.hasOwnProperty.call(notes, s.id);
    })
    .slice()
    .reverse();
}

/* ── Note bodies ──────────────────────────────────────────────────────────── */

/** The members app writes its body as contentEditable HTML. This app writes
 *  plain text. Same test the app itself uses, so the two agree on what a body
 *  is before either of them touches it. */
export function looksLikeHtml(body) {
  return /<[a-z][\s\S]*>/i.test(String(body || ''));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#160': ' ' };

/** An existing HTML body, as the text a member actually wrote. Block ends
 *  become line breaks; everything else goes. */
export function htmlToText(body) {
  const raw = String(body || '');
  if (!looksLikeHtml(raw)) return raw;
  return raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n\u2022 ')
    .replace(/<\s*\/\s*li\s*>/gi, '')
    // One line break where one block ends and the next begins. Doing this
    // before the general rule below is what keeps a contentEditable body —
    // which is a run of <div>s, one per line — from doubling in height every
    // time it is read.
    .replace(/<\s*\/\s*(?:div|p|h[1-6])\s*>\s*<\s*(?:div|p|h[1-6])[^>]*>/gi, '\n')
    .replace(/<\s*\/?\s*(?:div|p|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#?\w+);/g, (whole, name) => (name.toLowerCase() in ENTITIES ? ENTITIES[name.toLowerCase()] : whole))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export const EMPTY_NOTE = { title: '', passage: '', body: '', verses: [], takeaway: '' };

/** A note read out of storage, with every field this app expects present and
 *  the body as text whichever app wrote it. */
export function readNote(stored) {
  const n = stored || {};
  return {
    ...EMPTY_NOTE,
    ...n,
    title: n.title || '',
    passage: n.passage || '',
    body: htmlToText(n.body),
    verses: Array.isArray(n.verses) ? n.verses.filter(Boolean) : [],
    takeaway: n.takeaway || '',
  };
}

export function noteIsEmpty(note) {
  const n = note || {};
  return !(n.title || '').trim() && !(n.passage || '').trim() && !(n.body || '').trim() &&
         !(n.takeaway || '').trim() && !(n.verses || []).length;
}

/** One line, for a list: the title if there is one, else the first thing
 *  written. */
export function noteSummary(note) {
  const n = readNote(note);
  if (n.title.trim()) return n.title.trim();
  const firstLine = n.body.split('\n').map((l) => l.trim()).find(Boolean);
  if (firstLine) return firstLine;
  if (n.passage.trim()) return n.passage.trim();
  if (n.verses.length) return n.verses.join(', ');
  return n.takeaway.trim() || 'Untitled';
}

/* ── The list ─────────────────────────────────────────────────────────────── */

/**
 * Every note somebody has written, newest first, each one carrying whatever the
 * schedule still knows about its service. A note whose service has since fallen
 * out of the published schedule keeps its own date and name rather than
 * disappearing — the note is the member's, not the schedule's.
 */
export function listNotes(notes = {}, services = []) {
  const byId = new Map(services.map((s) => [s.id, s]));
  return Object.entries(notes)
    .map(([id, stored]) => {
      const { date, service } = parseNoteId(id);
      const known = byId.get(id);
      return {
        id,
        date,
        service,
        label: known ? known.label : `${service} Service`,
        preacher: known ? known.preacher : '',
        note: readNote(stored),
        updatedAt: (stored && stored.updatedAt) || '',
      };
    })
    .filter((n) => n.date && !PSEUDO_SERVICES.has(n.service) && !noteIsEmpty(n.note))
    .sort((a, b) => b.date.localeCompare(a.date) || b.service.localeCompare(a.service));
}

export function searchNotes(list, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((n) => {
    const hay = [n.note.title, n.note.body, n.note.passage, n.note.takeaway,
                 n.note.verses.join(' '), n.preacher, n.label, n.date].join('\n').toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
}

/** Notes grouped into the months they were taken in, in list order. */
export function groupByMonth(list) {
  const groups = [];
  for (const item of list) {
    const key = item.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.notes.push(item);
    else groups.push({ key, label: monthLabel(key), notes: [item] });
  }
  return groups;
}

/* ── Sharing ──────────────────────────────────────────────────────────────── */

/**
 * A note as plain text, for copying into a message or printing. Nothing is
 * added that the member did not write — no headings over empty sections, no
 * "shared from" line under a note that is two sentences long.
 */
export function noteToText(note, service, churchName = '') {
  const n = readNote(note);
  const lines = [];

  if (n.title.trim()) lines.push(n.title.trim());

  const when = service ? `${dateLabel(service.date)} · ${service.label}` : '';
  if (when) lines.push(when);
  const who = [churchName, service && service.preacher ? `Preaching: ${service.preacher}` : '']
    .filter(Boolean).join(' · ');
  if (who) lines.push(who);

  if (n.passage.trim()) lines.push(`Passage: ${n.passage.trim()}`);
  if (lines.length) lines.push('');

  if (n.body.trim()) lines.push(n.body.trim(), '');
  if (n.verses.length) lines.push(`Verses: ${n.verses.join(', ')}`, '');
  if (n.takeaway.trim()) lines.push(`This week: ${n.takeaway.trim()}`, '');

  return lines.join('\n').trim() + '\n';
}
