// ASK NEXT — questions are welcome here.

import { h, poster, label, display, headline, art, pill, go, note, waiting, toast } from '../core/ui.js';
import * as ai from '../core/ai.js';
import * as content from '../core/content.js';
import { SAFETY_CARD, isConcerning } from '../core/safety.js';
import { getSettings, saveSettings, isKids } from '../core/profile.js';

const STARTERS = {
  kids: ['Why do bad things happen?', 'How do I pray?', 'Is God always with me?', 'What is heaven like?'],
  teens: ['Why does God allow suffering?', 'How do I deal with stress?', 'Is it okay to doubt?', 'How do I know God’s will?', 'Why do I feel far from God?'],
};

const PART_TONE = { talk: 'paper', bible: 'blue', think: 'cream', pray: 'pink', step: 'sage' };
const PART_ART = { talk: 'people', bible: 'book', think: 'bulb', pray: 'hands', step: 'flag' };

export default async function askScreen(ctx) {
  const settings = getSettings();
  const answer = h('div', { style: 'display:contents' });
  const input = h('textarea', { 'aria-label': 'Your question', placeholder: isKids() ? 'Ask anything about God or the Bible…' : 'Ask it however it actually sounds in your head…' });
  if (ctx.route.params.q) input.value = ctx.route.params.q;

  const showSafety = async () => {
    let lines = [];
    try { lines = (await content.help()).lines || []; } catch { /* the card still works */ }
    answer.replaceChildren(poster({ tone: 'ink', tall: true, className: 'full' },
      label('Read this first'),
      h('div', {},
        display(SAFETY_CARD.title),
        ...SAFETY_CARD.body.map((text) => h('p', { class: 'body dim', style: 'margin-top:1rem', text })),
        h('div', { style: 'margin-top:1.4rem;display:flex;flex-direction:column;gap:.5rem' },
          ...lines.map((line) => h('p', { class: 'body' },
            h('strong', { text: line.name }), ' — ',
            line.number ? h('a', { href: `tel:${line.number.replace(/\s+/g, '')}`, style: 'color:inherit' }, line.number) : line.detail)))),
      h('div', { class: 'poster-foot' }, h('span'), art('hands', { tone: 'ink', size: 'sm' }))));
  };

  const submit = async () => {
    const question = input.value.trim();
    if (!question) return;

    if (isConcerning(question)) { await showSafety(); return; }

    answer.replaceChildren(poster({ tone: 'paper', className: 'full' }, waiting()));

    const result = await ai.ask({
      question,
      mode: ctx.mode,
      history: ai.getThread().map((turn) => ({ role: turn.role, text: turn.text })),
      settings: getSettings(),
    });

    if (result.kind === 'safety') { await showSafety(); return; }

    if (result.kind === 'unconfigured') {
      const worker = h('input', { type: 'text', placeholder: 'https://your-worker.workers.dev', value: settings.aiWorker || '', 'aria-label': 'Helper address' });
      answer.replaceChildren(poster({ tone: 'paper', className: 'full' },
        label('Not switched on yet'),
        h('p', { class: 'body', text: 'A ministry leader needs to add the helper address before Ask NEXT can answer. Everything else in the app works without it.' }),
        h('div', { style: 'margin-top:1.2rem' }, worker),
        h('div', { class: 'poster-foot' }, pill('Save', () => {
          saveSettings({ aiWorker: worker.value.trim(), aiEnabled: Boolean(worker.value.trim()) });
          toast(worker.value.trim() ? 'Ask NEXT is on.' : 'Still off.');
          ctx.refresh();
        }))));
      return;
    }

    if (result.kind === 'offline' || result.kind === 'error') {
      answer.replaceChildren(poster({ tone: 'paper', className: 'full' },
        label('No answer'),
        h('p', { class: 'body', text: result.kind === 'offline'
          ? 'The helper could not be reached. Everything you have already downloaded still works.'
          : result.message }),
        h('div', { class: 'poster-foot' }, go('Read a devotional instead', () => ctx.go('devotion')))));
      return;
    }

    ai.appendTurn({ role: 'user', text: question });
    ai.appendTurn({ role: 'assistant', text: result.text });

    const known = new Map(ai.PARTS.map((part) => [part.key, part.label]));
    answer.replaceChildren(
      poster({ tone: 'paper', className: 'full' }, label('You asked'), h('p', { class: 'lead', text: question })),
      ...result.parts.map((part) => poster({ tone: PART_TONE[part.key] || 'paper', className: 'full' },
        label(known.get(part.key) || 'ANSWER'),
        h('p', { class: part.key === 'bible' ? 'verse' : 'body', text: part.body }),
        h('div', { class: 'poster-foot' }, h('span'), art(PART_ART[part.key] || 'light', { tone: PART_TONE[part.key] || 'paper', size: 'sm' })))),
      poster({ tone: 'paper', className: 'full' },
        h('p', { class: 'label dimmer', text: ai.DISCLOSURE })));
  };

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'sage', tall: true, className: 'full' },
      label('Ask NEXT'),
      h('div', {},
        display('QUESTIONS ARE WELCOME HERE.'),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: 'Nothing is too big or too awkward. Your question and your age group are all that get sent — never your name, and never your prayers.' }),
        h('div', { style: 'margin-top:1.4rem' }, input)),
      h('div', { class: 'poster-foot' }, pill('Ask', submit), art('bulb', { tone: 'sage', size: 'sm' }))),

    answer,

    poster({ tone: 'paper', className: 'full' },
      label('You could ask'),
      h('div', { class: 'pill-row', style: 'margin-top:.4rem' },
        ...(STARTERS[ctx.mode] || STARTERS.teens).map((text) =>
          pill(text, () => { input.value = text; input.focus(); }, { quiet: true })))),
  );

  return { title: 'Ask NEXT', el };
}
