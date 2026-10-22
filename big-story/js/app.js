/* =============================================================================
   THE BIG STORY — the screens.
   -----------------------------------------------------------------------------
   Four of them: the map, a story, its questions, its verse. Everything is
   reachable from the map and nothing is locked, because a child whose class is
   doing Jonah this week must be able to open Jonah — a "finish Genesis first"
   app is useless to an actual Sunday school.

   Routes live in the address bar (#/s/jonah/quiz) so that the phone's own back
   button works. Children press it constantly.
   ========================================================================== */

import { STORIES, AGE_BANDS } from './stories.js';
import {
  storyById, storyText, showsDeeper, storiesByEra, bandById,
  buildQuiz, scoreQuiz, QUIZ_LENGTH, maskVerse, VERSE_LEVELS,
  storyState, isComplete, completedCount, nextStory, isNext,
} from './engine.js';
import * as Store from './storage.js';

const view = document.getElementById('view');
const sheetHost = document.getElementById('sheet-host');

const state = {
  profile: null,
  progress: { read: [], quizzes: {}, verses: [] },
  quiz: null,
  quizIndex: 0,
  quizMarks: [],
  answered: false,
  verseLevel: 0,
};

/* ── Small DOM helpers ────────────────────────────────────────────────────── */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

function show(...nodes) {
  view.textContent = '';
  for (const node of nodes) if (node) view.append(node);
  window.scrollTo(0, 0);
}

function eraStyle(eraId) {
  return `--era: var(--era-${eraId})`;
}

/* ── Routing ──────────────────────────────────────────────────────────────── */

