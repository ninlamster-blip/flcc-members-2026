/**
 * Network overview — for a lead pastor who oversees every church in the
 * network, not just one. Read-only: it aggregates each church's ordinary,
 * unencrypted operational records (members, ministries, attendance, care)
 * the same way any locked-out session would, and it never touches finance,
 * counselling, the leadership journal or the document vault — those stay
 * exactly as private, per church, as they are for anyone else. See
 * `core/network.js` for the honest explanation of how that holds.
 *
 * It can only ever list churches already present on this device: there is
 * no server, so a church nobody has signed into here does not appear.
 */

import { h, icon } from '../core/dom.js';
import { page, card, table, emptyState, badge, statCard } from '../core/ui.js';
import { networkOverview } from '../core/network.js';
import { healthTone } from './_shared.js';

export async function render(ctx) {
  const { app } = ctx;
  const tenants = app.registry.list();
  const rows = await networkOverview(app.storage, tenants, {
    now: new Date(),
    openDbs: new Map([[ctx.tenant.id, ctx.db]]),
  });

  const totalMembers = rows.reduce((sum, r) => sum + r.memberCount, 0);
  const needsAttention = rows.filter((r) => r.healthStatus === 'critical' || r.healthStatus === 'needs-attention').length;

  return page({
    title: 'Network Overview',
    subtitle: 'Every church on this device — a rollup, not a merge. Finance, counselling, the journal and documents stay locked per church.',
    children: [
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        statCard({ value: rows.length, label: 'Churches on this device' }),
        statCard({ value: totalMembers, label: 'Members, network-wide' }),
        statCard({ value: needsAttention, label: 'Need attention' }),
        statCard({ value: rows.filter((r) => r.unlocked).length, label: 'Signed in right now' })),

      rows.length
        ? card({
          title: 'Every church',
          children: [table({
            columns: [
              { label: 'Church', value: (r) => r.name },
              { label: 'Members', numeric: true, value: (r) => r.memberCount },
              { label: 'Ministries', numeric: true, value: (r) => r.ministryCount },
              { label: 'Open care items', numeric: true, value: (r) => r.openCareCount },
              { label: 'Health', value: (r) => badge(`${r.healthScore}% ${r.healthStatusLabel}`, healthTone(r.healthScore)) },
              {
                label: '',
                render: (r) => (r.unlocked
                  ? h('span.tiny.subtle', 'Signed in')
                  : h('button.btn.btn--sm', {
                    onClick: () => app.handleSignOut('switch', r.tenantId),
                  }, icon('church', { size: 14 }), 'Open')),
              },
            ],
            rows,
          })],
        })
        : emptyState({
          title: 'No other churches on this device yet',
          detail: 'Sign into each church at least once from this browser — the network overview only ever aggregates what is already here. There is no server, so a church nobody has visited from this device cannot appear.',
          iconName: 'church',
        }),

      card({
        title: 'What this does not show',
        children: [h('p.small.muted',
          'Finance, counselling notes, the leadership journal and the document vault stay encrypted and locked per church — this view opens every other church exactly the way a signed-out session would, and reads only what that can read. Open a church to see its full detail.')],
      }),
    ],
  });
}
