#!/usr/bin/env node
/* ===========================================================================
 * setup-church.mjs — turn a fresh fork of this repo into one church's own app
 * ===========================================================================
 *
 *   node tools/setup-church.mjs --list
 *   node tools/setup-church.mjs --church "Shekinah"
 *   node tools/setup-church.mjs --church "Shekinah" --dry-run
 *
 * Every church in the FLCC BOTR network runs its own copy of this app. A copy
 * starts life as a fork of Abundance's, which means it starts out carrying
 * Abundance's *people* — 68 names, 37 birthdays, 29 anniversaries, ten
 * services' worth of who-was-absent, and six ministry heads' mobile numbers.
 * Published to a new GitHub Pages site, that would put Abundance's members'
 * details on the public web a second time, under a church they never
 * consented to.
 *
 * So this script does two things, and the second matters more than the first:
 *
 *   1. Rebrands the copy for the new church.
 *   2. Empties every file that holds another church's people.
 *
 * Structure is kept, contents are cleared: a schedule stays a schedule, it
 * just has no one in it yet. Shared network material — the BOTR vision and
 * statement of faith in botr.json, the monthly themes, the worship song
 * chords, the ministry-team names — is left alone, because it belongs to all
 * twelve churches equally and is the useful part of starting from a fork.
 *
 * No dependencies, no build step. Node 18+.
 * ------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...parts) => join(REPO_ROOT, ...parts);

/* ─── The church this repo currently belongs to ──────────────────────────────
 * Read from church-config.js rather than hardcoded, so this script still works
 * correctly when run a second time (e.g. a church renames itself), instead of
 * assuming everything still says "Abundance". */
function readCurrentConfig() {
  const src = readFileSync(p('church-config.js'), 'utf8');
  const grab = (key) => src.match(new RegExp(`^\\s*${key}:\\s*'([^']*)'`, 'm'))?.[1] ?? '';
  return {
    churchName:    grab('churchName'),
    satelliteName: grab('satelliteName'),
    sector:        grab('sector'),
  };
}

/* ─── CLI ────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt  = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};

const DRY_RUN   = flag('dry-run');
const KEEP_DATA = flag('keep-data');

const network = JSON.parse(readFileSync(p('botr.json'), 'utf8'));
const NETWORK_CHURCHES = network.satelliteChurches ?? [];

if (flag('list') || argv.length === 0) {
  console.log(`\n${network.name} — ${NETWORK_CHURCHES.length} churches\n`);
  for (const sector of ['Hope', 'Faith', 'Love']) {
    const inSector = NETWORK_CHURCHES.filter((c) => c.sector === sector);
    const lead = network.sectorLeaders?.find((s) => s.sector === sector);
    console.log(`  ${sector} sector${lead ? ` · ${lead.name}` : ''}`);
    for (const c of inSector) console.log(`      ${c.church}`);
  }
  console.log('\nSet this copy up for one of them:');
  console.log('  node tools/setup-church.mjs --church "Shekinah"\n');
  console.log('For a church not in the list above, add --sector:');
  console.log('  node tools/setup-church.mjs --church "New Plant" --sector Hope\n');
  process.exit(0);
}

const CHURCH = (opt('church') || '').trim();
if (!CHURCH) {
  console.error('Missing --church. Run with --list to see the network.');
  process.exit(1);
}

const known = NETWORK_CHURCHES.find(
  (c) => c.church.toLowerCase() === CHURCH.toLowerCase()
);
const SECTOR = opt('sector') || known?.sector;
if (!SECTOR) {
  console.error(
    `"${CHURCH}" is not one of the ${NETWORK_CHURCHES.length} churches in botr.json.\n` +
    'If that is intentional, say which sector it belongs to:\n' +
    `  node tools/setup-church.mjs --church "${CHURCH}" --sector Hope`
  );
  process.exit(1);
}

const CURRENT = readCurrentConfig();
const OLD = CURRENT.satelliteName;          // e.g. "Abundance"
const NEW = known?.church ?? CHURCH;        // canonical spelling from botr.json
const NEW_FULL = `FLCC - ${NEW} Church`;

if (!OLD) {
  console.error('Could not read satelliteName from church-config.js — is it intact?');
  process.exit(1);
}
if (OLD.toLowerCase() === NEW.toLowerCase() && !KEEP_DATA) {
  console.error(
    `This copy is already set up for ${NEW}. Running again would erase its ` +
    `own members, not another church's.\n` +
    'If you really mean to blank this church\'s data, do it from the admin ' +
    'pages instead, where it is a deliberate act.'
  );
  process.exit(1);
}

console.log(`\n  ${CURRENT.churchName}  →  ${NEW_FULL}`);
console.log(`  sector: ${SECTOR}${DRY_RUN ? '        (DRY RUN — nothing written)' : ''}\n`);

/* ─── Bookkeeping ────────────────────────────────────────────────────────── */
const changes = [];
const write = (relPath, text) => {
  if (!DRY_RUN) writeFileSync(p(relPath), text);
};
const readJSON  = (relPath) => JSON.parse(readFileSync(p(relPath), 'utf8'));
const writeJSON = (relPath, obj) => write(relPath, JSON.stringify(obj, null, 2) + '\n');