function route() {
  const hash = (location.hash || '').replace(/^#\/?/, '');
  const [section, id, sub] = hash.split('/');
  if (section === 's' && storyById(id)) return { name: sub === 'quiz' ? 'quiz' : sub === 'verse' ? 'verse' : 'story', story: storyById(id) };
  return { name: 'map' };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/**
 * The app's own back button goes UP — a quiz to its story, a story to the map —
 * rather than backwards through wherever this child has been. history.back()
 * from a story can land on the quiz they just left, which is the one place they
 * did not mean to return to. The phone's own back button still walks the
 * history, because that is what it is for.
 */
function goUp() {
  const current = route();
  if (current.name === 'quiz' || current.name === 'verse') {
    state.quiz = null;
    return go(`#/s/${current.story.id}`);
  }
  return go('#/');
}

/* ── Boot ─────────────────────────────────────────────────────────────────── */

function boot() {
  document.getElementById('btn-who').addEventListener('click', openProfiles);
  document.getElementById('btn-back').addEventListener('click', goUp);
  window.addEventListener('hashchange', render);

  state.profile = Store.currentProfile();
  if (state.profile) state.progress = Store.progressFor(state.profile.id);
  render();
}

function refreshProgress() {
  if (state.profile) state.progress = Store.progressFor(state.profile.id);
}

function render() {
  if (!state.profile) return renderWelcome();

  const who = document.getElementById('btn-who');
  who.hidden = false;
  document.getElementById('who-avatar').textContent = state.profile.name.slice(0, 1).toUpperCase();
  document.getElementById('who-name').textContent = state.profile.name;

  const current = route();
  const back = document.getElementById('btn-back');
  const out = document.getElementById('link-out');
  back.hidden = current.name === 'map';
  out.hidden = current.name !== 'map';
  document.getElementById('back-label').textContent = current.name === 'story' ? 'All stories' : 'Story';

  if (current.name === 'story') return renderStory(current.story);
  if (current.name === 'quiz') return renderQuiz(current.story);
  if (current.name === 'verse') return renderVerse(current.story);
  return renderMap();
}

/* ── First run ────────────────────────────────────────────────────────────── */

function renderWelcome() {
  document.getElementById('btn-who').hidden = true;
  document.getElementById('btn-back').hidden = true;
  show(
    el('div', { class: 'hero' }, [
      el('h1', { class: 'font-display', text: 'The Big Story' }),
      el('p', { text: 'The Bible is one story, from the first page to the last. Here it is in twenty-three parts, told for whatever age you are.' }),
    ]),
    el('div', { class: 'next-steps' }, [
      el('button', { class: 'btn btn-primary btn-block', onclick: () => openNewProfile(true) }, ['Start']),
    ]),
  );
}

/* ── The map ──────────────────────────────────────────────────────────────── */

function renderMap() {
  refreshProgress();
  const done = completedCount(state.progress);
  const next = nextStory(state.progress);

  const header = el('div', { class: 'hero' }, [
    el('h1', { class: 'font-display', text: 'The Big Story' }),
    el('p', { text: `${STORIES.length} stories, from the beginning to the church.` }),
    el('div', { class: 'progress-line' }, [
      el('div', { class: 'progress-track' }, [
        el('div', { class: 'progress-fill', style: `width: ${Math.round((done / STORIES.length) * 100)}%` }),
      ]),
      el('span', { class: 'progress-label', text: `${done} of ${STORIES.length} finished` }),
    ]),
  ]);

  const continueCard = next ? el('div', { class: 'continue-card' }, [
    el('div', { class: 'continue-eyebrow', text: done === 0 ? 'Start here' : 'Carry on' }),
    el('div', { class: 'continue-title font-display', text: next.title }),
    el('p', { class: 'continue-ref', text: next.reference }),
    el('button', { class: 'btn btn-primary', onclick: () => go(`#/s/${next.id}`) }, ['Open this story']),
  ]) : el('div', { class: 'continue-card' }, [
    el('div', { class: 'continue-eyebrow', text: 'All finished' }),
    el('div', { class: 'continue-title font-display', text: 'You have been through the whole story.' }),
    el('p', { class: 'continue-ref', text: 'Every story read, every quiz passed, every verse learned. Go round again whenever you like.' }),
  ]);

  const eras = storiesByEra().map((era) =>
    el('section', { class: 'era', style: eraStyle(era.id) }, [
      el('div', { class: 'era-head' }, [
        el('span', { class: 'era-dot' }),
        el('span', { class: 'era-name', text: era.name }),
      ]),
      el('div', { class: 'story-list' }, era.stories.map(storyCard)),
    ]));

  show(header, continueCard, ...eras);
}

function storyCard(story) {
  const marks = storyState(state.progress, story.id);
  const complete = isComplete(state.progress, story.id);
  return el('button', {
    class: 'story-card',
    'data-done': String(complete),
    'data-next': String(isNext(state.progress, story.id)),
    onclick: () => go(`#/s/${story.id}`),
  }, [
    el('span', { class: 'story-mark', text: complete ? '✓' : String(STORIES.indexOf(story) + 1) }),
    el('span', { class: 'story-body' }, [
      el('span', { class: 'story-title', text: story.title, style: 'display:block' }),
      el('span', { class: 'story-ref', text: story.reference }),
    ]),
    el('span', { class: 'story-bits' }, [
      el('span', { class: 'bit', 'data-on': String(marks.read), title: 'Read' }),
      el('span', { class: 'bit', 'data-on': String(marks.passed), title: 'Questions' }),
      el('span', { class: 'bit', 'data-on': String(marks.verse), title: 'Verse' }),
    ]),
  ]);
}

/* ── A story ──────────────────────────────────────────────────────────────── */

function renderStory(story) {
  refreshProgress();
  const tier = bandById(state.profile.band).tier;
  const marks = storyState(state.progress, story.id);

  // Opening it is reading it. There is no "I have read this" button, because a
  // child will tap it without reading and an honest one will forget to.
  if (!marks.read) {
    state.progress = Store.markRead(state.profile.id, story.id);
  }

  const paragraphs = storyText(story, tier).split(/\n{2,}/).map((p) => el('p', { text: p.trim() }));

  const deeper = showsDeeper(tier) && story.deeper
    ? el('div', { class: 'deeper' }, [
        el('h2', { text: 'Go deeper' }),
        el('p', { text: story.deeper }),
      ])
    : null;

  const steps = el('div', { class: 'next-steps' }, [
    el('button', { class: 'step', onclick: () => go(`#/s/${story.id}/quiz`) }, [
      el('span', { class: 'step-icon', text: '?' }),
      el('span', {}, [
        el('span', { class: 'step-title', text: 'Questions', style: 'display:block' }),
        el('span', { class: 'step-sub', text: marks.quiz ? `Your best: ${marks.quiz.right} out of ${marks.quiz.total}` : 'A few questions about the story' }),
      ]),
      marks.passed ? el('span', { class: 'step-done', text: '✓' }) : null,
    ]),
    el('button', { class: 'step', onclick: () => go(`#/s/${story.id}/verse`) }, [
      el('span', { class: 'step-icon', text: '✦' }),
      el('span', {}, [
        el('span', { class: 'step-title', text: 'Learn the verse', style: 'display:block' }),
        el('span', { class: 'step-sub', text: story.verse.reference }),
      ]),
      marks.verse ? el('span', { class: 'step-done', text: '✓' }) : null,
    ]),
  ]);

  show(
    el('div', { class: 'story-head', style: eraStyle(story.era) }, [
      el('span', { class: 'story-era', text: eraName(story.era) }),
      el('h1', { class: 'font-display', text: story.title }),
      el('p', { class: 'ref', text: story.reference }),
    ]),
    el('article', { class: 'prose', style: eraStyle(story.era) }, paragraphs),
    deeper ? el('div', { style: eraStyle(story.era) }, [deeper]) : null,
    steps,
  );
}

function eraName(id) {
  const era = storiesByEra().find((e) => e.id === id);
  return era ? era.name : '';
}

/* ── The quiz ─────────────────────────────────────────────────────────────── */

function renderQuiz(story) {
  refreshProgress();
  const tier = bandById(state.profile.band).tier;

  if (!state.quiz || state.quiz.storyId !== story.id) {
    state.quiz = { storyId: story.id, questions: buildQuiz(story.id, tier) };
    state.quizIndex = 0;
    state.quizMarks = [];
    state.answered = false;
  }

  if (state.quizIndex >= state.quiz.questions.length) return renderQuizDone(story);

  const question = state.quiz.questions[state.quizIndex];
  const pips = el('div', { class: 'quiz-progress' }, state.quiz.questions.map((_, i) =>
    el('span', {
      class: 'pip',
      'data-state': i < state.quizMarks.length ? (state.quizMarks[i] ? 'right' : 'wrong') : (i === state.quizIndex ? 'now' : ''),
    })));

  const optionNodes = question.options.map((text, index) =>
    el('button', {
      class: 'option',
      disabled: state.answered ? 'disabled' : null,
      'data-mark': state.answered ? (index === question.answer ? 'right' : (index === state.lastPick ? 'wrong' : '')) : '',
      onclick: () => answer(story, index),
    }, [
      el('span', { class: 'option-letter', text: 'ABCD'[index] }),
      el('span', { text }),
    ]));

  const verdict = state.answered ? el('div', {
    class: 'verdict',
    'data-kind': state.lastPick === question.answer ? 'right' : 'wrong',
  }, [
    el('div', { class: 'verdict-line', text: state.lastPick === question.answer ? 'Yes, that is right.' : 'Not that one.' }),
    el('div', { class: 'verdict-ref', text: `You can check it: ${question.reference}` }),
    el('button', {
      class: 'btn btn-primary',
      onclick: () => { state.quizIndex += 1; state.answered = false; render(); },
    }, [state.quizIndex + 1 >= state.quiz.questions.length ? 'See how you did' : 'Next question']),
  ]) : null;

  show(
    pips,
    el('h1', { class: 'question', text: question.question }),
    el('div', { class: 'options' }, optionNodes),
    verdict,
  );
}

function answer(story, index) {
  if (state.answered) return;
  const question = state.quiz.questions[state.quizIndex];
  state.lastPick = index;
  state.answered = true;
  state.quizMarks[state.quizIndex] = index === question.answer;
  render();
}

function renderQuizDone(story) {
  const answers = state.quiz.questions.map((q, i) => (state.quizMarks[i] ? q.answer : -1));
  const { right, total, passed } = scoreQuiz(state.quiz.questions, answers);
  state.progress = Store.recordQuiz(state.profile.id, story.id, right, total);

  show(el('div', { class: 'done', style: eraStyle(story.era) }, [
    el('div', { class: 'done-mark', text: passed ? '✓' : '↻' }),
    el('div', { class: 'tally font-display' }, [
      String(right),
      el('small', { text: ` out of ${total}` }),
    ]),
    el('h1', { class: 'font-display', text: passed ? 'Well done.' : 'Have another go.', style: 'margin-top:12px' }),
    el('p', { text: passed
      ? 'You know this one. The verse is the last part.'
      : 'Read the story once more and try again — the questions all come from it.' }),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn btn-primary', onclick: () => { state.quiz = null; go(`#/s/${story.id}/verse`); } }, ['Learn the verse']),
      el('button', { class: 'btn', onclick: () => { state.quiz = null; go(`#/s/${story.id}`); } }, ['Back to the story']),
    ]),
  ]));
}

