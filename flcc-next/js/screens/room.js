// ROOMS — a live quiz battle or a Hop Across race, with friends, by code.
//
// One player makes a room and reads out its four letters; friends of the same
// age group type them in. Everyone in a quiz gets the same ten questions at
// the same moment, dealt from the room's seed, and the server's clock keeps
// the phones in step. The only things that can be said are the ready-made
// lines in online.ROOM_SAYS — there is no way to type a message.

import { h, poster, label, display, headline, art, pill, choice, track, note, toast, waiting } from '../core/ui.js';
import * as content from '../core/content.js';
import * as online from '../core/online.js';
import { permute, askOrder } from '../core/rotation.js';
import { forAgeGroup } from '../core/profile.js';

const POLL_MS = 1000;

export default async function roomScreen(ctx) {
  const el = h('div', { style: 'display:contents' });
  const home = location.hash;
  let timer = 0;
  let code = (ctx.route.params.code || '').toUpperCase();
  let last = null;                  // the last room state painted
  let asked = { index: -2 };        // the question on screen, and whether it has been answered

  const stop = () => { clearTimeout(timer); timer = 0; };
  const alive = () => location.hash === home && el.isConnected;

  if (!online.me(ctx.mode)) {
    el.replaceChildren(poster({ tone: 'sky', tall: true, className: 'full' },
      label('Play with friends'),
      h('div', {}, display('GET A NICKNAME FIRST.'),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: 'Rooms use your online nickname, so nobody sees your real name. It takes one tap.' })),
      h('div', { class: 'poster-foot' }, pill('Get a nickname', () => ctx.go('board')), art('people', { tone: 'sky', size: 'sm' }))));
    return { title: 'Play with friends', el };
  }

  let bank = [];
  try { bank = (await content.quiz()).filter((row) => forAgeGroup(row, ctx.mode)); } catch { /* the race still works */ }

  // ── Say something: the ready-made lines, and what has been said ─────────
  const sayBar = () => h('div', { class: 'pill-row', style: 'margin-top:.8rem' },
    ...online.ROOM_SAYS.map((text, kind) => pill(text, async () => {
      const result = await online.say(code, kind);
      if (result.status === 429) toast('Slow down a little!');
      else refresh();
    }, { quiet: true })));
  const saidList = (state) => h('div', { class: 'room-said' },
    ...(state.says.length ? state.says.slice(-6).map((row) => h('p', { class: 'body' }, h('strong', { text: `${row.from}: ` }), row.text))
      : [h('p', { class: 'body dim', text: 'Nobody has said anything yet.' })]));
  const talk = (state) => poster({ tone: 'paper', className: 'full' }, label('Say something'), saidList(state), sayBar());

  const standings = (state, by = 'score') => {
    const sorted = [...state.players].sort((a, b) => b[by] - a[by]);
    return h('div', { class: 'board' }, ...sorted.map((p, i) => h('div', { class: 'board-row', dataset: p.you ? { you: '' } : {} },
      h('span', { class: 'board-rank', text: String(i + 1) }),
      h('span', { class: 'board-name', text: `${p.nickname}${p.you ? ' (you)' : ''}${state.kind === 'hop' && !p.alive && state.status === 'playing' ? ' · out' : ''}` }),
      h('span', { class: 'board-score', text: String(Math.max(0, p[by])) }),
      h('span'))));
  };

  // ── No room yet: make one, or join one ──────────────────────────────────
  const menu = () => {
    stop();
    const input = h('input', { type: 'text', maxlength: '4', placeholder: 'ABCD', 'aria-label': 'Room code', autocapitalize: 'characters', autocomplete: 'off', style: 'text-transform:uppercase;letter-spacing:.3em;font-weight:900;font-size:1.6rem' });
    const make = (kind) => async (event) => {
      event.currentTarget.disabled = true;
      const result = await online.createRoom(kind);
      if (!result.ok) { toast(result.message || 'Could not make a room right now.'); event.currentTarget.disabled = false; return; }
      code = result.data.code;
      ctx.go(`room?code=${code}`);
    };
    el.replaceChildren(
      poster({ tone: 'captain', tall: true, className: 'full' },
        label(`Play with friends · ${online.me().nickname}`),
        h('div', {}, display('MAKE A ROOM.'),
          h('p', { class: 'body dim', style: 'margin-top:1rem', text: 'You get a four-letter code. Friends your age type it in, and you all play at the same time.' })),
        h('div', { class: 'pill-row' }, pill('Quiz battle', make('quiz')), pill('Hop Across race', make('hop')))),
      poster({ tone: 'paper', className: 'full' },
        label('Got a code?'),
        h('div', { style: 'margin-top:.6rem' }, input),
        h('div', { class: 'poster-foot', style: 'margin-top:1rem' },
          pill('Join', async () => {
            const result = await online.joinRoom(input.value);
            if (!result.ok) { toast(result.message || 'Could not join that room.'); return; }
            ctx.go(`room?code=${result.data.code}`);
          }),
          h('p', { class: 'label dimmer', text: 'Kids and teens have separate rooms' }))));
  };

  // ── In a room ───────────────────────────────────────────────────────────
  const refresh = async () => {
    stop();
    if (!alive()) return;
    const state = await online.room(code);
    if (!alive()) return;
    if (!state || state.gone) { toast('That room has closed.'); ctx.go('room'); return; }
    if (state.offline) { timer = setTimeout(refresh, POLL_MS * 2); return; }
    last = state;
    if (state.status === 'lobby') lobby(state);
    else if (state.kind === 'hop' && state.status === 'playing') { ctx.go(`game/hop?room=${code}&seed=${state.seed}`); return; }
    else if (state.kind === 'quiz' && state.status === 'playing') quiz(state);
    else results(state);
    if (state.status !== 'done') timer = setTimeout(refresh, POLL_MS);
  };

  const lobby = (state) => {
    const enough = state.players.length >= 2;
    el.replaceChildren(
      poster({ tone: 'sunshine', tall: true, className: 'full' },
        label(state.kind === 'quiz' ? 'Quiz battle' : 'Hop Across race'),
        h('div', {}, h('p', { class: 'label', text: 'Room code' }), display(state.code),
          h('p', { class: 'body dim', style: 'margin-top:.8rem', text: state.host ? 'Read these letters out to your friends. Start when everyone is in.' : 'Waiting for the host to start…' })),
        h('div', { class: 'pill-row' },
          state.host ? pill(enough ? 'Start' : 'Waiting for a friend…', async () => {
            const result = await online.startRoom(code);
            if (!result.ok) toast(result.message || 'Could not start.');
            refresh();
          }, enough ? {} : { disabled: '' }) : null,
          pill('Leave room', async () => { await online.leaveRoom(code); ctx.go('room'); }, { quiet: true }))),
      poster({ tone: 'paper', className: 'full' }, label(`In the room · ${state.players.length}`), standings(state)),
      talk(state));
  };

  const quiz = (state) => {
    const now = state.clock();
    const index = Math.min(state.questions, Math.floor((now - state.startedMs) / state.questionMs));
    const questions = permute(bank, state.seed).slice(0, state.questions);
    if (now < state.startedMs) {
      el.replaceChildren(poster({ tone: 'sunshine', tall: true, className: 'full' },
        label('Get ready'), display(`${Math.ceil((state.startedMs - now) / 1000)}…`), h('span')));
      return;
    }
    const left = Math.max(0, state.startedMs + (index + 1) * state.questionMs - now);
    if (asked.index === index && asked.el) {         // the same question: only the clock and the scores move
      asked.bar.replaceChildren(track((left / state.questionMs) * 100));
      asked.scores.replaceChildren(standings(state));
      return;
    }
    const round = questions[index];
    if (!round) { results(state); return; }
    const order = askOrder(round.options, round.answer, round.q);
    const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });
    let done = false;
    const options = h('div', { class: 'choice-list', style: 'margin-top:1.2rem' },
      ...order.options.map((text, option) => choice(text, async () => {
        if (done) return;
        done = true;
        const right = option === order.answer;
        options.children[option].dataset[right ? 'right' : 'wrong'] = '';
        if (!right) options.children[order.answer].dataset.right = '';
        feedback.textContent = right ? 'Right! Wait for the next one…' : 'Not this time. Wait for the next one…';
        const result = await online.answer(code, index, right);
        if (!result.ok) feedback.textContent = 'Too late for that one!';
      })));
    const bar = h('div', {}, track((left / state.questionMs) * 100));
    const scores = h('div', {}, standings(state));
    el.replaceChildren(
      poster({ tone: 'rose', tall: true, className: 'full' },
        h('div', { class: 'poster-head' }, label(`Question ${index + 1} of ${state.questions}`), label(state.code)),
        h('div', {}, headline(round.q), options, feedback),
        bar),
      poster({ tone: 'paper', className: 'full' }, label('Scores'), scores),
      talk(state));
    asked = { index, el: true, bar, scores };
  };

  const results = (state) => {
    const by = state.kind === 'hop' ? 'progress' : 'score';
    const sorted = [...state.players].sort((a, b) => b[by] - a[by]);
    const top = sorted.length ? sorted[0][by] : 0;
    const winners = sorted.filter((p) => p[by] === top);
    el.replaceChildren(
      poster({ tone: 'sunshine', tall: true, className: 'full' },
        label(state.kind === 'quiz' ? 'Quiz battle · final' : 'Hop Across race · final'),
        h('div', {}, display(winners.length > 1 ? 'A DRAW!' : `${winners[0].nickname.toUpperCase()} WINS!`),
          h('p', { class: 'body dim', style: 'margin-top:1rem', text: state.kind === 'quiz' ? `Out of ${state.questions} questions.` : 'By the furthest row reached.' })),
        h('div', { class: 'pill-row' }, pill('New room', () => ctx.go('room')), pill('Back to Play', () => ctx.go('play'), { quiet: true }))),
      poster({ tone: 'paper', className: 'full' }, label('Final'), standings(state, by)),
      talk(state));
  };

  // The first look waits a tick: the shell puts this screen on the page after
  // it returns, and refresh() stops as soon as the screen is not on the page.
  if (code) { el.appendChild(poster({ tone: 'paper', className: 'full' }, waiting())); setTimeout(refresh, 0); }
  else menu();
  return { title: 'Play with friends', el };
}
