/**
 * The 14-church network: the registry, every church's data files, and the
 * "one copy of the app, only the data differs" rule.
 *
 * Several checks here are grep-shaped rather than behavioural. That is
 * deliberate: the bugs they guard against — a church name typed into a shared
 * file, a link pinned to a repo name, a month frozen into a default — are
 * invisible at runtime for whoever wrote them and only wrong for the other
 * thirteen churches, or only wrong later.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadChurch, readRepoFile, readRepoJSON, exists } from './lib/extract.mjs';

const FLCC = loadChurch();
const CHURCHES = FLCC.churches;

/** Every page that renders for a member or a ministry lead. */
const APP_PAGES = ['index.html', 'attendance.html', 'prayer.html', 'music.html', 'schedule-editor.html', 'roster.html'];

// ── The registry ─────────────────────────────────────────────────────────────

test('the registry holds all 14 churches with unique slugs', () => {
  assert.equal(CHURCHES.length, 14);
  const slugs = CHURCHES.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs must be unique');
});

test('every church has the fields the app reads', () => {
  for (const c of CHURCHES) {
    assert.match(c.slug, /^[a-z0-9-]+$/, `${c.slug}: slug must be URL-safe`);
    assert.ok(c.name && c.short, `${c.slug}: needs a name and a short name`);
    assert.ok(['Hope', 'Faith', 'Love'].includes(c.sector), `${c.slug}: sector must be one of the three`);
    assert.match(c.accent, /^#[0-9A-Fa-f]{6}$/, `${c.slug}: accent must be a hex colour`);
    assert.ok(c.dataBase, `${c.slug}: needs a dataBase`);
  }
});

test('Abundance keeps the root paths and the un-prefixed storage keys', () => {
  // Every device already using the app depends on this; changing it silently
  // logs out every existing member and loses their notes and streaks.
  const abundance = loadChurch('https://example.org/index.html?church=abundance');
  assert.equal(abundance.data('data.json'), './data.json');
  assert.equal(abundance.publishPath('attendance.json'), 'attendance.json');
  assert.equal(abundance.key('flcc-members-me'), 'flcc-members-me');
});

test('every other church is namespaced in both storage and paths', () => {
  for (const c of CHURCHES.filter(c => c.slug !== 'abundance')) {
    const church = loadChurch(`https://example.org/index.html?church=${c.slug}`);
    assert.equal(church.key('flcc-members-me'), `${c.slug}:flcc-members-me`);
    assert.equal(church.data('data.json'), `./churches/${c.slug}/data.json`);
    assert.equal(church.publishPath('data.json'), `churches/${c.slug}/data.json`);
  }
});

test('a church is resolved from the pretty path, then the query, then storage', () => {
  assert.equal(loadChurch('https://example.org/c/shekinah/').slug, 'shekinah');
  assert.equal(loadChurch('https://example.org/index.html?church=mtcc').slug, 'mtcc');
  assert.equal(loadChurch('https://example.org/index.html').slug, 'abundance', 'the default');
});

test('the pretty path wins over a conflicting query string', () => {
  assert.equal(loadChurch('https://example.org/c/shekinah/?church=mtcc').slug, 'shekinah');
});

test('an unknown slug falls back to the default and is not remembered', () => {
  // A typo must not strand someone in the wrong church on every later visit.
  const church = loadChurch('https://example.org/index.html?church=nope');
  assert.equal(church.slug, 'abundance');
  assert.equal(church.explicit, false);
});

test('the app is served from a subpath as happily as from a domain root', () => {
  // GitHub Pages serves this repo from a project subpath.
  assert.equal(loadChurch('https://example.org/flcc-members-2026/c/gil/').slug, 'gil');
});

test('publish paths stay inside the church that asked for them', () => {
  for (const c of CHURCHES) {
    const church = loadChurch(`https://example.org/index.html?church=${c.slug}`);
    const target = church.publishPath('attendance.json');
    assert.ok(!target.startsWith('/') && !target.includes('..'), `${c.slug}: ${target} must stay in-repo`);
    if (c.slug !== 'abundance') assert.ok(target.startsWith(`churches/${c.slug}/`), `${c.slug}: ${target}`);
  }
});

// ── Each church's files ──────────────────────────────────────────────────────

/** Where a church's files live, relative to the repo root. */
const dir = slug => (slug === 'abundance' ? '' : `churches/${slug}/`);

test('every church has the two files it needs to go live', () => {
  for (const c of CHURCHES) {
    assert.ok(exists(`${dir(c.slug)}data.json`), `${c.slug}: data.json is required`);
    assert.ok(exists(`${dir(c.slug)}attendance.json`), `${c.slug}: attendance.json is required`);
  }
});

test('every church has a pretty link page', () => {
  for (const c of CHURCHES) {
    assert.ok(exists(`c/${c.slug}/index.html`), `${c.slug}: missing c/${c.slug}/index.html — re-run scripts/build-church-links.mjs`);
  }
});

test("every data.json has a roster the app can read", () => {
  for (const c of CHURCHES) {
    const data = readRepoJSON(`${dir(c.slug)}data.json`);
    assert.ok(Array.isArray(data.workers), `${c.slug}: workers must be an array`);

    const ids = data.workers.map(w => w.id);
    assert.equal(new Set(ids).size, ids.length, `${c.slug}: worker ids must be unique`);

    for (const w of data.workers) {
      assert.ok(w.id, `${c.slug}: every worker needs an id`);
      assert.ok(w.name, `${c.slug}: worker ${w.id} needs a name`);
      assert.ok(['active', 'inactive'].includes(w.status), `${c.slug}: worker ${w.id} has status "${w.status}"`);
    }
  }
});

test('birthdays and anniversaries are stored as MM-DD', () => {
  // upcomingOccasions skips anything else, so a full date means a member is
  // silently never greeted.
  for (const c of CHURCHES) {
    for (const w of readRepoJSON(`${dir(c.slug)}data.json`).workers) {
      for (const field of ['birthday', 'anniversary']) {
        if (!w[field]) continue;
        assert.match(w[field], /^\d{2}-\d{2}$/, `${c.slug}: ${w.name} has ${field} "${w[field]}", expected MM-DD`);
        const [month, day] = w[field].split('-').map(Number);
        assert.ok(month >= 1 && month <= 12, `${c.slug}: ${w.name} ${field} month ${month}`);
        assert.ok(day >= 1 && day <= 31, `${c.slug}: ${w.name} ${field} day ${day}`);
      }
    }
  }
});

test('nobody is marked as belonging to both Friday-only and Sunday-only', () => {
  for (const c of CHURCHES) {
    for (const w of readRepoJSON(`${dir(c.slug)}data.json`).workers) {
      assert.ok(!(w.fridayOnly && w.sundayOnly), `${c.slug}: ${w.name} cannot be both fridayOnly and sundayOnly`);
    }
  }
});

test('schedule entries point at workers who exist', () => {
  for (const c of CHURCHES) {
    const data = readRepoJSON(`${dir(c.slug)}data.json`);
    const known = new Set(data.workers.map(w => w.id));
    for (const entry of (data.schedule || [])) {
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `${c.slug}: entry ${entry.id} has date "${entry.date}"`);
      for (const [role, id] of Object.entries(entry.roles || {})) {
        if (!id) continue;
        assert.ok(known.has(id), `${c.slug}: ${entry.date} ${role} points at unknown worker "${id}"`);
      }
    }
  }
});

