/**
 * Spreadsheet import — turning a real church's roster and worker's schedule
 * into Shepherd records, entirely client-side.
 *
 * This reads CSV a church admin exports from whatever they already use
 * (Google Sheets, Excel, the FLCC family-members form) and turns it into
 * plain candidate records. It never writes to the database itself and never
 * sends anything anywhere — the caller (settings.js) shows a preview, lets
 * the admin see exactly what will be created, and only then calls
 * `ctx.db.insert(...)` the same way every other screen in Shepherd does.
 * Real names, phone numbers and addresses exist only in memory here, and
 * afterwards only in that church's own local database — never in a file
 * this codebase ships or commits.
 */

import { parseCSV, mapColumns } from './csv.js';

const TITLE_PREFIXES = /^(bro|sis|ptr|pastor|pst|elder|dr|rev|bishop|deacon|deaconess)\.?\s+/i;

/* ── members ─────────────────────────────────────────────────────────────── */

const MEMBER_FIELD_MAP = {
  fullName: ['Complete Name', 'Full Name', 'Name'],
  gender: ['Sex', 'Gender'],
  maritalStatus: ['Civil Status', 'Marital Status'],
  birthDate: ['Date of Birth', 'Birth Date', 'DOB'],
  phAddress: ['Complete Philippine Address', 'Philippine Address'],
  kuwaitAddress: ['Kuwait Address', 'Kuwait Address '],
  currentLocation: ['Current Location'],
  address: ['Address'],
  mobileEmail: ['Mobile Number/Email Address', 'Mobile Number Email Address'],
  phMobile: ['Philippine Mobile Number', 'Philippine Mobile Number ', 'Mobile Number'],
  kuwaitMobile: ['Kuwait Mobile Number'],
  email: ['Email Address', 'Email'],
  satelliteChurch: ['Satellite Church'],
  ministryInterest: ['Ministry Interest/s', 'Ministry Interests', 'Ministry Interest'],
  joiningYear: ['Joining Year in FLCC', 'Joining Year'],
  spouseName: ['Spouse Name (First Name, Last Name)', 'Spouse Name'],
  childrenNames: ["Children/s Name (First Name, Last Name)", "Children's Names", 'Children Name'],
  anniversary: ['Wedding Anniversary Date', 'Anniversary'],
  company: ['Company(Working At)', 'Company'],
};

const GENDER_MAP = { female: 'female', male: 'male' };
const MARITAL_MAP = { married: 'married', single: 'single', widowed: 'widowed', separated: 'separated' };

/**
 * @param {string} text
 * @param {{satelliteChurchFilter?: string}} [opts]
 * @returns {{records: object[], warnings: string[], matchedHeaders: Record<string,string>}}
 */
export function parseMembersCSV(text, { satelliteChurchFilter = '' } = {}) {
  const rows = parseCSV(text);
  const { records: raw, matchedHeaders } = mapColumns(rows, MEMBER_FIELD_MAP);
  const warnings = [];
  if (!matchedHeaders.fullName) {
    warnings.push('No name column found — expected a header like "Complete Name" or "Full Name".');
    return { records: [], warnings, matchedHeaders };
  }

  const filter = satelliteChurchFilter.trim().toLowerCase();
  const records = [];
  raw.forEach((row, i) => {
    const rowNum = i + 2; // header is row 1
    if (filter && matchedHeaders.satelliteChurch && !String(row.satelliteChurch || '').toLowerCase().includes(filter)) return;

    const fullName = cleanName(row.fullName);
    if (!fullName) { warnings.push(`Row ${rowNum}: no name, skipped.`); return; }

    const { phone, email } = splitContact(row.mobileEmail, row.phMobile, row.kuwaitMobile, row.email);
    const area = row.currentLocation || row.address || firstLine(row.kuwaitAddress) || '';
    const notesParts = [];
    if (row.company) notesParts.push(`Works at ${row.company}.`);
    if (row.spouseName) notesParts.push(`Spouse: ${row.spouseName}.`);
    if (row.childrenNames) notesParts.push(`Children: ${row.childrenNames}.`);
    if (row.phAddress && row.phAddress !== area) notesParts.push(`Philippine address: ${row.phAddress}.`);
    if (row.kuwaitAddress && row.kuwaitAddress !== area) notesParts.push(`Kuwait address: ${row.kuwaitAddress}.`);

    records.push({
      fullName,
      gender: GENDER_MAP[String(row.gender || '').toLowerCase()] || 'unspecified',
      maritalStatus: MARITAL_MAP[String(row.maritalStatus || '').toLowerCase()] || undefined,
      birthDate: parseFlexibleDate(row.birthDate),
      anniversary: parseFlexibleDate(row.anniversary),
      area,
      phone,
      email,
      ministries: splitList(row.ministryInterest),
      joinedOn: parseYear(row.joiningYear),
      notes: notesParts.join(' '),
      status: 'member',
    });
  });

  return { records, warnings, matchedHeaders };
}

