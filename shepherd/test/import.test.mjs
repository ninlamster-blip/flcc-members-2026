/**
 * The spreadsheet import layer: CSV parsing, header matching, and turning a
 * real church's roster/worker's schedule exports into candidate records.
 * Every example here uses invented names — never data from a real roster.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCSV, mapColumns } from '../js/core/csv.js';
import {
  parseMembersCSV, parseScheduleCSV, parseFlexibleDate, matchMemberByName,
} from '../js/core/importers.js';

/* ── parseCSV ────────────────────────────────────────────────────────────── */

test('parseCSV handles quoted commas, embedded newlines and escaped quotes', () => {
  const text = 'Name,Note\n"Doe, Jane","Line one\nLine two"\nBob,"He said ""hi"""\n';
  const rows = parseCSV(text);
  assert.deepEqual(rows, [
    ['Name', 'Note'],
    ['Doe, Jane', 'Line one\nLine two'],
    ['Bob', 'He said "hi"'],
  ]);
});

test('parseCSV drops a trailing blank line', () => {
  const rows = parseCSV('A,B\n1,2\n\n');
  assert.equal(rows.length, 2);
});

/* ── mapColumns ──────────────────────────────────────────────────────────── */

test('mapColumns matches headers case- and whitespace-insensitively, across aliases', () => {
  const rows = parseCSV('Complete Name,Sex\nSample Person,FEMALE\n');
  const { records, matchedHeaders } = mapColumns(rows, { fullName: ['complete name', 'Full Name'], gender: ['Sex'] });
  assert.deepEqual(records, [{ fullName: 'Sample Person', gender: 'FEMALE' }]);
  assert.equal(matchedHeaders.fullName, 'Complete Name');
});

test('mapColumns ignores a column with no matching alias, and drops fully blank rows', () => {
  const rows = parseCSV('Complete Name,Unrelated Column\nSample Person,whatever\n,\n');
  const { records } = mapColumns(rows, { fullName: ['Complete Name'] });
  assert.equal(records.length, 1);
  assert.equal(records[0].fullName, 'Sample Person');
});

/* ── parseMembersCSV ─────────────────────────────────────────────────────── */

test('parseMembersCSV reads the reduced per-church export shape, splitting the combined mobile/email field', () => {
  const csv = [
    'Complete Name,Sex,Civil Status,Date of Birth,Complete Philippine Address,Mobile Number/Email Address',
    '"SAMPLE, PERSON, ONE",FEMALE,MARRIED,5/16/1986,N/A,"09171234567 \nsample.person@example.com"',
  ].join('\n');
  const { records, warnings } = parseMembersCSV(csv);
  assert.equal(warnings.length, 0);
  assert.equal(records.length, 1);
  const r = records[0];
  assert.equal(r.fullName, 'SAMPLE, PERSON, ONE');
  assert.equal(r.gender, 'female');
  assert.equal(r.maritalStatus, 'married');
  assert.equal(r.birthDate, '1986-05-16');
  assert.equal(r.phone, '09171234567');
  assert.equal(r.email, 'sample.person@example.com');
  assert.equal(r.status, 'member');
});

test('parseMembersCSV reads the richer form-response shape: ministries, joining year, spouse/children folded into notes', () => {
  const csv = [
    'Complete Name,Sex,Civil Status,Satellite Church,Ministry Interest/s,Joining Year in FLCC,"Spouse Name (First Name, Last Name)",Current Location,Email Address',
    'Sample Leader,MALE,MARRIED,Sample Church,"Worship, Media",2019,"Spouse Sample",Downtown,leader@example.com',
  ].join('\n');
  const { records } = parseMembersCSV(csv);
  assert.deepEqual(records[0].ministries, ['Worship', 'Media']);
  assert.equal(records[0].joinedOn, '2019-01-01');
  assert.equal(records[0].area, 'Downtown');
  assert.match(records[0].notes, /Spouse: Spouse Sample/);
  assert.equal(records[0].email, 'leader@example.com');
});

