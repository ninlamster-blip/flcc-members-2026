// ONLINE — the weekly leaderboard, the team goal, and cheers.
//
// Before joining, this screen says exactly what is sent and what never is.
// After joining, a young person is a nickname the server chose, on a board
// with only their own age group, and can send only the cheers in the list.

import { h, poster, label, display, headline, art, pill, track, note, toast, waiting } from '../core/ui.js';
import * as online from '../core/online.js';
import { avatar } from '../core/avatar.js';

export default async function boardScreen(ctx) {
  const el = h('div', { style: 'display:contents' }, poster({ tone: 'paper', className: 'full' }, waiting()));
  const band = ctx.mode;

  const paint = async () => {
    const self = online.me(band);
    if (!self) { el.replaceChildren(...await joinPosters()); return; }
    el.replaceChildren(youPoster(self), poster({ tone: 'paper', className: 'full' }, waiting()));
    const [hop, galaga, got] = await Promise.all([online.board('hop', band), online.board('galaga', band), online.cheers()]);
    if (!hop && !galaga) {
      el.replaceChildren(youPoster(self), poster({ tone: 'paper', className: 'full' }, note('The leaderboard could not be reached. Check your connection and try again.')));
      return;
    }
    el.replaceChildren(youPoster(self),
      ...[hop, galaga].filter(Boolean).map((data) => teamPoster(data)),
      ...[hop, galaga].filter(Boolean).map((data) => boardPoster(data, self)),
      cheersPoster(got));
  };

  // ── Not joined: what joining means ─────────────────────────────────────
  const joinPosters = async () => {
    const up = await online.available();
    const kids = band === 'kids';
    return [
      poster({ tone: 'sky', tall: true, className: 'full' },
        label('Play online'),
        h('div', {}, display('PLAY WITH EVERYONE.'),
          h('p', { class: 'body dim', style: 'margin-top:1rem', text: `A weekly leaderboard for Hop Across and Galaga, a team goal the whole ${kids ? 'kids' : 'teens'} group works on together, and cheers you can send each other.` })),
        h('div', { class: 'poster-foot' }, h('span'), art('people', { tone: 'sky', size: 'sm' }))),
      poster({ tone: 'paper', className: 'full' },
        label('Before you join'),
        h('p', { class: 'body', text: 'You get a nickname the app picks, like "Brave Lion 42", and your avatar from Me shows beside it. Nobody sees your real name or a photo of you — not even us.' }),
        h('p', { class: 'body', style: 'margin-top:.7rem', text: `What gets sent: that you are in the ${kids ? 'kids (7–12)' : 'teens (13–18)'} group, and your Hop Across and Galaga scores. You only ever see players your own age.` }),
        h('p', { class: 'body', style: 'margin-top:.7rem', text: 'What never gets sent: your name, your age, your prayers, or anything you type. Messages are cheers picked from a list — nobody can type anything to you.' }),
        kids ? h('p', { class: 'lead', style: 'margin-top:1rem', text: 'Ask a parent before you join.' }) : null,
        h('div', { class: 'poster-foot', style: 'margin-top:1.2rem' },
          up
            ? pill('Join with a nickname', async (event) => {
              event.currentTarget.disabled = true;
              const result = await online.join(band);
              if (!result.joined) { toast('Could not join right now. Try again later.'); event.currentTarget.disabled = false; return; }
              toast(`You are ${result.nickname}!`);
              paint();
            })
            : h('p', { class: 'body dim', text: 'Playing online is not switched on yet, or you are offline.' }),
          h('p', { class: 'label dimmer', text: 'You can leave any time' }))),
    ];
  };

  // ── Joined: who you are ─────────────────────────────────────────────────
  const youPoster = (self) => poster({ tone: 'captain', className: 'full' },
    label('You are playing as'),
    headline(self.nickname.toUpperCase()),
    h('p', { class: 'body dim', style: 'margin-top:.6rem', text: self.onBoard ? 'You are on the leaderboard.' : 'Hidden from the leaderboard — your scores still count for the team.' }),
    h('div', { class: 'pill-row', style: 'margin-top:1rem' },
      pill('New nickname', async () => { const name = await online.rename(); if (name) { toast(`You are ${name} now.`); paint(); } }, { quiet: true }),
      pill(self.onBoard ? 'Hide me' : 'Show me', async () => { if (await online.setOnBoard(!self.onBoard)) paint(); }, { quiet: true }),
      pill('Leave', async () => {
        if (await online.leave()) { toast('Left. Everything about you online has been deleted.'); paint(); }
        else toast('Could not reach the server — try again when you are online.');
      }, { quiet: true })));

  // ── The team goal ───────────────────────────────────────────────────────
  const teamPoster = (data) => {
    const done = Math.min(100, Math.round((data.team.total / data.team.goal) * 100));
    const unit = data.game === 'hop' ? 'rows hopped' : 'Galaga points';
    return poster({ tone: data.game === 'hop' ? 'sunshine' : 'sky', className: 'full' },
      label(`Team goal · ${online.GAMES[data.game]}`),
      headline(done >= 100 ? 'GOAL REACHED!' : `${data.team.total.toLocaleString()} OF ${data.team.goal.toLocaleString()}`),
      h('p', { class: 'body dim', style: 'margin-top:.6rem', text: `${unit} together this week by ${data.team.players} ${data.team.players === 1 ? 'player' : 'players'}. Every run counts${data.mine && data.mine.total ? ` — you added ${data.mine.total.toLocaleString()}` : ''}.` }),
      h('div', { style: 'margin-top:1rem' }, track(done)));
  };

  // ── The top ten, with cheers ────────────────────────────────────────────
  const boardPoster = (data, self) => {
    const rows = data.top.length
      ? data.top.map((row) => h('div', { class: 'board-row', dataset: row.you ? { you: '' } : {} },
        h('span', { class: 'board-rank', text: `${row.rank}` }),
        h('span', { class: 'board-name who' }, avatar(row.avatar, { seed: row.id }), h('span', { text: row.you ? `${row.nickname} (you)` : row.nickname })),
        h('span', { class: 'board-score', text: row.best.toLocaleString() }),
        row.you ? h('span') : h('button', { class: 'board-cheer', type: 'button', 'aria-label': `Cheer ${row.nickname}`, text: '🙌', onclick: () => pickCheer(row) })))
      : [h('p', { class: 'body dim', text: 'Nobody has played yet this week. Be the first!' })];
    return poster({ tone: 'paper', className: 'full' },
      label(`This week · ${online.GAMES[data.game]} · ${band === 'kids' ? 'kids' : 'teens'}`),
      h('div', { class: 'board', style: 'margin-top:.6rem' }, ...rows),
      h('div', { class: 'poster-foot', style: 'margin-top:1rem' },
        h('p', { class: 'label dimmer', text: `Your best this week: ${data.mine ? data.mine.best.toLocaleString() : 0} · starts again every Monday` }),
        pill('Play', () => ctx.go(`game/${data.game}`), { quiet: true })));
  };

  const pickCheer = (row) => {
    const sheet = poster({ tone: 'rose', className: 'full' },
      label(`Cheer ${row.nickname}`),
      h('div', { class: 'pill-row', style: 'margin-top:.8rem' },
        ...online.CHEERS.map((text, kind) => pill(text, async () => {
          const result = await online.cheer(row.id, kind);
          toast(result.sent ? `Sent to ${row.nickname}!` : result.limited ? 'That is plenty of cheering for today!' : 'Could not send right now.');
          sheet.remove();
        }, { quiet: true }))),
      h('div', { class: 'poster-foot', style: 'margin-top:1rem' }, pill('Cancel', () => sheet.remove(), { quiet: true })));
    el.prepend(sheet);
    sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cheersPoster = (got) => poster({ tone: 'rose', className: 'full' },
    label('Cheers for you'),
    ...(got.length
      ? got.slice(0, 10).map((row) => h('p', { class: 'body', style: 'margin-top:.4rem' }, h('strong', { text: row.text }), ` — from ${row.from}`))
      : [h('p', { class: 'body dim', text: 'No cheers yet. Play a round and climb the board!' })]));

  paint();
  return { title: 'Play online', el };
}
