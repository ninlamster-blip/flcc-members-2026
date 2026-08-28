// One lesson: Scripture, what it means, and one question to answer.

import { h, poster, label, display, headline, art, pill, choice, note, toast, moment, reference } from '../core/ui.js';
import * as content from '../core/content.js';
import { forMode } from '../core/profile.js';
import * as progress from '../core/progress.js';
import { askOrder } from '../core/rotation.js';

export default async function lessonScreen(ctx) {
  const [journeyId, lessonId] = ctx.route.args;
  let journey = null;
  let lesson = null;
  try {
    journey = (await content.journeys()).find((row) => row.id === journeyId);
    lesson = (await content.lessons(journeyId)).find((row) => row.id === lessonId);
  } catch { /* handled below */ }
  if (!lesson) return { title: 'Lesson', el: poster({ tone: 'paper', className: 'full' }, note('That lesson could not be found.')) };

  const tone = (journey && journey.tone) || 'blue';
  const key = `${journeyId}/${lessonId}`;
  const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });
  let answered = progress.isDone('lesson', key);

  const quiz = lesson.quiz;
  // Lessons are authored with the right answer written first, like the quiz
  // banks. Shown in that order, every lesson in every journey would have the
  // same answer, and the question would stop being a question.
  const asked = askOrder(quiz.options, quiz.answer, key);
  const options = h('div', { class: 'choice-list', style: 'margin-top:1.4rem' },
    ...asked.options.map((text, index) => {
      const button = choice(text, () => {
        if (answered) return;
        answered = true;
        const right = index === asked.answer;
        button.dataset[right ? 'right' : 'wrong'] = '';
        if (!right) options.children[asked.answer].dataset.right = '';
        feedback.textContent = forMode(quiz.why, ctx.mode);
        const result = progress.complete('lesson', key);
        if (result.first) {
          toast(`+${progress.XP.lesson} XP`);
          checkJourneyFinished();
        }
      });
      return button;
    }));

  const checkJourneyFinished = async () => {
    if (!journey) return;
    const lessons = await content.lessons(journeyId);
    const state = progress.getProgress();
    const done = lessons.filter((row) => state.done[`lesson:${journeyId}/${row.id}`]).length;
    if (done === lessons.length) {
      moment({ tone, eyebrow: 'Journey complete', big: journey.title,
        line: 'Finished, all the way through.', action: 'Nice', onclose: () => ctx.go('explore') });
    }
  };

  const el = h('div', { style: 'display:contents' },
    poster({ tone, tall: true, className: 'full' },
      reference(lesson.ref, ctx.go, { className: 'label' }),
      h('div', {}, display(lesson.title),
        h('p', { class: 'verse', style: 'margin-top:1.3rem', text: `“${lesson.text}”` })),
      h('div', { class: 'poster-foot' }, h('span'), art((journey && journey.symbol) || 'book', { tone, size: 'sm' }))),

    poster({ tone: 'paper', className: 'full' },
      label('What it means'),
      h('p', { class: 'lead', text: forMode(lesson.body, ctx.mode) })),

    poster({ tone: 'paper', className: 'full' },
      label('One question'),
      headline(forMode(quiz.q, ctx.mode)),
      options,
      feedback,
      h('div', { class: 'poster-foot' }, pill('Back to the journey', () => ctx.go(`journey/${journeyId}`)))),
  );

  return { title: lesson.title, el };
}