test('parseMembersCSV filters to one satellite church when a filter is given', () => {
  const csv = [
    'Complete Name,Satellite Church',
    'Person A,Sample Church',
    'Person B,Other Church',
  ].join('\n');
  const { records } = parseMembersCSV(csv, { satelliteChurchFilter: 'Sample' });
  assert.deepEqual(records.map((r) => r.fullName), ['Person A']);
});

test('parseMembersCSV skips a row with no name and warns, and warns loudly with no name column at all', () => {
  const csv = 'Complete Name,Sex\n,FEMALE\nReal Name,MALE\n';
  const { records, warnings } = parseMembersCSV(csv);
  assert.equal(records.length, 1);
  assert.match(warnings[0], /no name/i);

  const noNameColumn = parseMembersCSV('Sex\nFEMALE\n');
  assert.equal(noNameColumn.records.length, 0);
  assert.match(noNameColumn.warnings[0], /no name column/i);
});

/* ── dates ───────────────────────────────────────────────────────────────── */

test('parseFlexibleDate reads M/D/YYYY and ISO, and gives up honestly rather than guess', () => {
  assert.equal(parseFlexibleDate('5/16/1986'), '1986-05-16');
  assert.equal(parseFlexibleDate('1986-05-16'), '1986-05-16');
  assert.equal(parseFlexibleDate('not a date'), null);
  assert.equal(parseFlexibleDate(''), null);
});

/* ── parseScheduleCSV ────────────────────────────────────────────────────── */

test('parseScheduleCSV fills in a missing year from the default and infers the service type', () => {
  const csv = [
    'Date,Service,Presider,Song Leader,Preacher,Pastoral Prayer,Food-In-Charge,Communion Assistants',
    '07-Aug,Friday Service,Sample Presider,Sample Singer,Sample Preacher,Sample Prayer,Sample Family,Sample Assistant',
  ].join('\n');
  const { records, warnings } = parseScheduleCSV(csv, { defaultYear: 2026 });
  assert.equal(warnings.length, 0);
  const r = records[0];
  assert.equal(r.date, '2026-08-07');
  assert.equal(r.serviceType, 'friday');
  assert.equal(r.service, 'Friday Worship');
  assert.equal(r.presiderName, 'Sample Presider');
  assert.equal(r.foodInCharge, 'Sample Family');
  assert.equal(r.communionNote, 'Sample Assistant');
});

test('parseScheduleCSV keeps an explicit year without needing a default, and skips an unreadable date', () => {
  const csv = 'Date,Service\n2026-08-02,Sunday Service\nnot a date,Sunday Service\n';
  const { records, warnings } = parseScheduleCSV(csv);
  assert.equal(records.length, 1);
  assert.equal(records[0].date, '2026-08-02');
  assert.equal(records[0].serviceType, 'sunday');
  assert.match(warnings[0], /could not read the date/i);
});

/* ── name matching ───────────────────────────────────────────────────────── */

test('matchMemberByName strips titles and matches regardless of name order', () => {
  const members = [
    { id: 'm1', fullName: 'Sample, Delta' },
    { id: 'm2', fullName: 'Sample Other Person' },
  ];
  assert.equal(matchMemberByName(members, 'Bro. Delta Sample').id, 'm1');
  assert.equal(matchMemberByName(members, 'DELTA SAMPLE').id, 'm1');
});

test('matchMemberByName returns null rather than guessing when nothing or more than one candidate fits', () => {
  const members = [
    { id: 'm1', fullName: 'Sample Person' },
    { id: 'm2', fullName: 'Someone Else' },
  ];
  assert.equal(matchMemberByName(members, 'Nobody Here'), null);

  // Neither is an exact match (both carry an extra middle name), but the
  // query's words are a subset of both — genuinely ambiguous, not a guess.
  const ambiguous = [
    { id: 'm1', fullName: 'Sample Echo Foxtrot' },
    { id: 'm2', fullName: 'Echo Sample Foxtrot' },
  ];
  assert.equal(matchMemberByName(ambiguous, 'Ptr. Sample Foxtrot'), null);
});
