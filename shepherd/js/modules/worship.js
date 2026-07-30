/**
 * Worship — the song database, setlists and the team rota.
 *
 * The searches a worship leader actually runs are "something on grace", "in
 * G", "we have not sung it since Easter" and "something in Tagalog" — so the
 * library is filtered by theme, key, mood, season and language, and every song
 * carries when it was last used and how often.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, list, listItem, emptyState, badge, segmented, searchField, chips,
  statCard, toast, modal, avatar,
} from '../core/ui.js';
import { formatDate, relativeTime, isoDate, daysBetween } from '../core/format.js';
import { downloadCSV } from '../core/exporters.js';
import { openRecordModal, newButton, memberName, matches, sentence, deleteRecord } from './_shared.js';

const SONG_FIELDS = ['title', 'author', 'key', 'bpm', 'timeSignature', 'themes', 'scripture', 'mood', 'season', 'language', 'ccli', 'lyrics', 'chords', 'notes'];
const SETLIST_FIELDS = ['title', 'date', 'songIds', 'leadId', 'team', 'rehearsal', 'notes'];

export async function render(ctx, route) {
  if (route.params[0]) {
    const song = ctx.db.find('songs', route.params[0]);
    if (song) return songDetail(ctx, song);
    const setlist = ctx.db.find('setlists', route.params[0]);
    if (setlist) return setlistDetail(ctx, setlist);
  }

  const tab = route.query.tab || 'songs';
  const { db } = ctx;
  const body = h('div');
  body.appendChild(tab === 'setlists' ? setlistsTab(ctx) : tab === 'team' ? teamTab(ctx) : songsTab(ctx));

  const lastSunday = db.all('setlists').sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  return page({
    title: 'Worship',
    subtitle: lastSunday ? `Last set: ${lastSunday.title} · ${formatDate(lastSunday.date)}` : 'Songs, setlists and the team rota.',
    actions: [
      tab === 'setlists'
        ? newButton(ctx, 'worship', 'New setlist', () => openRecordModal(ctx, { collection: 'setlists', fields: SETLIST_FIELDS }))
        : newButton(ctx, 'worship', 'Add song', () => openRecordModal(ctx, { collection: 'songs', fields: SONG_FIELDS })),
    ].filter(Boolean),
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'songs', label: `Songs (${db.all('songs').length})` },
            { value: 'setlists', label: 'Setlists' },
            { value: 'team', label: 'Team & rehearsals' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/worship?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── song library ────────────────────────────────────────────────────────── */

