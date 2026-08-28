// Sharing a prayer.
//
// FLCC NEXT has no server, so a prayer written here goes nowhere by itself:
// it is saved on this phone and nothing is transmitted. This screen used to
// say "Sent to a ministry leader", which was false and is the worst kind of
// false — a young person could write something serious believing an adult
// would read it, and no adult ever would.
//
// So the screen now says what actually happens, and gives the one route that
// really works without a server: the child sends it themselves, through the
// phone's own share sheet, to a leader they choose.

import { h, poster, label, display, art, pill, choice, note, toast, moment } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import { isKids, getUser, mode } from '../core/profile.js';
import * as delivery from '../core/delivery.js';
import { isConcerning } from '../core/safety.js';

const MOODS = [
  ['thankful', 'THANKFUL'], ['worried', 'WORRIED'], ['sad', 'SAD'],
  ['scared', 'SCARED'], ['angry', 'ANGRY'], ['stuck', 'STUCK'],
];

/**
 * The only delivery this app can honestly offer: the young person sends it
 * themselves. The share sheet hands it to whatever they already use to talk to
 * a leader; where that is unavailable the text goes to the clipboard so they
 * can paste it. Either way the words leave the phone only because they chose
 * to send them.
 */
export async function sendToLeader(prayer) {
  const body = `${prayer.content}\n\n— shared from FLCC NEXT`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'A prayer request', text: body });
      return 'shared';
    }
  } catch {
    return 'cancelled';               // the child backed out; that is their call
  }
  try {
    await navigator.clipboard.writeText(body);
    return 'copied';
  } catch {
    return 'manual';
  }
}

export default async function prayerScreen(ctx) {
  let mood = null;
  const text = h('textarea', { placeholder: isKids() ? 'God, I want to talk to you about…' : 'Say it however it comes out.', 'aria-label': 'Your prayer' });
  const visibility = { value: 'leader' };

  const moodRow = h('div', { class: 'pill-row' }, ...MOODS.map(([id, text_]) => {
    const button = pill(text_, () => {
      mood = id;
      [...moodRow.children].forEach((child) => child.removeAttribute('data-quiet'));
      [...moodRow.children].forEach((child) => { if (child !== button) child.setAttribute('data-quiet', ''); });
    }, { quiet: true });
    return button;
  }));

  const choices = h('div', { class: 'choice-list', style: 'margin-top:1rem' },
    ...[['leader', 'I WANT TO SHOW A LEADER'], ['private', 'ONLY ME AND GOD']].map(([id, text_]) => {
      const button = choice(text_, () => {
        visibility.value = id;
        [...choices.children].forEach((child) => child.removeAttribute('data-chosen'));
        button.dataset.chosen = '';
      });
      if (id === 'leader') button.dataset.chosen = '';
      return button;
    }));

  // What this screen promises depends on whether the church has delivery
  // switched on, so it asks first and says the weaker thing until it knows.
  let canDeliver = false;
  const note_ = h('p', { class: 'body dim', style: 'margin-top:1rem',
    text: 'This is saved on your phone. Nothing is sent anywhere on its own. There is no public prayer feed, and nothing you write is shown to other young people.' });
  delivery.available().then((yes) => {
    canDeliver = yes;
    note_.textContent = yes
      ? 'Choosing a leader sends this to your ministry leaders, and only to them. There is no public prayer feed — nothing you write is shown to other young people. “Only me and God” never leaves this phone.'
      : 'This is saved on your phone. Nothing is sent anywhere on its own. There is no public prayer feed, and nothing you write is shown to other young people. If you want a leader to see it, send it to them yourself after you save, or show them your phone.';
  });

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'pink', tall: true, className: 'full' },
      label('Share a prayer'),
      h('div', {},
        display('WHAT’S GOING ON?'),
        h('div', { style: 'margin-top:1.3rem' }, moodRow),
        h('div', { style: 'margin-top:1.3rem' }, text)),
      h('div', { class: 'poster-foot' }, h('span'), art('hands', { tone: 'pink', size: 'sm' }))),

    poster({ tone: 'paper', className: 'full' },
      label('Who sees this'),
      choices,
      note_,
      h('div', { class: 'poster-foot' },
        pill('Save it', async (event) => {
          const body = text.value.trim();
          if (!body) { toast('Write something first.'); return; }

          const state = store.read(store.KEYS.prayers, { items: [] }) || { items: [] };
          const record = {
            id: `p${Date.now().toString(36)}`,
            date: new Date().toISOString(),
            mood,
            content: body,
            visibility: visibility.value,
            moderation_status: visibility.value === 'leader' ? 'pending' : 'private',
            delivered: false,
          };
          state.items.unshift(record);
          store.write(store.KEYS.prayers, state);
          progress.complete('prayer', `${Date.now()}`);

          if (visibility.value !== 'leader') {
            toast('Kept between you and God, on this phone.');
            ctx.go('connect');
            return;
          }

          // Saved first, sent second. If the send fails the words are already
          // safe on the phone, and the young person is told plainly that it
          // did not go — never the reverse.
          const button = event && event.currentTarget;
          if (button) { button.disabled = true; button.textContent = 'Sending…'; }
          const sent = canDeliver
            ? await delivery.send({
              content: body,
              mood,
              firstName: (getUser() || {}).name,
              ageGroup: mode(),
              urgent: isConcerning(body),
            })
            : { delivered: false, reason: 'off' };
          if (button) { button.disabled = false; button.textContent = 'Save it'; }

          if (sent.delivered) {
            record.delivered = true;
            record.remoteId = sent.id;
            record.deliveredAt = new Date().toISOString();
            store.write(store.KEYS.prayers, state);
            moment({
              tone: 'sage',
              eyebrow: 'Sent',
              big: 'YOUR LEADERS HAVE IT.',
              line: 'A ministry leader will read this. If it is urgent, please also tell an adult you trust today — an app is not a person.',
              action: 'Done',
              onclose: () => ctx.go('connect'),
            });
            return;
          }

          moment({
            tone: 'pink',
            eyebrow: 'Saved on this phone',
            big: sent.reason === 'off' ? 'WANT A LEADER TO SEE IT?' : 'IT DID NOT SEND.',
            line: sent.reason === 'off'
              ? 'Nothing is sent on its own. Send it yourself, or show them your phone when you next see them.'
              : 'Your words are safe on this phone, but they have not reached anyone. Send it yourself, or try again from Connect.',
            action: 'Send it to a leader',
            onclose: async () => {
              const how = await sendToLeader(record);
              if (how === 'copied') toast('Copied — paste it to your leader.');
              else if (how === 'manual') toast('Show them your phone, or copy it from Connect.');
              ctx.go('connect');
            },
          });
        }))),

    poster({ tone: 'paper', className: 'full' },
      label('If it is serious'),
      h('p', { class: 'body', text: 'If someone is hurting you, or you are thinking about hurting yourself, please tell a parent, a guardian or a ministry leader today. This app is not a person, and some things need one.' })),
  );

  return { title: 'Prayer', el };
}