/* ── The verse ────────────────────────────────────────────────────────────── */

function renderVerse(story) {
  refreshProgress();
  const marks = storyState(state.progress, story.id);
  const tokens = maskVerse(story.verse.text, state.verseLevel);

  const line = el('p', { class: 'verse-text' });
  tokens.forEach((token, index) => {
    if (index) line.append(' ');
    line.append(token.hidden
      ? el('span', { class: 'gap', text: token.hint, title: 'Can you remember it?' })
      : document.createTextNode(token.word));
  });

  const levels = el('div', { class: 'levels' }, VERSE_LEVELS.map((lvl) =>
    el('button', {
      class: 'level',
      'aria-pressed': String(state.verseLevel === lvl.level),
      onclick: () => { state.verseLevel = lvl.level; render(); },
    }, [lvl.label])));

  show(
    el('div', { class: 'story-head', style: eraStyle(story.era) }, [
      el('span', { class: 'story-era', text: 'Learn the verse' }),
      el('h1', { class: 'font-display', text: story.title }),
    ]),
    levels,
    el('div', { class: 'verse-box' }, [
      line,
      el('p', { class: 'verse-ref', text: story.verse.reference }),
      el('p', { class: 'verse-source', text: 'World English Bible' }),
    ]),
    el('div', { class: 'btn-row' }, [
      el('button', {
        class: marks.verse ? 'btn' : 'btn btn-primary',
        onclick: () => {
          state.progress = Store.markVerse(state.profile.id, story.id, !marks.verse);
          render();
        },
      }, [marks.verse ? 'Learned ✓ — undo' : 'I can say it']),
      el('button', { class: 'btn btn-quiet', onclick: () => go(`#/s/${story.id}`) }, ['Back to the story']),
    ]),
  );
}