/* ─── 1. church-config.js ────────────────────────────────────────────────── */
{
  const src = readFileSync(p('church-config.js'), 'utf8');
  const updated = src
    .replace(/^(\s*churchName:\s*)'[^']*'/m,    `$1'${NEW_FULL}'`)
    .replace(/^(\s*satelliteName:\s*)'[^']*'/m, `$1'${NEW}'`)
    .replace(/^(\s*sector:\s*)'[^']*'/m,        `$1'${SECTOR}'`)
    // Comments name Abundance as the worked example; keep them truthful.
    .replace(/\(e\.g\. "Abundance-Fri"\)/g, `(e.g. "${NEW}-Fri")`);
  write('church-config.js', updated);
  changes.push('church-config.js — identity set');
}

/* ─── 2. Rebranding ──────────────────────────────────────────────────────────
 * Only this satellite's name changes. "FLCC" on its own is the network brand
 * and is correct for all twelve churches, so it is deliberately untouched.
 *
 * botr.json and botr-schedule.json are excluded: they describe the network,
 * where "Abundance" is a real and permanent entry in the church list, not a
 * label to be rewritten. */
const REBRAND_FILES = [
  'index.html', 'members.html', 'ask.html', 'prayer.html', 'music.html',
  'attendance.html', 'schedule-editor.html', 'verse-lookup.html',
  'bible-timeline.html', 'faith-map.html', 'scripture-timeline.html',
  'wwl2026.html',
  'data.json', 'prayer.json', 'music.json', 'worship.json', 'news.json',
  'attendance.json', 'equip.json',
];

// Longest patterns first — "FLCC - Abundance Church" must be consumed before
// the shorter "FLCC - Abundance" gets a chance at it.
const substitutions = [
  // The AI assistant's system prompt carries an alias that stops making sense
  // once renamed ("FLCC - Shekinah Church (also called Abundance Church)").
  [` (also called ${OLD} Church)`, ''],
  [`FLCC - ${OLD} Church`, `FLCC - ${NEW} Church`],
  [`FLCC · ${OLD} Church`, `FLCC · ${NEW} Church`],
  [`${OLD} Church FLCC`,   `${NEW} Church FLCC`],
  [`FLCC - ${OLD} Family`, `FLCC - ${NEW} Family`],
  [`FLCC - ${OLD}`,        `FLCC - ${NEW}`],
  [`FLCC ${OLD}`,          `FLCC ${NEW}`],
  [`#${OLD}Family`,        `#${NEW}Family`],
  [`${OLD}-Fri`,           `${NEW}-Fri`],
  [`${OLD}-Sun`,           `${NEW}-Sun`],
  [`${OLD} Church`,        `${NEW} Church`],
  // Catch-all for anything the patterns above missed — room names, stray
  // labels. Safe because the old satellite name never appears as an ordinary
  // English word in this repo (only "abundance" lowercase does, in devotional
  // text, which this does not match).
  [OLD, NEW],
];

for (const relPath of REBRAND_FILES) {
  if (!existsSync(p(relPath))) continue;
  const before = readFileSync(p(relPath), 'utf8');
  let after = before;
  let hits = 0;
  for (const [from, to] of substitutions) {
    const parts = after.split(from);
    hits += parts.length - 1;
    after = parts.join(to);
  }
  if (hits > 0) {
    write(relPath, after);
    changes.push(`${relPath} — ${hits} name${hits === 1 ? '' : 's'} rebranded`);
  }
}

