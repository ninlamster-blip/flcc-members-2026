// PLAY TOGETHER — a Bible quiz for 2 to 4 players, taking turns on one phone.
//
// Between turns the phone shows only "Pass to Sam", so nobody sees the next
// question before it is theirs. Nothing here is stored or sent: the names are
// forgotten when the round ends.

import { h, poster, label, display, headline, art, pill, choice, note, moment } from '../core/ui.js';
import * as content from '../core/content.js';
import * as party from '../core/party.js';
import { deal, askOrder } from '../core/rotation.js';
import { forAgeGroup } from '../core/profile.js';

const TONES = ['sunshine', 'rose', 'sky', 'captain'];

export default async function partyScreen(ctx) {
  let bank = [];
  try { bank = (await content.quiz()).filter((row) => forAgeGroup(row, ctx.mode)); } catch { /* below */ }
  if (bank.length < party.MIN_PLAYERS * party.PER_PLAYER) {
    return { title: 'Play together', el: poster({ tone: 'paper', className: 'full' }, note('The quiz questions could not be loaded.')) };
  }

  const el = h('div', { style: 'display:contents' });
  let rounds = 0;               // each new round deals a different slice of today's questions

  // ── Who is playing ──────────────────────────────────────────────────────
  const setup = (previous = []) => {
    const inputs = Array.from({ length: party.MAX_PLAYERS }, (_, i) => h('input', {
      type: 'text', maxlength: String(party.NAME_LENGTH), value: previous[i] || '',
      placeholder: i < party.MIN_PLAYERS ? `Player ${i + 1}` : `Player ${i + 1} (optional)`,
      'aria-label': `Player ${i + 1} name`,
    }));
    const problem = h('p', { class: 'body', style: 'margin-top:.8rem' });
    const start = () => {
      const players = party.names(inputs.map((input) => input.value));
      if (players.length < party.MIN_PLAYERS) { problem.textContent = 'Type at least two names to start.'; return; }
      const count = players.length * party.PER_PLAYER;
      const questions = deal(bank, { count, offset: 11 + rounds * count });
      rounds += 1;
      play(party.create(players, questions));
    };
    el.replaceChildren(
      poster({ tone: 'sky', tall: true, className: 'full' },
        label('Play together'),
        h('div', {},
          display('ONE PHONE. UP TO FOUR PLAYERS.'),
          h('p', { class: 'body dim', style: 'margin-top:1rem', text: `A Bible quiz, taking turns. ${party.PER_PLAYER} questions each — pass the phone when it says so.` })),
        h('div', { class: 'poster-foot' }, h('span'), art('people', { tone: 'sky', size: 'sm' }))),
      poster({ tone: 'paper', className: 'full' },
        label('Who is playing?'),
        ...inputs.map((input) => h('div', { style: 'margin-top:.4rem' }, input)),
        problem,
        h('div', { class: 'poster-foot', style: 'margin-top:1.2rem' },
          pill('Start', start),
          h('p', { class: 'label dimmer', text: 'Names stay on this phone, and only for this game' }))));
  };

  // ── A turn: pass the phone, then the question ───────────────────────────
  const play = (game) => {
    const now = party.current(game);
    if (!now) { finish(game); return; }
    const tone = TONES[game.players.indexOf(now.player) % TONES.length];
    el.replaceChildren(poster({ tone, tall: true, className: 'full', as: 'button', onclick: () => ask(game, now, tone) },
      label(`Question ${now.number} of ${game.questions.length}`),
      h('div', {}, display(`PASS TO ${now.player.name.toUpperCase()}.`),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: 'Only look when it’s your turn. Tap when you’re ready.' })),
      h('div', { class: 'poster-foot' }, scoreLine(game), art('people', { tone, size: 'sm' }))));
  };

  const ask = (game, now, tone) => {
    const round = now.question;
    const asked = askOrder(round.options, round.answer, round.q);
    const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });
    let answered = false;
    const options = h('div', { class: 'choice-list', style: 'margin-top:1.4rem' },
      ...asked.options.map((text, option) => choice(text, () => {
        if (answered) return;
        answered = true;
        const right = option === asked.answer;
        options.children[option].dataset[right ? 'right' : 'wrong'] = '';
        if (!right) options.children[asked.answer].dataset.right = '';
        feedback.textContent = `${right ? 'Right!' : 'Not this time.'} ${round.why || ''}`;
        party.answer(game, right);
        next.hidden = false;
      })));
    const next = pill(game.turn + 1 >= game.questions.length ? 'See who won' : 'Next player', () => play(game));
    next.hidden = true;
    el.replaceChildren(poster({ tone, tall: true, className: 'full' },
      h('div', { class: 'poster-head' }, label(now.player.name), label(`Question ${now.number} of ${game.questions.length}`)),
      h('div', {}, headline(round.q), options, feedback),
      h('div', { class: 'poster-foot' }, next, art('question', { tone, size: 'sm' }))));
  };

  const scoreLine = (game) => h('p', { class: 'label', text: game.players.map((p) => `${p.name} ${p.score}`).join(' · ') });

  // ── The end ─────────────────────────────────────────────────────────────
  const finish = (game) => {
    const { sorted, winners, outOf } = party.standings(game);
    const big = winners.length > 1 ? 'A DRAW!' : `${winners[0].name.toUpperCase()} WINS!`;
    el.replaceChildren(poster({ tone: 'paper', className: 'full' },
      label('Final scores'),
      ...sorted.map((p) => h('p', { class: 'lead', style: 'margin-top:.5rem', text: `${p.name} — ${p.score} of ${outOf}` }))));
    moment({
      tone: 'sunshine', eyebrow: 'Play together', big, line: 'Well played, everyone. Play again, or swap in new players?',
      action: 'Play again', onclose: () => setup(game.players.map((p) => p.name)),
    });
  };

  setup();
  return { title: 'Play together', el };
}
