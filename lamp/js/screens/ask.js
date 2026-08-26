// ASK — the AI companion. An assistant, not the product.
//
// Three things this screen is strict about: the safety path runs before
// anything is sent, every answer is split into its three tiers, and every
// verse an answer cites is checked against the real text before it is shown.

import { h, section, card, eyebrow, button, notice, spinner, toast } from '../core/ui.js';
import * as ai from '../core/ai.js';
import * as content from '../core/content.js';
import { safetyCard, isConcerning } from '../core/safety.js';
import { parseRef, formatRef } from '../core/refs.js';
import { getPassage, joinText } from '../core/bible.js';
import { translationId } from '../core/profile.js';

const TIER_LABEL = {
  scripture: 'What the Bible says',
  believe: 'What Christians have believed',
  debate: 'Where Christians disagree',
  plain: '',
};

const EXAMPLES = {
  '7-10': ['Who was Moses?', 'Why do we pray?', 'What does forgive mean?'],
  '11-14': ['Why did Jesus wash the disciples’ feet?', 'What does forgiveness mean?', 'I’m scared. What does the Bible say?'],
  '15-18': ['Why does God allow suffering?', 'How do we know the Bible is true?', 'Can Christians have doubts?'],
};

function renderSafety(region, regionData) {
  const cardData = safetyCard(region);
  return h('div', { class: 'safety-card' },
    h('h3', { text: cardData.title }),
    ...cardData.body.map((paragraph) => h('p', { text: paragraph })),
    regionData ? h('ul', {}, ...regionData.lines.map((line) => h('li', {},
      h('strong', { text: line.name }), ' — ', line.number ? h('a', { href: `tel:${line.number.replace(/\s+/g, '')}`, text: line.number }) : line.detail))) : null,
    h('p', { class: 'small', style: 'margin-top:.9rem', text: 'LAMP will not talk with you about this as if it were a person. Please tell a grown-up you trust today.' }));
}

export default async function askScreen(ctx) {
  const el = h('div');
  const trans = translationId(ctx.settings);
  const about = ctx.route.params.about || '';
  const aboutRef = about ? parseRef(about) : null;
  const contextLabel = aboutRef ? formatRef(aboutRef) : '';

  const thread = h('div', { class: 'thread' });
  const output = h('div');
  const input = h('textarea', {
    'aria-label': 'Your question',
    placeholder: 'What would you like to understand?',
    style: 'min-height:5rem',
  });
  if (ctx.route.params.q) input.value = ctx.route.params.q;

  const history = ai.getThread();
  for (const turn of history.slice(-6)) {
    thread.appendChild(turn.role === 'user'
      ? h('div', { class: 'bubble-you', text: turn.text })
      : h('div', { class: 'answer small muted', text: turn.text.slice(0, 240) + (turn.text.length > 240 ? '…' : '') }));
  }

  const submit = async () => {
    const question = input.value.trim();
    if (!question) return;

    thread.appendChild(h('div', { class: 'bubble-you', text: question }));
    output.replaceChildren(spinner());

    if (isConcerning(question)) {
      let regionData = null;
      try { regionData = await content.safety(ctx.settings.region || 'kw'); } catch { /* card still works */ }
      output.replaceChildren(renderSafety(ctx.settings.region || 'kw', regionData));
      return;
    }

    const result = await ai.ask({
      question,
      band: ctx.band,
      contextLabel,
      history: history.map((turn) => ({ role: turn.role === 'user' ? 'user' : 'assistant', text: turn.text })),
      settings: ctx.settings,
    });

    if (result.kind === 'unconfigured') {
      output.replaceChildren(card({},
        eyebrow('Ask is switched off'),
        h('p', { text: 'Ask needs a helper address before it can answer. A parent or church admin adds it in Me → Settings — until then, everything else in LAMP works as normal.' }),
        h('div', { class: 'card-foot' }, button('Open settings', { variant: 'btn-primary', onclick: () => ctx.go('me') }))));
      return;
    }
    if (result.kind === 'offline' || result.kind === 'error') {
      output.replaceChildren(
        notice(result.kind === 'offline'
          ? 'The helper cannot be reached right now. Bible stories, topics and everything you have downloaded still work.'
          : result.message),
        h('div', { class: 'btn-row', style: 'margin-top:1rem' },
          button('Read Bible stories instead', { onclick: () => ctx.go('stories') })));
      return;
    }
    if (result.kind === 'safety') {
      output.replaceChildren(renderSafety(ctx.settings.region || 'kw', null));
      return;
    }

    ai.appendTurn({ role: 'user', text: question });
    ai.appendTurn({ role: 'assistant', text: result.text });
    input.value = '';

    const answer = h('div', { class: 'answer' });
    for (const tier of result.tiers) {
      answer.appendChild(h('div', { class: `tier tier-${tier.tier}` },
        TIER_LABEL[tier.tier] ? h('div', { class: 'tier-label', text: TIER_LABEL[tier.tier] }) : null,
        h('div', { class: 'tier-body', text: tier.body })));
    }

    // Check every reference the answer claims against the real text.
    if (result.refs.length) {
      const checked = h('div', { style: 'margin-top:.5rem' }, eyebrow('The verses it cited'), spinner());
      answer.appendChild(checked);
      const rows = [];
      for (const cited of result.refs.slice(0, 5)) {
        try {
          const passage = await getPassage(cited.ref, trans);
          const text = joinText(passage.verses);
          rows.push(h('button', { class: 'card', style: 'margin-bottom:.5rem', type: 'button',
            onclick: () => ctx.go(`read/${cited.ref.book.id}/${cited.ref.chapter}`) },
            h('div', { class: 'card-meta', text: cited.pretty }),
            h('p', { class: 'scripture small', style: 'margin-top:.3rem', text: text.length > 220 ? `${text.slice(0, 220)}…` : text })));
        } catch {
          rows.push(notice(`${cited.pretty} — LAMP could not check this one, so read it yourself before trusting it.`));
        }
      }
      checked.replaceChildren(eyebrow('The verses it cited'), ...rows);
    }

    answer.appendChild(h('p', { class: 'disclosure', text: ai.DISCLOSURE }));
    output.replaceChildren(answer);
  };

  el.appendChild(section(null,
    contextLabel ? h('p', { class: 'chip chip-accent', style: 'margin-bottom:1rem', text: `About ${contextLabel}` }) : null,
    thread,
    output,
    h('div', { class: 'field', style: 'margin-top:1.25rem' }, input),
    h('div', { class: 'btn-row' },
      button('Ask', { variant: 'btn-primary', onclick: submit }),
      history.length ? button('Clear', { variant: 'btn-quiet', onclick: () => { ai.clearThread(); toast('Conversation cleared.'); ctx.refresh(); } }) : null),
    h('p', { class: 'disclosure', text: `${ai.DISCLOSURE} LAMP never sends your journal or your prayers.` })));

  el.appendChild(section('You could ask',
    h('div', { class: 'btn-row' }, ...(EXAMPLES[ctx.band] || EXAMPLES['11-14']).map((example) =>
      button(example, { onclick: () => { input.value = example; input.focus(); } })))));

  return { title: 'Ask', el, tab: 'today' };
}
