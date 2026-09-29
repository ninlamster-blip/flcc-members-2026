// THE PRAYER WALL — requests members chose to share with the whole church.
//
// A request arrives here only when a member writes one below or taps "Share
// with the church" on a prayer in their own list; the list itself stays on the
// phone. Every request is signed with the sharer's first name, and the screen
// says so, beside the button, before anything is sent. Words that sound like
// someone is in danger are not posted at all: the screen shows who to tell.

import { h, poster, label, display, art, go, pill, note, rows, toast, waiting, swap } from '../core/ui.js';
import { SAFETY_CARD } from '../core/safety.js';
import { firstName } from '../core/profile.js';
import * as wall from '../core/wall.js';
import { avatar } from '../core/avatar.js';

/** "just now", "3 hours ago", "2 days ago" — a wall is read by recency, not date. */
function ago(at, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default async function wallScreen(ctx) {
  const el = h('div', { style: 'display:contents' });
  const listHolder = h('div', { style: 'display:contents' });
  const name = firstName();

  // ── Share one ───────────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What would you like the church to pray about?', 'aria-label': 'A prayer request to share', maxlength: '500' });
  input.value = ctx.route.params.share || '';
  const compose = h('div', { style: 'display:contents' });

  const safety = () => swap(compose, poster({ tone: 'ink', tall: true },
    label('Not shared'),
    h('div', {},
      display(SAFETY_CARD.title),
      ...SAFETY_CARD.body.map((text) => h('p', { class: 'body dim', style: 'margin-top:1rem', text })),
      h('div', { style: 'margin-top:1.6rem;display:flex;flex-direction:column;gap:.6rem' },
        ...SAFETY_CARD.lines.map((line) => h('p', { class: 'body' },
          h('strong', { text: line.name }), ' — ',
          line.number
            ? h('a', { href: `tel:${line.number.replace(/\s+/g, '')}`, style: 'color:inherit' }, line.number)
            : h('span', { text: line.detail || '' }))))),
    h('div', { class: 'poster-foot' },
      go('Back to Pray', () => ctx.go('pray')),
      art('heart', { tone: 'ink', size: 'sm' }))));

  const composer = () => swap(compose, poster({ tone: 'paper' },
    label('Share a request'),
    h('div', {}, input),
    note(`Signed “${name}”, with your picture from You. Anyone who opens this app can read it. It comes down by itself after 30 days, or whenever you take it down.`),
    h('div', { class: 'poster-foot', style: 'margin-top:1rem' },
      pill('Share with the church', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const result = await wall.share(input.value);
        button.disabled = false;
        if (result.concerning) { safety(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (!result.ok) { toast(result.message); return; }
        input.value = '';
        toast('Shared. The church can pray with you now.');
        load();
      }),
      art('flame', { tone: 'paper', size: 'sm' }))));
  composer();

  // ── The wall ────────────────────────────────────────────────────────────
  const card = (one) => {
    const holder = h('div', {});
    let answering = false;
    const noteInput = h('textarea', { placeholder: 'What happened? (optional)', 'aria-label': 'How it was answered', maxlength: String(wall.NOTE_MAX), rows: '2' });

    const reactions = () => h('div', { class: 'reactions' },
      ...wall.REACTIONS.filter((r) => !r.answeredOnly || one.answered).map((r) => {
        const mine = one.yourReactions.includes(r.kind);
        const count = one.reactions[r.kind] || 0;
        return h('button', {
          class: 'reaction', type: 'button', 'aria-pressed': String(mine),
          'aria-label': `${r.label}${count ? `, ${count}` : ''}`,
          onclick: async () => {
            const result = await wall.react(one.id, r.kind);
            if (!result.ok) { toast(result.message || 'Could not reach the church.'); return; }
            one.reactions[r.kind] = result.data.count;
            one.yourReactions = result.data.yours
              ? [...new Set([...one.yourReactions, r.kind])] : one.yourReactions.filter((k) => k !== r.kind);
            paint();
          },
        }, `${r.emoji} ${r.label}${count ? ` · ${count}` : ''}`);
      }));

    const actions = () => {
      if (one.yours) {
        if (answering) {
          return h('div', { style: 'margin-top:.8rem' }, noteInput,
            h('div', { class: 'row-actions' },
              pill('Mark answered', async () => {
                const result = await wall.answer(one.id, noteInput.value);
                if (result.concerning) { safety(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
                if (!result.ok) { toast(result.message || 'Could not reach the church.'); return; }
                one.answered = result.data.answered;
                answering = false;
                toast('Marked answered. Thank God with them.');
                paint();
              }),
              pill('Cancel', () => { answering = false; paint(); }, { quiet: true })));
        }
        return h('div', { class: 'row-actions' },
          one.answered
            ? pill('Not answered after all', async () => {
              const result = await wall.answer(one.id, '', { answered: false });
              if (!result.ok) { toast(result.message || 'Could not reach the church.'); return; }
              one.answered = null;
              one.reactions.praise = 0;
              paint();
            }, { quiet: true })
            : pill('It was answered', () => { answering = true; paint(); noteInput.focus(); }),
          pill('Take it down', async () => {
            const result = await wall.remove(one.id);
            if (!result.ok) { toast(result.message || 'Could not take it down.'); return; }
            toast('Taken down.');
            load();
          }, { quiet: true }));
      }
      return h('div', { class: 'row-actions' },
        wall.reported().includes(one.id)
          ? h('span', { class: 'row-meta', text: 'Reported' })
          : pill('Report', async () => {
            const result = await wall.report(one.id);
            toast(result.ok ? 'Reported. Enough reports and it comes down.' : (result.message || 'Could not report it.'));
            paint();
          }, { quiet: true }));
    };

    const paint = () => swap(holder, h('div', { class: 'wall-item' },
      avatar(one.avatar, { seed: `${one.firstName}${one.id}`, label: one.firstName }),
      h('div', {},
        h('p', { class: 'row-title', text: one.text }),
        h('p', { class: 'row-note', text: `— ${one.firstName}${one.yours ? ' (you)' : ''} · ${ago(one.at)}${one.answered ? ' · answered 🙌' : ''}` }),
        one.answered
          ? h('p', { class: 'answered-note', text: one.answered.note ? `Answered: ${one.answered.note}` : 'Answered.' })
          : null,
        reactions(),
        actions())));
    paint();
    return holder;
  };

  const load = async () => {
    swap(listHolder, poster({ tone: 'paper' }, waiting()));
    const prayers = await wall.list();
    if (!Array.isArray(prayers)) {
      swap(listHolder, poster({ tone: 'paper' },
        label('The wall'),
        h('p', { class: 'body', text: prayers.error }),
        h('div', { class: 'poster-foot', style: 'margin-top:1rem' }, pill('Try again', load, { quiet: true }))));
      return;
    }
    swap(listHolder, poster({ tone: 'sky' },
      label(prayers.length ? `The wall · ${prayers.length}` : 'The wall'),
      prayers.length
        ? rows(...prayers.map(card))
        : h('p', { class: 'body', text: 'Nothing shared yet. The first request is the hardest one to post.' })));
  };

  swap(el,
    poster({ tone: 'captain', tall: true },
      label('Pray with the church'),
      h('div', {}, display('THE PRAYER WALL.'),
        h('p', { class: 'lead dim', style: 'margin-top:1.2rem', text: 'Requests the people of this church have chosen to share. Tap a reaction when you have prayed for one — it is for the person who asked. When a prayer is answered, the one who shared it can say so here.' })),
      h('div', { class: 'poster-foot' }, h('span'), art('heart', { tone: 'captain', size: 'sm' }))),
    compose,
    listHolder);
  setTimeout(load, 0);
  return { title: 'Prayer wall', el };
}
