// RESOURCES — free material from Cru, to add to "My resources".
//
// Each entry is a title, a line written here, and a link to cru.org: nothing
// of Cru's is copied into this app. "Add" keeps it on this phone's own list,
// which lives on Grow; "Open" goes to Cru's page, where their own download
// buttons are.

import { h, poster, label, display, pill, note, rows, rise, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as resources from '../core/resources.js';

const KIND = { page: 'Open on cru.org', pdf: 'Download the PDF', video: 'Watch on cru.org' };

export default async function resourcesScreen(ctx) {
  const bank = await content.resources();
  const parts = [];

  parts.push(poster({ tone: 'captain', tall: true },
    label(`From ${bank.source.name}`),
    h('div', {},
      display('FREE MATERIAL TO GROW WITH.'),
      h('p', { class: 'lead dim', style: 'margin-top:1rem', text: 'Studies, guides and booklets that Cru gives away. Add the ones you want to My resources on Grow — then open or download them from Cru whenever you are ready.' })),
    h('div', { class: 'poster-foot' },
      pill('See My resources', () => ctx.go('grow'), { quiet: true }),
      h('span'))));

  const item = (one) => {
    const holder = h('div', {});
    const paint = () => swap(holder,
      h('p', { class: 'row-title', text: one.title }),
      h('p', { class: 'row-note', text: one.summary }),
      h('div', { class: 'row-actions' },
        resources.isSaved(one.id)
          ? pill('Added ✓', () => { resources.remove(one.id); toast('Taken off My resources.'); paint(); }, { quiet: true, 'aria-pressed': 'true' })
          : pill('Add to My resources', () => { resources.add(one.id); toast('Added. It is on Grow, under My resources.'); paint(); }),
        pill(KIND[one.kind] || KIND.page, () => resources.open(one.url), { quiet: true })));
    paint();
    return holder;
  };

  for (const group of bank.groups) {
    parts.push(poster({ tone: group.tone === 'captain' ? 'paper' : group.tone },
      label(group.title),
      rows(...group.items.map(item))));
  }

  parts.push(poster({ tone: 'paper' },
    label('Whose this is'),
    note(`Everything here is ${bank.source.name}'s, and opens on cru.org — this app keeps only which ones you added. The short descriptions are ours.`)));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Resources', el };
}
