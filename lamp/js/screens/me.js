// ME — the private things, the settings, and a plain account of what LAMP
// stores and sends.

import { h, section, card, eyebrow, button, list, row, sheet, toast, notice } from '../core/ui.js';
import * as store from '../core/storage.js';
import { getProfile, getSettings, saveSettings, saveProfile, currentBand, currentAge } from '../core/profile.js';
import { BAND_LABEL } from '../core/age.js';
import { TRANSLATIONS } from '../core/bible.js';
import { applyChrome } from '../app.js';

const REGIONS = [['kw', 'Kuwait'], ['ph', 'Philippines'], ['uk', 'United Kingdom'], ['intl', 'Somewhere else']];

export default async function meScreen(ctx) {
  const profile = getProfile() || {};
  const settings = getSettings();
  const el = h('div');

  el.appendChild(section(null, card({},
    eyebrow(BAND_LABEL[currentBand()]),
    h('div', { class: 'card-title', text: profile.name || 'You' }),
    h('div', { class: 'card-meta', text: `${currentAge() ?? '—'} years old · LAMP writes for ages ${currentBand()}` }),
    h('div', { class: 'card-foot' },
      button('Change name', { onclick: () => {
        const input = h('input', { type: 'text', value: profile.name || '', maxlength: '24', 'aria-label': 'Your name' });
        const dialog = sheet('What should LAMP call you?', input, h('div', { class: 'btn-row', style: 'margin-top:1rem' },
          button('Save', { variant: 'btn-primary', onclick: () => {
            saveProfile({ name: input.value.trim() || profile.name });
            dialog.close();
            ctx.refresh();
          } })));
      } })))));

  el.appendChild(section('Private', list(
    row({ title: 'Prayers', sub: 'Kept on this device', onclick: () => ctx.go('prayer') }),
    row({ title: 'Journal', sub: 'Never uploaded, never shown to a parent', onclick: () => ctx.go('journal') }),
    row({ title: 'Memory verses', onclick: () => ctx.go('memory') }),
  )));

  // ── Settings ──────────────────────────────────────────────────────────────
  const setting = (label, controls, hint) => h('div', { style: 'margin-bottom:1.5rem' },
    h('div', { class: 'eyebrow', text: label }),
    h('div', { class: 'btn-row' }, controls),
    hint ? h('p', { class: 'field-hint', text: hint }) : null);

  const chooser = (options, current, onPick) => options.map(([value, label]) =>
    button(label, { variant: value === current ? 'btn-primary' : '', onclick: () => { onPick(value); ctx.refresh(); } }));

  el.appendChild(section('Settings',
    setting('Translation', chooser(TRANSLATIONS.map((t) => [t.id, t.id]), settings.translation || 'WEB',
      (value) => saveSettings({ translation: value })),
      'LAMP ships public-domain translations only. Modern translations need a licence from their publisher.'),

    setting('Appearance', chooser([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], settings.theme,
      (value) => { saveSettings({ theme: value }); applyChrome(); })),

    setting('Where you live', chooser(REGIONS, settings.region, (value) => saveSettings({ region: value })),
      'Only used to show the right help lines. LAMP never asks for or detects your location.'),
  ));

  // ── Ask ───────────────────────────────────────────────────────────────────
  const worker = h('input', { type: 'text', value: settings.aiWorker || '', placeholder: 'https://your-worker.workers.dev', 'aria-label': 'Helper address' });
  const secret = h('input', { type: 'password', value: settings.aiSecret || '', placeholder: 'Optional password', 'aria-label': 'Helper password' });

  el.appendChild(section('Ask', card({},
    h('p', { class: 'small', text: 'Ask is off until a parent or church admin adds the helper address. Everything else in LAMP works without it.' }),
    h('div', { class: 'field', style: 'margin-top:1rem' }, h('label', { text: 'Helper address' }), worker),
    h('div', { class: 'field' }, h('label', { text: 'Password (if your church set one)' }), secret),
    h('div', { class: 'btn-row' },
      button(settings.aiEnabled ? 'Save and keep Ask on' : 'Save and turn Ask on', { variant: 'btn-primary', onclick: () => {
        saveSettings({ aiWorker: worker.value.trim(), aiSecret: secret.value, aiEnabled: Boolean(worker.value.trim()) });
        toast(worker.value.trim() ? 'Ask is on.' : 'Ask stays off until an address is added.');
        ctx.refresh();
      } }),
      settings.aiEnabled ? button('Turn Ask off', { onclick: () => { saveSettings({ aiEnabled: false }); toast('Ask is off.'); ctx.refresh(); } }) : null),
    h('p', { class: 'field-hint', text: 'Your question and your age band are sent. Your name, your journal and your prayers are not.' }))));

  // ── Privacy and data ──────────────────────────────────────────────────────
  el.appendChild(section('What LAMP stores', card({},
    h('p', { class: 'small', text: 'On this device: your name, the year you were born, what you have read, your highlights, memory verses, prayers, journal entries and challenge results.' }),
    h('p', { class: 'small', text: 'Sent over the internet: the Bible chapters you open (to download them), and — only if Ask is on — your question and age band.' }),
    h('p', { class: 'small', text: 'Never: your location, your name, your journal, your prayers, or anything at all to an advertiser. There is no account and no messaging.' }))));

  el.appendChild(section('Data', h('div', { class: 'btn-row' },
    button('Download everything', { onclick: () => {
      const dump = Object.fromEntries(store.keys().map((key) => [key, store.read(key, null)]));
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: 'lamp-data.json' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } }),
    button('Delete everything', { variant: 'btn-quiet', onclick: () => {
      const dialog = sheet('Delete everything?',
        h('p', { class: 'small', text: 'This removes your profile, reading progress, highlights, memory verses, prayers, journal entries and challenge results from this device. It cannot be undone.' }),
        h('div', { class: 'btn-row', style: 'margin-top:1rem' },
          button('Delete it all', { variant: 'btn-primary', onclick: () => {
            const removed = store.wipe();
            dialog.close();
            toast(`${removed} thing${removed === 1 ? '' : 's'} deleted.`);
            location.hash = '';
            location.reload();
          } }),
          button('Keep my things', { variant: 'btn-quiet', onclick: () => dialog.close() })));
    } }))));

  el.appendChild(h('p', { class: 'disclosure center', text: 'LAMP · Phase 1 · a Bible companion for ages 7–18' }));

  return { title: 'Me', el };
}