function songsTab(ctx) {
  const { db } = ctx;
  let query = '';
  let key = '';
  let mood = '';
  let language = '';
  let themeFilter = '';

  const usage = songUsage(db);
  const themes = [...new Set(db.all('songs').flatMap((s) => s.themes || []))].sort().slice(0, 14);
  const results = h('div');

  const draw = () => {
    let songs = db.all('songs').filter((song) => matches(song, query, ['title', 'author', 'scripture', 'lyrics'])
      || (query && (song.themes || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))));
    if (key) songs = songs.filter((s) => s.key === key);
    if (mood) songs = songs.filter((s) => s.mood === mood);
    if (language) songs = songs.filter((s) => s.language === language);
    if (themeFilter) songs = songs.filter((s) => (s.themes || []).includes(themeFilter));
    songs.sort((a, b) => a.title.localeCompare(b.title));

    results.textContent = '';
    results.appendChild(songs.length
      ? table({
        columns: [
          {
            label: 'Song',
            render: (song) => h('div', null,
              h('div', { style: { fontWeight: '500' } }, song.title),
              h('div.tiny.subtle', [song.author, song.scripture].filter(Boolean).join(' · '))),
          },
          { label: 'Key', value: (song) => song.key || '—' },
          { label: 'BPM', numeric: true, value: (song) => song.bpm || '—' },
          { label: 'Themes', render: (song) => h('div.chip-list', ...(song.themes || []).slice(0, 3).map((t) => h('span.chip', t))) },
          { label: 'Language', value: (song) => song.language },
          {
            label: 'Last sung',
            render: (song) => {
              const stats = usage.get(song.id);
              if (!stats) return h('span.subtle', 'Never');
              const stale = daysBetween(stats.last, new Date()) > 120;
              return h('span', { class: stale ? 'badge badge--info' : '' }, relativeTime(stats.last));
            },
          },
          { label: 'Times', numeric: true, value: (song) => (usage.get(song.id) || { count: 0 }).count },
        ],
        rows: songs,
        onRowClick: (song) => ctx.navigate(`/worship/${song.id}`),
      })
      : emptyState({
        title: query ? `No song matches “${query}”` : 'No songs yet',
        detail: 'Search by title, author, theme, scripture or a line of the lyrics.',
        iconName: 'music',
        action: newButton(ctx, 'worship', 'Add song', () => openRecordModal(ctx, { collection: 'songs', fields: SONG_FIELDS })),
      }));
  };

  const selectFilter = (label, options, onChange) => h('select.select', {
    style: { maxWidth: '150px' }, 'aria-label': label, onChange: (e) => { onChange(e.target.value); draw(); },
  }, h('option', { value: '' }, label), ...options.map((option) => h('option', { value: option }, sentence(option))));

  const wrap = h('div.stack',
    h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        searchField({ placeholder: 'Search title, theme, scripture, lyrics…', onInput: (value) => { query = value; draw(); } })),
      selectFilter('Any key', ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], (v) => { key = v; }),
      selectFilter('Any mood', ['celebration', 'adoration', 'reflection', 'lament', 'declaration', 'communion'], (v) => { mood = v; }),
      selectFilter('Any language', ['English', 'Arabic', 'Tagalog', 'Hindi', 'Malayalam'], (v) => { language = v; })),
    themes.length ? chips({
      options: themes.map((theme) => ({ value: theme, label: theme })),
      selected: themeFilter ? [themeFilter] : [],
      onToggle: (value) => { themeFilter = themeFilter === value ? '' : value; draw(); },
    }) : null,
    results);
  draw();
  return wrap;
}