/* ─── 3. Clearing the previous church's people ────────────────────────────── */
if (KEEP_DATA) {
  console.log(
    '  --keep-data given: another church\'s member data is being carried over.\n' +
    '  Only do this if that church has explicitly agreed to it.\n'
  );
} else {
  const blankMinistry = () => ({
    headName: '', headTitle: '', whatsapp: '', messenger: '', phone: '', email: '',
  });

  // data.json — the schedule, the workers, the ministry contact card.
  // themes stays: the monthly themes are network-wide.
  {
    const d = readJSON('data.json');
    const had = d.workers?.length ?? 0;
    d.meta = { ...d.meta, churchName: NEW_FULL, publishedAt: null };
    d.ministry = blankMinistry();
    d.workers = [];
    d.schedule = [];
    d.events = [];
    writeJSON('data.json', d);
    changes.push(`data.json — cleared ${had} workers, schedule and events (themes kept)`);
  }

  // attendance.json — who was present and who was absent, by name.
  {
    const a = readJSON('attendance.json');
    const had = a.sessions?.length ?? 0;
    a.meta = { ...a.meta, churchName: NEW_FULL, publishedAt: null, totalSessions: 0 };
    a.sessions = [];
    writeJSON('attendance.json', a);
    changes.push(`attendance.json — cleared ${had} sessions of attendance records`);
  }

  // prayer.json — intercessory list and meeting notes are pastorally
  // sensitive; the generic team names are a useful starting template.
  {
    const pr = readJSON('prayer.json');
    const had = (pr.workers?.length ?? 0) + (pr.intercessory?.length ?? 0);
    pr.meta = { ...pr.meta, churchName: NEW_FULL, publishedAt: null };
    pr.ministry = blankMinistry();
    pr.workers = [];
    pr.intercessory = [];
    pr.meetings = [];
    pr.teams = (pr.teams ?? []).map((t) => ({ ...t, leader: '' }));
    writeJSON('prayer.json', pr);
    changes.push(`prayer.json — cleared ${had} entries and all meetings (team names kept)`);
  }

  // music.json — roles/serviceTypes/settings are structure worth inheriting.
  {
    const m = readJSON('music.json');
    const had = (m.workers?.length ?? 0) + (m.entries?.length ?? 0);
    m.meta = { ...m.meta, churchName: NEW_FULL, publishedAt: null };
    m.ministry = blankMinistry();
    m.workers = [];
    m.entries = [];
    writeJSON('music.json', m);
    changes.push(`music.json — cleared ${had} musicians and rota entries`);
  }

  // equip.json — course material is worth keeping; the ministry directory
  // behind it is six people's personal mobile numbers.
  {
    const e = readJSON('equip.json');
    const had = e.ministries?.length ?? 0;
    e.meta = { ...e.meta, churchName: NEW_FULL, publishedAt: null };
    e.ministries = (e.ministries ?? []).map((m) => ({
      id: m.id, name: m.name, icon: m.icon, color: m.color, ...blankMinistry(),
    }));
    e.courses = (e.courses ?? []).map((c) => ({ ...c, facilitator: '' }));
    writeJSON('equip.json', e);
    changes.push(`equip.json — cleared ${had} ministry contacts (courses kept)`);
  }

  // worship.json — song titles, keys and chords. Shared musical material with
  // nobody's personal details in it, so it carries over as-is.
  {
    const relPath = 'worship.json';
    if (existsSync(p(relPath))) {
      const w = readJSON(relPath);
      w.meta = { ...w.meta, churchName: NEW_FULL };
      writeJSON(relPath, w);
    }
  }

  // news.json — one church's announcements, naming individuals ("Bro. Allen's
  // birthday", who leads which course). Not transferable.
  {
    const relPath = 'news.json';
    if (existsSync(p(relPath))) {
      const n = readJSON(relPath);
      const had = n.items?.length ?? 0;
      n.meta = { ...n.meta, churchName: NEW_FULL };
      n.items = [];
      writeJSON(relPath, n);
      changes.push(`news.json — cleared ${had} announcements naming individuals`);
    }
  }

  /* The Equip course catalogue is worth inheriting — but each course names the
   * person who runs it, and that person serves one church. */
  for (const relPath of ['index.html', 'members.html']) {
    if (!existsSync(p(relPath))) continue;
    const src = readFileSync(p(relPath), 'utf8');
    const hits = (src.match(/facilitator: '[^']*'/g) || []).length;
    if (hits) {
      write(relPath, src.replace(/facilitator: '[^']*'/g, "facilitator: ''"));
      changes.push(`${relPath} — cleared ${hits} course facilitator names`);
    }
  }

  // The Kasama companion names a specific pastor and congregation.
  {
    const relPath = 'ofw-companion/data/biblestudy.json';
    if (existsSync(p(relPath))) {
      const b = readJSON(relPath);
      if (b.pastor) b.pastor = { ...b.pastor, name: '', role: '', message: '' };
      writeJSON(relPath, b);
      changes.push(`${relPath} — cleared the named pastor's greeting`);
    }
  }

  // A leftover export that duplicates the full worker list. Nothing reads it;
  // it would just quietly republish 68 names from a fork.
  {
    const stale = 'flcc-schedule-2026-05-12.json';
    if (existsSync(p(stale))) {
      if (!DRY_RUN) rmSync(p(stale));
      changes.push(`${stale} — deleted (stale export holding a full member list)`);
    }
  }

  /* Some pages carry real people in their own source, not in a data file —
   * starter lists that were filled in with actual members and never taken
   * out. Clearing the JSON alone leaves these behind, which is how a fork
   * ends up publishing another church's members from the page itself.
   *
   * The worst of them is index.html's prayer and praise wall: named requests
   * about people's health, families and workplaces, written into the source
   * as sample content. */
  const SEEDED_PEOPLE = [
    ['prayer.html', ['SEED_WORKERS', 'SEED_MEETINGS']],
    ['music.html',  ['SEED_WORKERS', 'SEED_ENTRIES']],
    ['index.html',  [
      // 41 real members, used to populate a leaderboard.
      'ARENA_MEMBER_NAMES',
      // Named prayer requests and praise reports — health, work, family.
      'ARENA_SIMULATED_PRAISES',
      'ARENA_SIMULATED_PRAYERS',
    ]],
  ];

  for (const [relPath, constants] of SEEDED_PEOPLE) {
    if (!existsSync(p(relPath))) continue;
    let src = readFileSync(p(relPath), 'utf8');
    const emptied = [];
    const missing = [];

    for (const name of constants) {
      // From `const NAME = [` up to the first `];` sitting on its own line.
      const re = new RegExp(`(const\\s+${name}\\s*=\\s*\\[)[\\s\\S]*?\\n\\];`);
      if (re.test(src)) {
        src = src.replace(re, '$1];');
        emptied.push(name);
      } else {
        missing.push(name);
      }
    }

    if (missing.length) {
      // Loud, because the failure mode is silent republication of real names.
      console.warn(
        `\n  !! ${relPath}: could not find ${missing.join(', ')}.\n` +
        '     The page may have been restructured since this script was ' +
        'written.\n     Open it and check by hand for real member names ' +
        'before publishing.\n'
      );
    }
    if (emptied.length) {
      write(relPath, src);
      changes.push(`${relPath} — emptied ${emptied.join(', ')}`);
    }
  }

  /* Prayer meeting venues are people's homes — "Siangco Family Flat" names a
   * family and says where they live. Replaced with neutral placeholders
   * rather than emptied, so the dropdown still demonstrates the idea. */
  {
    const relPath = 'prayer.html';
    if (existsSync(p(relPath))) {
      const src = readFileSync(p(relPath), 'utf8');
      const re = /(const\s+SEED_VENUES\s*=\s*\[)[\s\S]*?\n\];/;
      if (re.test(src)) {
        const generic = [
          'Church Hall',
          'Host Family Flat',
          'HS-ZOOM',
          'CPM-ZOOM',
        ].map((v) => `  '${v}',`).join('\n');
        write(relPath, src.replace(re, `$1\n${generic}\n];`));
        changes.push(`${relPath} — replaced venue list (was named family homes)`);
      } else {
        console.warn(
          `\n  !! ${relPath}: could not find SEED_VENUES — check by hand for ` +
          'named family homes.\n'
        );
      }
    }
  }
}

/* ─── Report ─────────────────────────────────────────────────────────────── */
console.log('  Changes');
for (const c of changes) console.log(`    · ${c}`);

if (DRY_RUN) {
  console.log('\n  Dry run — nothing was written. Re-run without --dry-run to apply.\n');
  process.exit(0);
}

console.log(`
  Done. ${NEW} now has an empty app of its own.

  Next, in order:

    1. Commit and push:
         git add -A && git commit -m "Set up app for FLCC - ${NEW}" && git push

    2. Turn on GitHub Pages — Settings → Pages → Branch: main, folder: /
       Your site: https://<your-github-name>.github.io/<this-repo>/

    3. Check the publishing target. Open attendance.html on the live site and
       look at the token setup panel: it should name YOUR repo. It detects this
       from the URL, so on a github.io address there is nothing to configure.
       If you use a custom domain, set repo in church-config.js by hand.

    4. Create a publishing token — github.com → Settings → Developer settings
       → Personal access tokens → Fine-grained. Repository access: only
       select repositories → THIS repo alone. Permission: Contents → Read and
       write. Paste it into the admin page when it asks.

       One token per church, scoped to that church's repo only. A token that
       can reach a second church's repo is the one mistake worth being
       careful about.

    5. Add your own people through schedule-editor.html, then publish.

  Before you invite members in, read docs/NEW-CHURCH-SETUP.md — particularly
  the part about everything on this site being publicly readable. Your
  congregation should be told that before their birthdays are on it.
`);