test('every published attendance file matches the shape the members app reads', () => {
  for (const c of CHURCHES) {
    const att = readRepoJSON(`${dir(c.slug)}attendance.json`);
    assert.ok(Array.isArray(att.sessions), `${c.slug}: sessions must be an array`);
    for (const s of att.sessions) {
      assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/, `${c.slug}: session ${s.id} date`);
      assert.ok(s.service, `${c.slug}: session ${s.id} needs a service`);
      assert.ok(Array.isArray(s.records), `${c.slug}: session ${s.id} records`);
      if (s.summary) {
        assert.equal(
          s.summary.present, s.records.filter(r => r.status === 'present').length,
          `${c.slug}: session ${s.id} summary.present disagrees with its own records`,
        );
        assert.ok(s.summary.total >= s.summary.present, `${c.slug}: session ${s.id} has more present than total`);
      }
    }
  }
});

// ── One app, fourteen churches ───────────────────────────────────────────────

/** Drop comments, so a note like {/* FLCC BOTR Friday card *​/} isn't mistaken
 *  for a string that reaches a member. `//` is only treated as a comment when
 *  it isn't part of a URL. */
function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('no church name is hardcoded into a shared page', () => {
  // "FLCC - FARWANIYA 1" sat in the weekly summary every steward sends their
  // pastor, and in the printed sermon journal, for all 14 churches.
  //
  // roster.html is exempt on purpose: it is deliberately self-contained so it
  // can be emailed as a file, so its church list is stamped in rather than read
  // from the registry. The test below checks that list stays complete instead.
  const names = CHURCHES.map(c => c.short).filter(s => s.length > 3);
  for (const page of APP_PAGES.filter(p => p !== 'roster.html')) {
    const src = withoutComments(readRepoFile(page));
    for (const name of [...names, 'Farwaniya']) {
      const hit = new RegExp(`FLCC[\\s-]+${name}\\b`, 'i').exec(src);
      assert.equal(hit, null, `${page}: hardcodes "${hit && hit[0]}" — read CHURCH.name instead`);
    }
  }
});