function cleanName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim().replace(/,$/, '');
}

function firstLine(text) {
  return String(text || '').split(/\n|,/)[0].trim();
}

function splitList(text) {
  return String(text || '').split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
}

function splitContact(combined, phMobile, kuwaitMobile, emailCol) {
  const lines = String(combined || '').split(/\n/).map((s) => s.trim()).filter(Boolean);
  let phone = phMobile || kuwaitMobile || '';
  let email = emailCol || '';
  for (const line of lines) {
    if (/@/.test(line)) email = email || line;
    else if (/\d{4,}/.test(line)) phone = phone || line;
  }
  return { phone, email };
}

/** "2019" → "2019-01-01"; anything else is left for the admin to fill in by hand. */
function parseYear(text) {
  const match = String(text || '').match(/(19|20)\d{2}/);
  return match ? `${match[0]}-01-01` : null;
}

/**
 * Tolerant of what a spreadsheet actually contains — "5/16/1986",
 * "1986-05-16", a bare year. Returns an ISO date string, or null rather than
 * guessing at an ambiguous one.
 */
export function parseFlexibleDate(text) {
  const str = String(text || '').trim();
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${String(slash[1]).padStart(2, '0')}-${String(slash[2]).padStart(2, '0')}`;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/* ── worship service schedule ────────────────────────────────────────────── */

const SCHEDULE_FIELD_MAP = {
  date: ['Date'],
  serviceType: ['Service Type', 'Service', 'Day'],
  theme: ['Theme'],
  presider: ['Presider', 'Presiding Leader'],
  songLeader: ['Song Leader', 'Worship Leader', 'Worship & Song Leader', 'Worship And Song Leader'],
  preacher: ['Preacher'],
  pastoralPrayer: ['Pastoral Prayer'],
  foodInCharge: ['Food-In-Charge', 'Food In Charge', 'Food'],
  communion: ['Communion Assistant', 'Communion Assistants', 'Communion'],
};

/**
 * @param {string} text
 * @param {{defaultYear?: number}} [opts] applied to a date with no year of its own, e.g. "07-Aug"
 * @returns {{records: object[], warnings: string[], matchedHeaders: Record<string,string>}}
 */
export function parseScheduleCSV(text, { defaultYear } = {}) {
  const rows = parseCSV(text);
  const { records: raw, matchedHeaders } = mapColumns(rows, SCHEDULE_FIELD_MAP);
  const warnings = [];
  if (!matchedHeaders.date) {
    warnings.push('No date column found — expected a header like "Date".');
    return { records: [], warnings, matchedHeaders };
  }

  const records = [];
  raw.forEach((row, i) => {
    const rowNum = i + 2;
    const date = parseScheduleDate(row.date, defaultYear);
    if (!date) { warnings.push(`Row ${rowNum}: could not read the date "${row.date}", skipped.`); return; }

    const serviceTypeRaw = String(row.serviceType || '').toLowerCase();
    const serviceType = serviceTypeRaw.includes('fri') ? 'friday' : serviceTypeRaw.includes('sun') ? 'sunday' : 'other';

    records.push({
      date,
      serviceType,
      service: serviceType === 'friday' ? 'Friday Worship' : serviceType === 'sunday' ? 'Sunday Worship' : (row.serviceType || 'Service'),
      theme: row.theme || '',
      presiderName: row.presider || '',
      songLeaderName: row.songLeader || '',
      preacherName: row.preacher || '',
      pastoralPrayerName: row.pastoralPrayer || '',
      foodInCharge: row.foodInCharge || '',
      communionNote: row.communion || '',
    });
  });

  return { records, warnings, matchedHeaders };
}

/** "07-Aug" needs a year from elsewhere; "07-Aug-2026" or "2026-08-07" already carries one. */
function parseScheduleDate(text, defaultYear) {
  const str = String(text || '').trim();
  if (!str) return null;
  if (/\d{4}/.test(str)) return parseFlexibleDate(str);
  if (defaultYear) return parseFlexibleDate(`${str}-${defaultYear}`);
  return null;
}

/* ── FLCC attendance sync ────────────────────────────────────────────────── */
//
// A deliberate, narrow exception to Shepherd's usual separation from the
// FLCC Members app: when both apps are hosted on the same domain (the
// standard deployment — see CLAUDE.md), FLCC's attendance.json is a public,
// read-only static file, no different from a CSV a church admin might have
// exported by hand. Shepherd only ever reads it — never writes back, never
// touches FLCC's storage keys, and matches people by name exactly the way a
// manual import already does. See settings.js's "FLCC attendance sync" card.

/**
 * @param {object} flccData parsed contents of FLCC's attendance.json
 * @returns {{date: string, service: string, presentNames: string[], total: number}[]}
 */
export function parseFLCCAttendance(flccData) {
  const sessions = (flccData && flccData.sessions) || [];
  return sessions
    .filter((s) => s && s.date)
    .map((s) => {
      const records = s.records || [];
      const presentNames = records.filter((r) => r.status === 'present').map((r) => r.memberName).filter(Boolean);
      return {
        date: s.date,
        service: s.serviceLabel || s.service || 'Service',
        presentNames,
        total: (s.summary && typeof s.summary.present === 'number') ? s.summary.present : presentNames.length,
      };
    });
}

/**
 * Fetches FLCC's attendance.json from the site root — only correct when
 * Shepherd is deployed under the same domain as the FLCC app (e.g.
 * `/shepherd/` alongside `/attendance.json`), which is this repo's standard
 * deployment. Returns `[]` rather than throwing when unreachable, so a sync
 * attempt on a differently-hosted Shepherd instance degrades quietly.
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchFLCCAttendance(fetchImpl = fetch) {
  try {
    const res = await fetchImpl('/attendance.json');
    if (!res.ok) return [];
    return parseFLCCAttendance(await res.json());
  } catch {
    return [];
  }
}

/* ── name matching ───────────────────────────────────────────────────────── */

/** Shared by the schedule name-matcher and the Settings duplicate check — one idea of "same person's name" everywhere. */
export function normalizeName(raw) {
  return String(raw || '')
    .replace(TITLE_PREFIXES, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best-effort match against existing members — a schedule says "Ptr. Justin
 * Flores", a member record says "Flores, Justin M". Exact match first, then
 * "every word in the schedule name appears somewhere in the member's name",
 * which survives reordering and a missing middle name. Returns null (not a
 * guess) when nothing or more than one equally-good candidate matches.
 *
 * @param {{id: string, fullName: string}[]} members
 * @param {string} rawName
 * @returns {{id: string, fullName: string}|null}
 */
export function matchMemberByName(members, rawName) {
  const target = normalizeName(rawName);
  if (!target) return null;

  const exact = members.filter((m) => normalizeName(m.fullName) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const targetTokens = target.split(' ').filter(Boolean);
  const candidates = members.filter((m) => {
    const memberTokens = new Set(normalizeName(m.fullName).split(' ').filter(Boolean));
    return targetTokens.length > 0 && targetTokens.every((t) => memberTokens.has(t));
  });
  return candidates.length === 1 ? candidates[0] : null;
}