function songDetail(ctx, song) {
  const { db } = ctx;
  const appearances = db.all('setlists')
    .filter((s) => (s.songIds || []).includes(song.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return page({
    eyebrow: 'Worship',
    title: song.title,
    subtitle: [song.author, song.key ? `Key of ${song.key}` : null, song.bpm ? `${song.bpm} BPM` : null, song.timeSignature].filter(Boolean).join(' · '),
    actions: [
      h('button.btn', { onClick: () => ctx.navigate('/worship') }, icon('arrowLeft', { size: 15 }), 'Library'),
      ctx.can('worship:write')
        ? h('button.btn.btn--primary', { onClick: () => openRecordModal(ctx, { collection: 'songs', doc: song, fields: SONG_FIELDS }) }, icon('edit', { size: 15 }), 'Edit')
        : null,
    ].filter(Boolean),
    children: [h('div.grid.grid--main-side',
      h('div.stack',
        card({
          title: 'Lyrics',
          children: [song.lyrics
            ? h('div.prose', song.lyrics)
            : h('p.small.muted', 'No lyrics stored. Paste them in — the library searches lyrics too, which is how you find "that song about the storm".')],
        }),
        song.chords ? card({ title: 'Chord sheet', children: [h('pre.mono.small', { style: { whiteSpace: 'pre-wrap' } }, song.chords)] }) : null),
      h('div.stack',
        card({
          title: 'Details',
          children: [h('div.stack.stack--sm',
            detailRow('Scripture', song.scripture),
            detailRow('Mood', song.mood && sentence(song.mood)),
            detailRow('Season', song.season && sentence(song.season)),
            detailRow('Language', song.language),
            detailRow('CCLI', song.ccli),
            song.themes && song.themes.length
              ? h('div', null, h('p.eyebrow', 'Themes'), h('div.chip-list', ...song.themes.map((t) => h('span.chip', t))))
              : null,
            song.notes ? h('p.small.muted', song.notes) : null)],
        }),
        card({
          title: 'History',
          subtitle: `Sung ${appearances.length} ${appearances.length === 1 ? 'time' : 'times'}`,
          children: [appearances.length
            ? list(appearances.slice(0, 10).map((setlist) => listItem({
              title: setlist.title,
              meta: `${formatDate(setlist.date)}${setlist.leadId ? ` · ${memberName(db, setlist.leadId)}` : ''}`,
              onClick: () => ctx.navigate(`/worship/${setlist.id}`),
            })))
            : h('p.small.muted', 'Not used in a recorded setlist yet.')],
        }),
        ctx.can('worship:delete')
          ? card({ children: [h('button.btn.btn--sm.btn--danger', {
            onClick: async () => { if (await deleteRecord(ctx, 'songs', song.id, song.title)) ctx.navigate('/worship'); },
          }, icon('trash', { size: 14 }), 'Delete song')] })
          : null))],
  });
}

/* ── setlists ────────────────────────────────────────────────────────────── */

function setlistsTab(ctx) {
  const { db } = ctx;
  const setlists = db.all('setlists').sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!setlists.length) {
    return emptyState({
      title: 'No setlists yet',
      detail: 'A setlist records what was sung, who led, and who was on the team.',
      iconName: 'music',
      action: newButton(ctx, 'worship', 'New setlist', () => openRecordModal(ctx, { collection: 'setlists', fields: SETLIST_FIELDS })),
    });
  }
  return h('div.grid.grid--2', ...setlists.map((setlist) => {
    const songs = (setlist.songIds || []).map((id) => db.find('songs', id)).filter(Boolean);
    const upcoming = new Date(setlist.date) >= new Date(new Date().toDateString());
    return card({
      title: setlist.title,
      subtitle: `${formatDate(setlist.date)}${setlist.leadId ? ` · ${memberName(db, setlist.leadId)}` : ''}`,
      actions: [upcoming ? badge('Upcoming', 'accent') : null].filter(Boolean),
      children: [
        songs.length
          ? h('ol', { style: { margin: '0 0 10px', paddingLeft: '20px' } },
            ...songs.map((song) => h('li.small', { style: { marginBottom: '2px' } },
              h('button.btn.btn--ghost.btn--sm', { onClick: () => ctx.navigate(`/worship/${song.id}`) }, song.title),
              h('span.tiny.subtle', ` ${[song.key, song.bpm ? `${song.bpm}bpm` : null].filter(Boolean).join(' · ')}`))))
          : h('p.small.muted', 'No songs chosen yet.'),
        setlist.team && setlist.team.length ? h('div.chip-list', ...setlist.team.map((role) => h('span.chip', role))) : null,
        setlist.rehearsal ? h('p.tiny.subtle', { style: { marginTop: '8px' } }, `Rehearsal ${formatDate(setlist.rehearsal)} · ${relativeTime(setlist.rehearsal)}`) : null,
        ctx.can('worship:write')
          ? h('div.row', { style: { marginTop: '12px' } },
            h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'setlists', doc: setlist, fields: SETLIST_FIELDS }) }, 'Edit'),
            h('button.btn.btn--sm', { onClick: () => shareSetlist(ctx, setlist, songs) }, 'Send to team'))
          : null,
      ],
    });
  }));
}

function setlistDetail(ctx, setlist) {
  ctx.navigate('/worship?tab=setlists');
  return h('div');
}

function shareSetlist(ctx, setlist, songs) {
  const text = [
    `🎵 ${setlist.title} — ${formatDate(setlist.date)}`,
    setlist.leadId ? `Leading: ${memberName(ctx.db, setlist.leadId)}` : '',
    '',
    ...songs.map((song, i) => `${i + 1}. ${song.title}${song.key ? ` (${song.key})` : ''}${song.bpm ? ` ${song.bpm}bpm` : ''}`),
    '',
    setlist.rehearsal ? `Rehearsal: ${formatDate(setlist.rehearsal)}` : '',
    setlist.notes || '',
    `— ${ctx.tenant.name}`,
  ].filter(Boolean).join('\n');

  const area = h('textarea.textarea', { style: { minHeight: '220px' }, value: text }, text);
  const ref = modal({
    title: 'Send to the team',
    body: h('div.stack', h('p.small.muted', 'Ready to paste into WhatsApp.'), area),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Close'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          try { await navigator.clipboard.writeText(area.value); toast('Copied.', { variant: 'ok' }); }
          catch { toast('Select the text and copy it.'); }
        },
      }, 'Copy'),
    ],
  });
}