test('no page pins a link to the repository name', () => {
  // The prayer announcement pointed at flcc-schedule-os for months after the
  // rename. FLCC.prettyUrl() builds the link from wherever the app is served.
  for (const page of APP_PAGES) {
    const hit = /https:\/\/[a-z0-9-]+\.github\.io\/[^\s"'`)]+/i.exec(readRepoFile(page));
    assert.equal(hit, null, `${page}: hardcodes "${hit && hit[0]}" — use FLCC.prettyUrl()`);
  }
});

test('no dashboard opens on a month frozen into the source', () => {
  // '2026-06' and '2026-04' shipped as the starting month, so a ministry lead
  // on a new device landed on an empty month in the past.
  for (const page of ['prayer.html', 'music.html']) {
    const hit = /currentMonth:\s*'(\d{4}-\d{2})'/.exec(readRepoFile(page));
    assert.equal(hit, null, `${page}: opens on the hardcoded month ${hit && hit[1]} — derive it from today`);
  }
});

test('pages read their data through FLCC rather than fixed paths', () => {
  for (const page of APP_PAGES.filter(p => p !== 'roster.html')) {
    const src = readRepoFile(page);
    const hit = /fetch\(\s*['"`]\.?\/?(?:data|attendance|prayer|music|equip|worship)\.json/.exec(src);
    assert.equal(hit, null, `${page}: fetches a fixed path — use CHURCH.data('…')`);
  }
});

test('roster.html stays self-contained so it works as an email attachment', () => {
  // It is sent to churches as a file and opened with no internet.
  const src = readRepoFile('roster.html');
  assert.equal(/<script[^>]+src=/i.exec(src), null, 'roster.html must not load external scripts');
  assert.equal(/<link[^>]+href=["']https?:/i.exec(src), null, 'roster.html must not load remote stylesheets');
});

test('roster.html offers every church in the registry', () => {
  // Its list is stamped in by build-church-links.mjs rather than read at run
  // time, so it goes stale silently when a church is added.
  const src = readRepoFile('roster.html');
  for (const c of CHURCHES) {
    assert.ok(
      src.includes(`value="${c.slug}"`),
      `roster.html is missing ${c.slug} — re-run scripts/build-church-links.mjs`,
    );
  }
});

// ── The one shared schedule ──────────────────────────────────────────────────

test("BOTR Friday's morning service is one shared file, not a per-church one", () => {
  // The whole network is invited to this service, so all 14 churches read the
  // same file. Loading it through FLCC.data() would send each church looking
  // for its own copy and the card would appear for BOTR Friday alone.
  assert.ok(exists('botr-schedule.json'), 'the shared schedule lives at the repo root');

  for (const c of CHURCHES) {
    assert.ok(
      !exists(`churches/${c.slug}/botr-schedule.json`),
      `${c.slug}: a per-church copy would shadow the shared one`,
    );
  }

  const src = readRepoFile('index.html');
  assert.match(src, /const BOTR_SCHEDULE_URL\s*=\s*'\.\/botr-schedule\.json'/,
    'index.html must read the shared path, not CHURCH.data()');
  assert.equal(/BOTR_SCHEDULE_URL\s*=\s*CHURCH\.data\(/.exec(src), null,
    'CHURCH.data() would scope the shared service to one church');
});

test('the shared schedule is every Friday, in order, with no duplicates', () => {
  const botr = readRepoJSON('botr-schedule.json');
  assert.ok(Array.isArray(botr.schedule) && botr.schedule.length > 0);
  assert.equal(botr.meta.serviceTime, '10:00 AM');

  const seen = new Set();
  for (const e of botr.schedule) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `bad date "${e.date}"`);
    assert.ok(!seen.has(e.date), `${e.date} appears twice`);
    seen.add(e.date);

    const [y, m, d] = e.date.split('-').map(Number);
    assert.equal(new Date(y, m - 1, d).getDay(), 5, `${e.date} is not a Friday`);
  }
});

test('a service is either fully assigned or left blank, never half-entered', () => {
  // A row with a preacher but no emcee usually means a transcription stopped
  // halfway rather than a service genuinely missing its emcee.
  for (const e of readRepoJSON('botr-schedule.json').schedule) {
    const filled = ['preacher', 'pastoralPrayer', 'emcee'].filter(k => (e[k] || '').trim());
    assert.ok(
      filled.length === 0 || filled.length === 3,
      `${e.date}: ${filled.length} of 3 roles filled (${filled.join(', ')})`,
    );
  }
});

// ── Network announcements ────────────────────────────────────────────────────

test('announcements are one shared file every church reads', () => {
  assert.ok(exists('announcements.json'), 'the shared file lives at the repo root');

  for (const c of CHURCHES) {
    assert.ok(!exists(`churches/${c.slug}/announcements.json`),
      `${c.slug}: a per-church copy would shadow the shared one`);
  }

  const src = readRepoFile('index.html');
  assert.match(src, /const ANNOUNCEMENTS_URL\s*=\s*'\.\/announcements\.json'/,
    'index.html must read the shared path');
  assert.equal(/ANNOUNCEMENTS_URL\s*=\s*CHURCH\.data\(/.exec(src), null,
    'CHURCH.data() would scope a network announcement to one church');
});

test('every announcement has what the card needs to render', () => {
  const { announcements } = readRepoJSON('announcements.json');
  assert.ok(Array.isArray(announcements));
  const seen = new Set();
  for (const a of announcements) {
    assert.ok(a.id && !seen.has(a.id), `duplicate or missing id: ${a.id}`);
    seen.add(a.id);
    assert.ok(a.title, `${a.id}: needs a title — it is the line members read`);
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/, `${a.id}: date must be YYYY-MM-DD`);
    if (a.startTime) assert.match(a.startTime, /^\d{2}:\d{2}$/, `${a.id}: startTime must be HH:MM`);
    if (a.endTime) assert.match(a.endTime, /^\d{2}:\d{2}$/, `${a.id}: endTime must be HH:MM`);
  }
});

test('the notification bell reaches members who have not picked a name', () => {
  // A network announcement is not tied to a member's own assignments, so the
  // bell must render even when `me` is null.
  const src = readRepoFile('index.html');
  assert.equal(/\{me && <NotificationBell/.exec(src), null,
    'gating the bell on `me` hides network announcements from anyone who skipped sign-in');
  assert.match(src, /<NotificationBell[^>]*announcements=\{announcements\}/,
    'the bell must receive the announcements');
});

test('every BOTR duty reference points at a real member of a real church', () => {
  // References are church-qualified ("ft:bro-17") because a worker id is only
  // unique inside its own church. A typo here means someone quietly never
  // gets told they are serving.
  const known = new Set(CHURCHES.map(c => c.slug));
  const rosters = new Map(CHURCHES.map(c => [c.slug, new Set(readRepoJSON(`${dir(c.slug)}data.json`).workers.map(w => w.id))]));

  for (const entry of readRepoJSON('botr-schedule.json').schedule) {
    for (const role of ['preacher', 'pastoralPrayer', 'emcee']) {
      const ref = entry[`${role}Id`];
      if (!ref) continue;   // display-only entries are fine

      assert.match(ref, /^[a-z0-9-]+:[A-Za-z0-9-]+$/, `${entry.date} ${role}: "${ref}" must be "<church>:<worker-id>"`);
      const [slug, workerId] = ref.split(':');
      assert.ok(known.has(slug), `${entry.date} ${role}: unknown church "${slug}"`);
      assert.ok(rosters.get(slug).has(workerId), `${entry.date} ${role}: "${workerId}" is not on ${slug}'s roster`);

      // A linked role must still carry the display name the shared card shows.
      assert.ok((entry[role] || '').trim(), `${entry.date} ${role}: linked but has no name to display`);
    }
  }
});
