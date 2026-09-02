// ASK — bring it the question you would not ask out loud.
//
// One text box, five posters back. The answer is rendered part by part in the
// app's own system rather than as a slab of chat text, which is deliberate: an
// answer that arrives as five posters reads as something the app has prepared,
// and an answer that ignores the shape arrives as one long paragraph and looks
// exactly as unreliable as it is.
//
// The screen says what it sends, in the same size type as everything else. An
// app whose whole promise is that nothing leaves the device owes a member that
// sentence where they can actually read it, not in a settings sub-page.

import { h, poster, label, display, art, go, pill, note, waiting,
         rows, row, rise, swap, toast } from '../core/ui.js';
import * as ai from '../core/ai.js';
import { SAFETY_CARD, isConcerning } from '../core/safety.js';
import { getSettings, firstName } from '../core/profile.js';

/**
 * The openers.
 *
 * Not "How do I pray?" — an adult who opened this screen has a reason, and a
 * starter that sounds like a catechism question tells them this is not the
 * place for the real one. These are the questions people actually carry.
 */
const STARTERS = [
  'I have prayed about the same thing for years and nothing has changed.',
  'How do I forgive someone who is not sorry?',
  'My marriage has gone quiet. Is that a spiritual problem or just life?',
  'I believe it on Sunday and not on Wednesday. Is that normal?',
  'What does the Bible actually say about money and debt?',
  'Someone I love is dying. What am I supposed to pray for?',
  'Does it matter what I do at work if it is not ministry?',
  'I am tired of church people. Am I allowed to say that?',
];

const partSpec = (key) => ai.PARTS.find((one) => one.key === key) || ai.PARTS[0];

export default async function askScreen(ctx) {
  const parts = [];

  const input = h('textarea', {
    'aria-label': 'Your question',
    rows: '4',
    placeholder: 'Ask it the way it actually sounds in your head…',
  });
  if (ctx.route.params && ctx.route.params.q) input.value = ctx.route.params.q;

  const answer = h('div', { style: 'display:contents' });

  // ── The safety card ─────────────────────────────────────────────────────
  //
  // Rendered from `safety.js`, never from a content file and never from the
  // model. Nothing is sent when this fires.
  const showSafety = () => {
    swap(answer, poster({ tone: 'ink', tall: true },
      label('Read this first'),
      h('div', {},
        display(SAFETY_CARD.title),
        ...SAFETY_CARD.body.map((text) => h('p', { class: 'body dim', style: 'margin-top:1rem', text })),
        h('div', { style: 'margin-top:1.6rem;display:flex;flex-direction:column;gap:.6rem' },
          ...SAFETY_CARD.lines.map((line) => h('p', { class: 'body' },
            h('strong', { text: line.name }),
            ' — ',
            line.number
              ? h('a', { href: `tel:${line.number.replace(/\s+/g, '')}`, style: 'color:inherit' }, line.number)
              : h('span', { text: line.detail || '' }))))),
      h('div', { class: 'poster-foot' },
        go('Open a prayer instead', () => ctx.go('pray')),
        art('heart', { tone: 'ink', size: 'sm' }))));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    const question = input.value.trim();
    if (!question) { input.focus(); return; }

    if (isConcerning(question)) { showSafety(); return; }

    swap(answer, poster({ tone: 'paper' }, label('Thinking about it'), waiting()));

    const result = await ai.ask({
      question,
      history: ai.getThread().map((turn) => ({ role: turn.role, text: turn.text })),
      settings: getSettings(),
    });

    if (result.kind === 'safety') { showSafety(); return; }

    if (result.kind === 'off') {
      swap(answer, poster({ tone: 'paper' },
        label('ASK is switched off'),
        h('p', { class: 'body', text: 'You turned this off in You. Everything else in the app works without it.' }),
        h('div', { class: 'poster-foot' }, go('Open You', () => ctx.go('you')), h('span'))));
      return;
    }

    if (result.kind === 'offline' || result.kind === 'error') {
      swap(answer, poster({ tone: 'paper' },
        label('No answer came back'),
        h('p', { class: 'body', text: result.kind === 'offline'
          ? 'ASK is the one part of this app that needs a connection. Everything you have already opened still works without one.'
          : result.message }),
        h('div', { class: 'poster-foot' },
          go('Read today’s Scripture instead', () => ctx.go('today')),
          art('cloud', { tone: 'paper', size: 'sm' }))));
      return;
    }

    ai.appendTurn({ role: 'user', text: question });
    ai.appendTurn({ role: 'assistant', text: result.text });

    const blocks = result.parts.map((part) => {
      const spec = partSpec(part.key);
      // The Scripture part gets its reference turned into a link, because the
      // whole Bible is already on the device and an adult should not have to
      // retype "Lamentations 3:22" into the Bible tab.
      return poster({ tone: spec.tone },
        label(spec.label),
        h('p', { class: 'body', style: 'margin-top:.9rem;white-space:pre-wrap', text: part.body }),
        h('div', { class: 'poster-foot' },
          part.key === 'scripture'
            ? go('Open it in the Bible', () => ctx.go('bible'))
            : h('span'),
          art(spec.symbol, { tone: spec.tone, size: 'sm' })));
    });

    blocks.push(poster({ tone: 'paper' },
      label('Before you take this as read'),
      h('p', { class: 'body', text: ai.DISCLOSURE }),
      h('div', { class: 'poster-foot' },
        go('Ask something else', () => { input.value = ''; input.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }),
        h('span'))));

    swap(answer, ...blocks);
    rise(blocks);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── The box ─────────────────────────────────────────────────────────────
  parts.push(poster({ tone: 'captain', tall: true },
    label('A question'),
    h('div', {},
      display('WHAT IS THE QUESTION?'),
      h('p', { class: 'lead dim', style: 'margin-top:1rem',
        text: `Anything, ${firstName()}. Doubt included. It will answer from Scripture, and it will tell you when Christians disagree rather than pretending they do not.` }),
      h('div', { style: 'margin-top:1.4rem' }, input)),
    h('div', { class: 'poster-foot' },
      pill('Ask it', submit),
      art('mug', { tone: 'captain', size: 'sm' }))));

  parts.push(answer);

  // ── What is sent ────────────────────────────────────────────────────────
  //
  // The answer the member was promised, in the same type as everything else.
  parts.push(poster({ tone: 'paper' },
    label('What leaves this phone'),
    rows(
      row({ title: 'Your question, and the last few turns of this conversation', meta: 'Sent' }),
      row({ title: 'Your name, and what you told the app about yourself', meta: 'Never' }),
      row({ title: 'Your prayer list and your reflections', meta: 'Never' }),
      row({ title: 'Your sermon notes', meta: 'Never' }),
    ),
    note('The question goes to FLCC’s own helper, which holds the key so your phone does not have to. Nothing is kept there, and it is not tied to you. The conversation itself is stored on this phone.'),
    h('div', { class: 'poster-foot' },
      go(ai.getThread().length ? 'Clear this conversation' : 'Turn ASK off in You', () => {
        if (ai.getThread().length) { ai.clearThread(); toast('Cleared.'); ctx.refresh(); }
        else ctx.go('you');
      }),
      h('span'))));

  // ── Starters ────────────────────────────────────────────────────────────
  parts.push(poster({ tone: 'paper' },
    label('If you are not sure how to start'),
    rows(...STARTERS.map((one) => row({
      title: one,
      onclick: () => { input.value = one; input.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    })))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Ask', el };
}