/* ── team ────────────────────────────────────────────────────────────────── */

function teamTab(ctx) {
  const { db } = ctx;
  const now = new Date();
  const upcoming = db.all('setlists')
    .filter((s) => new Date(s.date) >= new Date(now.toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const musicians = db.where('members', (m) => (m.ministries || []).some((x) => /worship|music|media|sound/i.test(x)) && !m.archived);
  const leadCounts = new Map();
  for (const setlist of db.all('setlists')) {
    if (setlist.leadId) leadCounts.set(setlist.leadId, (leadCounts.get(setlist.leadId) || 0) + 1);
  }

  return h('div.stack',
    h('div.grid.grid--3',
      statCard({ value: musicians.length, label: 'On the worship & media teams' }),
      statCard({ value: upcoming.length, label: 'Services planned' }),
      statCard({ value: db.all('songs').length, label: 'Songs in the library' })),
    card({
      title: 'Rehearsals coming up',
      children: [upcoming.length
        ? list(upcoming.map((setlist) => listItem({
          leading: icon('clock', { size: 18 }),
          title: setlist.title,
          meta: [
            `Service ${formatDate(setlist.date)}`,
            setlist.rehearsal ? `rehearsal ${formatDate(setlist.rehearsal)}` : 'no rehearsal set',
            setlist.leadId ? memberName(db, setlist.leadId) : 'no leader yet',
          ].join(' · '),
          trailing: setlist.rehearsal ? badge(relativeTime(setlist.rehearsal), 'accent') : badge('Set a time', 'warn'),
        })))
        : h('p.small.muted', 'Nothing planned. Add a setlist to schedule a rehearsal.')],
    }),
    card({
      title: 'Who leads, and how often',
      subtitle: 'So the rota does not quietly settle on two people.',
      children: [musicians.length
        ? list(musicians
          .sort((a, b) => (leadCounts.get(b.id) || 0) - (leadCounts.get(a.id) || 0))
          .map((member) => listItem({
            leading: avatar(member.fullName, { size: 'sm' }),
            title: member.fullName,
            meta: (member.ministries || []).join(', '),
            trailing: badge(`${leadCounts.get(member.id) || 0} led`),
            onClick: () => ctx.navigate(`/members/${member.id}`),
          })))
        : h('p.small.muted', 'Nobody is on a worship or media ministry yet — set that on their profile.')],
    }),
    card({
      title: 'Export',
      children: [h('button.btn.btn--sm', {
        onClick: () => {
          const usage = songUsage(db);
          downloadCSV(`${ctx.tenant.id}-songs-${isoDate(now)}.csv`, db.all('songs'), [
            { key: 'title', label: 'Title' }, { key: 'author', label: 'Author' },
            { key: 'key', label: 'Key' }, { key: 'bpm', label: 'BPM' },
            { key: 'themes', label: 'Themes' }, { key: 'language', label: 'Language' },
            { label: 'Times sung', value: (song) => (usage.get(song.id) || { count: 0 }).count },
            { label: 'Last sung', value: (song) => { const stats = usage.get(song.id); return stats ? isoDate(stats.last) : ''; } },
          ]);
          toast('Song library exported.', { variant: 'ok' });
        },
      }, icon('download', { size: 14 }), 'Song library (CSV)')],
    }));
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function songUsage(db) {
  /** @type {Map<string, {count: number, last: Date}>} */
  const usage = new Map();
  for (const setlist of db.all('setlists')) {
    const date = new Date(setlist.date);
    if (date > new Date()) continue;
    for (const id of setlist.songIds || []) {
      const existing = usage.get(id);
      if (!existing) usage.set(id, { count: 1, last: date });
      else {
        existing.count += 1;
        if (date > existing.last) existing.last = date;
      }
    }
  }
  return usage;
}

function detailRow(label, value) {
  if (!value) return null;
  return h('div.row.row--between', h('span.small.muted', label), h('span.small', String(value)));
}
