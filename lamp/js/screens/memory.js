// Memory verses — Learn, Listen, Practice, Challenge, Master (SPEC.md §15).
// "Master" is self-attested: the app never listens to a child's microphone.

import { h, section, card, eyebrow, button, list, row, notice, spinner, toast, empty } from '../core/ui.js';
import * as memory from '../core/memory.js';
import { parseRef, formatRef } from '../core/refs.js';
import { getPassage, joinText } from '../core/bible.js';
import { translationId } from '../core/profile.js';
import * as content from '../core/content.js';
import { pick } from '../core/age.js';

function speak(text) {
  if (typeof speechSynthesis === 'undefined') { toast('This device cannot read aloud.'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.8;
  speechSynthesis.speak(utterance);
}

export default async function memoryScreen(ctx) {
  const el = h('div');
  const trans = translationId(ctx.settings);
  const state = memory.getMemory();

  if (!state.verses.length) {
    el.appendChild(empty(
      'No verses yet',
      'Pick one to start with, or open any verse in the Bible and tap “Remember”. LAMP brings each verse back a day later, then three days, then a week.',
      button('Open the Bible', { variant: 'btn-primary', onclick: () => ctx.go('bible') }),
    ));
    try {
      const suggestions = await content.memoryVerses();
      el.appendChild(section('Verses to start with', list(...suggestions.slice(0, 8).map((item) => {
        const ref = parseRef(item.ref);
        return row({
          title: ref ? formatRef(ref) : item.ref,
          sub: pick(item.why, ctx.band),
          end: 'Add',
          onclick: () => {
            memory.addVerse(item.ref, trans);
            toast('Added. Practise it whenever you like.');
            ctx.refresh();
          },
        });
      }))));
    } catch { /* the empty state alone is still useful */ }
    return { title: 'Memory verses', el, tab: 'journey' };
  }

  const due = memory.dueVerses(state);
  const practice = h('div');
  el.appendChild(section(due.length ? `Due now · ${due.length}` : 'All caught up', practice));

  const startPractice = async (verse) => {
    practice.replaceChildren(spinner());
    const ref = parseRef(verse.ref);
    let text = '';
    try {
      const passage = await getPassage(ref, verse.translation || trans);
      text = joinText(passage.verses);
    } catch (error) {
      practice.replaceChildren(notice(error.message));
      return;
    }

    const stage = verse.stage;
    const holder = card({}, eyebrow(memory.STAGE_LABEL[stage]),
      h('div', { class: 'card-title', text: formatRef(ref) }));

    if (stage === 'learn' || stage === 'listen') {
      holder.appendChild(h('p', { class: 'scripture', style: 'margin-top:.8rem', text }));
      holder.appendChild(h('div', { class: 'card-foot' },
        button('Listen', { onclick: () => speak(text) }),
        button('I have read it', { variant: 'btn-primary', onclick: () => {
          memory.review(verse.ref, true);
          toast('Good. It will come back soon.');
          ctx.refresh();
        } })));
    } else if (stage === 'practice') {
      const { words, blanks } = memory.cloze(text, 3, verse.ref);
      const inputs = new Map();
      const line = h('p', { class: 'cloze', style: 'margin-top:.8rem' });
      words.forEach((word, index) => {
        if (blanks.includes(index)) {
          const input = h('input', { type: 'text', 'aria-label': `Missing word ${blanks.indexOf(index) + 1}`, autocomplete: 'off' });
          inputs.set(index, input);
          line.append(input, ' ');
        } else {
          line.append(`${word} `);
        }
      });
      const feedback = h('p', { class: 'small', style: 'margin-top:.7rem' });
      holder.append(line, feedback, h('div', { class: 'card-foot' },
        button('Check', { variant: 'btn-primary', onclick: () => {
          const wrong = [...inputs.entries()].filter(([index, input]) => !memory.grade(input.value, words[index]).pass);
          if (wrong.length) {
            feedback.textContent = `${wrong.length} word${wrong.length === 1 ? '' : 's'} to try again. You can peek with Listen.`;
            feedback.className = 'small state-warn';
            return;
          }
          memory.review(verse.ref, true);
          toast('Every word. Well done.');
          ctx.refresh();
        } }),
        button('Listen', { onclick: () => speak(text) }),
        button('Too hard', { variant: 'btn-quiet', onclick: () => { memory.review(verse.ref, false); ctx.refresh(); } })));
    } else if (stage === 'challenge') {
      const answer = h('textarea', { placeholder: 'Write the verse from memory…', 'aria-label': 'Type the verse from memory' });
      const feedback = h('p', { class: 'small', style: 'margin-top:.7rem' });
      holder.append(h('p', { class: 'small muted', style: 'margin-top:.8rem', text: 'Write it out. Spelling and punctuation do not have to be perfect.' }),
        answer, feedback, h('div', { class: 'card-foot' },
          button('Check', { variant: 'btn-primary', onclick: () => {
            const result = memory.grade(answer.value, text);
            if (result.pass) {
              memory.review(verse.ref, true);
              toast('That is the verse. One more review and it is yours.');
              ctx.refresh();
            } else {
              feedback.textContent = 'Close, but not there yet. Practise it once more.';
              feedback.className = 'small state-warn';
              memory.review(verse.ref, false);
            }
          } }),
          button('Show me', { variant: 'btn-quiet', onclick: () => { feedback.textContent = text; feedback.className = 'small scripture'; } })));
    } else {
      holder.appendChild(h('p', { class: 'scripture', style: 'margin-top:.8rem', text }));
      holder.appendChild(h('p', { class: 'small state-good', style: 'margin-top:.6rem', text: 'Mastered. It comes back now and then so it stays.' }));
    }

    practice.replaceChildren(holder);
  };

  if (due.length) startPractice(due[0]);
  else practice.replaceChildren(h('p', { class: 'lede small', text: 'Nothing is due right now. Verses come back a day later, then three days, then a week, then longer.' }));

  el.appendChild(section('All verses', list(...state.verses.map((verse) => {
    const ref = parseRef(verse.ref);
    return row({
      title: ref ? formatRef(ref) : verse.ref,
      sub: `${memory.STAGE_LABEL[verse.stage]} · ${verse.correct || 0}/${verse.attempts || 0} right`,
      end: new Date(verse.due) <= new Date() ? 'Due' : '',
      onclick: () => startPractice(verse),
    });
  }))));

  return { title: 'Memory verses', el, tab: 'journey' };
}
