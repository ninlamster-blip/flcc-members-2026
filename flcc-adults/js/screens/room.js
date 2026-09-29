// ROOM — a Bible quiz, played together at the same moment on your own phones.
//
// One member makes a room and reads out its four letters; others type them in.
// Everyone gets the same ten questions at the same time, twelve seconds each,
// and at the end the room shows who answered what. Nothing is kept afterwards:
// no leaderboard, no running total, no record on this phone — this edition
// keeps no score, and a room is deleted a few hours after it was made.
//
// The only things that can be said are the ready-made lines in
// rooms.ROOM_SAYS. There is no way to type a message.

import { h, poster, label, display, headline, art, pill, choice, track, note, toast, waiting, rows, row, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rooms from '../core/rooms.js';

const POLL_MS = 1000;

export default async function roomScreen(ctx) {
  const el = h('div', { style: 'display:contents' });
  const home = location.hash;
  let timer = 0;
  const code = (ctx.route.params.code || '').toUpperCase();
  let asked = { index: -2 };

  const stop = () => { clearTimeout(timer); timer = 0; };
  const alive = () => location.hash === home && el.isConnected;

  // ── Not in rooms yet: what it means ─────────────────────────────────────
  if (!rooms.me()) {
    const up = await rooms.available();
    swap(el,
      poster({ tone: 'sky', tall: true },
        label('Play together'),
        h('div', {}, display('A BIBLE QUIZ, TOGETHER.'),
          h('p', { class: 'lead dim', style: 'margin-top:1rem', text: 'One of you makes a room and reads out its four letters. Everyone answers the same ten questions at the same moment, on their own phone.' })),
        h('div', { class: 'poster-foot' }, h('span'), art('star', { tone: 'sky', size: 'sm' }))),
      poster({ tone: 'paper' },
        label('What this sends'),
        rows(
          row({ title: 'A nickname the app picks', meta: 'Sent' }),
          row({ title: 'Whether each answer was right', meta: 'Sent' }),
          row({ title: 'Lines you tap, like “🤝 Good game!”', meta: 'Sent' }),
          row({ title: 'Your name, or anything you type', meta: 'Never' }),
          row({ title: 'A score or a leaderboard', meta: 'None' }),
        ),
        note('Rooms are for adults only, and each one is deleted a few hours after it was made. Everything else in this app still stays on this phone.'),
        h('div', { class: 'poster-foot', style: 'margin-top:1rem' },
          up
            ? pill('Get a nickname and play', async (event) => {
              event.currentTarget.disabled = true;
              const result = await rooms.join();
              if (!result.joined) { toast('Could not reach the server. Try again when you are online.'); event.currentTarget.disabled = false; return; }
              toast(`You are ${result.nickname}.`);
              ctx.refresh();
            })
            : h('p', { class: 'body dim', text: 'Rooms are not switched on yet, or you are offline.' }))));
    return { title: 'Play together', el };
  }

  let bank = [];
  try { bank = (await content.quiz()).questions || []; } catch { /* the screen below says so */ }
  if (!bank.length) {
    return { title: 'Play together', el: poster({ tone: 'paper' }, note('The quiz questions could not be loaded.')) };
  }

  // ── Saying something: the ready-made lines ──────────────────────────────
  const talk = (state) => poster({ tone: 'paper' },
    label('Say something'),
    h('div', { class: 'room-said' },
      ...(state.says.length
        ? state.says.slice(-6).map((line) => h('p', { class: 'body' }, h('strong', { text: `${line.from}: ` }), line.text))
        : [h('p', { class: 'body dim', text: 'Nothing said yet.' })])),
    h('div', { class: 'pill-row', style: 'margin-top:.8rem' },
      ...rooms.ROOM_SAYS.map((text, kind) => pill(text, async () => {
        const result = await rooms.say(code, kind);
        if (result.status === 429) toast('A little slower.');
        else refresh();
      }, { quiet: true }))));

  const players = (state, finalRound = false) => rows(...[...state.players]
    .sort((a, b) => (finalRound ? b.score - a.score : 0))
    .map((p) => row({
      title: `${p.nickname}${p.you ? ' (you)' : ''}`,
      meta: finalRound ? `${p.score} right` : state.status === 'playing' ? (p.progress >= (state.question ?? -1) ? 'answered' : '…') : '',
    })));

  // ── No room yet: make one, or join one ──────────────────────────────────
  const menu = () => {
    const input = h('input', { type: 'text', maxlength: '4', placeholder: 'ABCD', 'aria-label': 'Room code', autocapitalize: 'characters', autocomplete: 'off', class: 'room-code-input' });
    swap(el,
      poster({ tone: 'ink', tall: true },
        label(`Play together · ${rooms.me().nickname}`),
        h('div', {}, display('MAKE A ROOM.'),
          h('p', { class: 'lead dim', style: 'margin-top:1rem', text: 'You will get four letters to read out. Start when everyone is in.' })),
        h('div', { class: 'pill-row' },
          pill('Make a quiz room', async (event) => {
            event.currentTarget.disabled = true;
            const result = await rooms.createRoom();
            if (!result.ok) { toast(result.message || 'Could not make a room.'); event.currentTarget.disabled = false; return; }
            ctx.go(`room?code=${result.data.code}`);
          }))),
      poster({ tone: 'paper' },
        label('Got a code?'),
        h('div', { style: 'margin-top:.6rem' }, input),
        h('div', { class: 'poster-foot', style: 'margin-top:1rem' },
          pill('Join', async () => {
            const result = await rooms.joinRoom(input.value);
            if (!result.ok) { toast(result.message || 'Could not join that room.'); return; }
            ctx.go(`room?code=${result.data.code}`);
          }),
          pill('Stop playing in rooms', async () => {
            if (await rooms.leave()) { toast('Done. Your nickname has been deleted.'); ctx.go('play'); }
            else toast('Could not reach the server — try again when you are online.');
          }, { quiet: true }))));
  };

  // ── In a room ───────────────────────────────────────────────────────────
  const refresh = async () => {
    stop();
    if (!alive()) return;
    const state = await rooms.room(code);
    if (!alive()) return;
    if (!state || state.gone) { toast('That room has closed.'); ctx.go('room'); return; }
    if (state.offline) { timer = setTimeout(refresh, POLL_MS * 2); return; }
    if (state.status === 'lobby') lobby(state);
    else if (state.status === 'playing') quiz(state);
    else results(state);
    if (state.status !== 'done') timer = setTimeout(refresh, POLL_MS);
  };

  const lobby = (state) => {
    const enough = state.players.length >= 2;
    swap(el,
      poster({ tone: 'sunshine', tall: true },
        label('Quiz room'),
        h('div', {}, h('p', { class: 'label', text: 'Room code' }), display(state.code),
          h('p', { class: 'lead dim', style: 'margin-top:.8rem', text: state.host ? 'Read these letters out. Start when everyone is in.' : 'Waiting for whoever made the room to start…' })),
        h('div', { class: 'pill-row' },
          state.host ? pill(enough ? 'Start' : 'Waiting for someone to join…', async () => {
            const result = await rooms.startRoom(code);
            if (!result.ok) toast(result.message || 'Could not start.');
            refresh();
          }, enough ? {} : { disabled: '' }) : null,
          pill('Leave room', async () => { await rooms.leaveRoom(code); ctx.go('room'); }, { quiet: true }))),
      poster({ tone: 'paper' }, label(`In the room · ${state.players.length}`), players(state)),
      talk(state));
  };

  const quiz = (state) => {
    const now = state.clock();
    if (now < state.startedMs) {
      asked = { index: -2 };
      swap(el, poster({ tone: 'sunshine', tall: true },
        label('Get ready'), display(`${Math.ceil((state.startedMs - now) / 1000)}…`), h('span')));
      return;
    }
    const index = Math.min(state.questions, Math.floor((now - state.startedMs) / state.questionMs));
    const left = Math.max(0, state.startedMs + (index + 1) * state.questionMs - now);
    if (asked.index === index) {                 // the same question: only the clock and the room move
      swap(asked.bar, track((left / state.questionMs) * 100));
      swap(asked.who, players(state));
      return;
    }
    const question = rooms.questionsFor(bank, state.seed, state.questions)[index];
    if (!question) { results(state); return; }
    const order = rooms.shown(question);
    const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });
    let done = false;
    const options = h('div', { class: 'choice-list room-choices', style: 'margin-top:1.2rem' },
      ...order.options.map((text, option) => choice(text, async () => {
        if (done) return;
        done = true;
        const right = option === order.answer;
        options.children[option].dataset[right ? 'right' : 'wrong'] = '';
        if (!right) options.children[order.answer].dataset.right = '';
        feedback.textContent = `${right ? 'Right.' : 'Not this one.'} ${question.why} (${question.ref})`;
        const result = await rooms.answer(code, index, right);
        if (!result.ok) feedback.textContent = 'Too late for that one.';
      })));
    const bar = h('div', {}, track((left / state.questionMs) * 100));
    const who = h('div', {}, players(state));
    swap(el,
      poster({ tone: 'rose', tall: true },
        h('div', { class: 'poster-head' }, label(`Question ${index + 1} of ${state.questions}`), label(state.code)),
        h('div', {}, headline(question.q), options, feedback),
        bar),
      poster({ tone: 'paper' }, label('In the room'), who),
      talk(state));
    asked = { index, bar, who };
  };

  const results = (state) => {
    swap(el,
      poster({ tone: 'sunshine', tall: true },
        label('Quiz room · done'),
        h('div', {}, display('WELL PLAYED.'),
          h('p', { class: 'lead dim', style: 'margin-top:1rem', text: `Out of ${state.questions}. Nothing is kept once you leave — no scores, no table.` })),
        h('div', { class: 'pill-row' }, pill('New room', () => ctx.go('room')), pill('Back to Play', () => ctx.go('play'), { quiet: true }))),
      poster({ tone: 'paper' }, label('This round'), players(state, true)),
      talk(state));
  };

  // The first look waits a tick: the shell puts this screen on the page after
  // it returns, and refresh() stops as soon as the screen is not on the page.
  if (code) { el.appendChild(poster({ tone: 'paper' }, waiting())); setTimeout(refresh, 0); }
  else menu();
  return { title: 'Play together', el };
}