/* ── Who is using this ────────────────────────────────────────────────────── */

function closeSheet() { sheetHost.textContent = ''; }

function sheet(children) {
  closeSheet();
  const backdrop = el('div', {
    class: 'sheet-backdrop',
    onclick: (event) => { if (event.target === backdrop) closeSheet(); },
  }, [el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, children)]);
  sheetHost.append(backdrop);
  const focusable = backdrop.querySelector('input, button');
  if (focusable) focusable.focus();
}

function openProfiles() {
  const people = Store.profiles();
  sheet([
    el('h2', { text: 'Who is reading?' }),
    el('p', { class: 'sub', text: 'Everybody keeps their own place in the story.' }),
    el('div', { class: 'people' }, people.map((person) =>
      el('button', {
        class: 'person',
        'aria-current': String(state.profile && person.id === state.profile.id),
        onclick: () => {
          Store.selectProfile(person.id);
          state.profile = Store.currentProfile();
          state.quiz = null;
          closeSheet();
          go('#/');
          render();
        },
      }, [
        el('span', { class: 'avatar', text: person.name.slice(0, 1).toUpperCase() }),
        el('span', {}, [
          el('span', { class: 'person-name', text: person.name, style: 'display:block' }),
          el('span', { class: 'person-band', text: bandById(person.band).label + ' years' }),
        ]),
        el('span', {
          class: 'person-remove',
          role: 'button',
          title: `Remove ${person.name}`,
          onclick: (event) => {
            event.stopPropagation();
            confirmRemove(person);
          },
        }, ['×']),
      ]))),
    people.length < Store.MAX_PROFILES
      ? el('button', { class: 'btn btn-block', onclick: () => openNewProfile(false) }, ['Add somebody'])
      : el('p', { class: 'sub', text: 'That is as many as this app keeps on one device.' }),
  ]);
}

function confirmRemove(person) {
  sheet([
    el('h2', { text: `Remove ${person.name}?` }),
    el('p', { class: 'sub', text: 'Their place in the story and everything they have learned will be gone from this device.' }),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn', onclick: openProfiles }, ['Keep']),
      el('button', {
        class: 'btn btn-primary',
        onclick: () => {
          Store.removeProfile(person.id);
          state.profile = Store.currentProfile();
          state.quiz = null;
          closeSheet();
          render();
        },
      }, ['Remove']),
    ]),
  ]);
}

function openNewProfile(first) {
  let band = 'middle';
  const name = el('input', { class: 'field', type: 'text', maxlength: '24', placeholder: 'Your name', autocomplete: 'off' });

  const bandButtons = AGE_BANDS.map((option) =>
    el('button', {
      class: 'band',
      'aria-pressed': String(band === option.id),
      onclick: () => {
        band = option.id;
        for (const node of bandButtons) node.setAttribute('aria-pressed', String(node.dataset.band === band));
      },
      'data-band': option.id,
    }, [
      el('span', { class: 'band-age', text: option.label + ' years', style: 'display:block' }),
      el('span', { class: 'band-note', text: {
        young: 'Shorter stories, three questions each.',
        middle: 'The whole story, five questions each.',
        older: 'The full account, a Go deeper note, and the hardest questions.',
      }[option.id] }),
    ]));

  sheet([
    el('h2', { text: first ? 'Who is reading?' : 'Add somebody' }),
    el('p', { class: 'sub', text: 'This stays on this phone. Nothing is sent anywhere.' }),
    el('label', { class: 'field-label', for: 'name' }, ['Name']),
    name,
    el('span', { class: 'field-label', text: 'How old are you?' }),
    el('div', { class: 'bands' }, bandButtons),
    el('button', {
      class: 'btn btn-primary btn-block',
      onclick: () => {
        const profile = Store.addProfile(name.value, band);
        if (!profile) return;
        state.profile = profile;
        state.progress = Store.progressFor(profile.id);
        state.quiz = null;
        closeSheet();
        go('#/');
        render();
      },
    }, ['Start reading']),
  ]);
}

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSheet(); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus */ });
}

boot();
