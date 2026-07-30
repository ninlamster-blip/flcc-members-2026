/**
 * Settings — the church, its people's access, security, AI, data and audit.
 *
 * The security tab is written to be read by someone who is not a security
 * engineer: it says what is protected, what is not, and what they personally
 * need to do about it (turn on two-factor, take a backup, review devices).
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, list, listItem, segmented, statCard, badge, avatar, toast, modal,
  formModal, field, input, select, checkbox, confirm, emptyState, searchField,
} from '../core/ui.js';
import { formatDate, formatDateTime, relativeTime, isoDate } from '../core/format.js';
import { ROLES, ROLE_IDS, RESOURCES, ACTIONS, can, roleLabel, assignableRoles, effectivePermissions } from '../core/rbac.js';
import { COUNTRIES } from '../core/tenant.js';
import { generateTotpSecret, totpUri, verifyTotp } from '../core/crypto.js';
import { downloadJSON } from '../core/exporters.js';
import { seedTenant, clearSeedData } from '../core/seed.js';
import { blank } from '../core/schema.js';
import { parseMembersCSV, parseScheduleCSV, matchMemberByName, normalizeName } from '../core/importers.js';
import { sentence, deleteRecord, refOptions } from './_shared.js';

export async function render(ctx, route) {
  const tab = route.query.tab || 'church';
  const tabs = [
    { value: 'church', label: 'Church' },
    ...(ctx.can('users:read') ? [{ value: 'users', label: 'Users & roles' }] : []),
    { value: 'security', label: 'Security' },
    ...(ctx.can('assistant:read') ? [{ value: 'ai', label: 'AI' }] : []),
    ...(ctx.can('settings:write') ? [{ value: 'data', label: 'Data' }] : []),
    ...(ctx.can('audit:read') ? [{ value: 'audit', label: 'Audit log' }] : []),
  ];

  const body = h('div');
  body.appendChild(
    tab === 'users' ? usersTab(ctx)
      : tab === 'security' ? securityTab(ctx)
      : tab === 'ai' ? aiTab(ctx)
      : tab === 'data' ? dataTab(ctx)
      : tab === 'audit' ? auditTab(ctx)
      : churchTab(ctx),
  );

  return page({
    title: 'Settings',
    subtitle: ctx.tenant.name,
    children: [
      h('div', { style: { marginBottom: '18px', overflowX: 'auto', paddingBottom: '4px' } },
        segmented({ options: tabs, value: tab, onChange: (value) => ctx.navigate(`/settings?tab=${value}`) })),
      body,
    ],
  });
}

/* ── church ──────────────────────────────────────────────────────────────── */

function churchTab(ctx) {
  const tenant = ctx.tenant;
  const editable = ctx.can('settings:write');

  const nameInput = input({ value: tenant.name, disabled: !editable });
  const shortInput = input({ value: tenant.shortName, disabled: !editable });
  const cityInput = input({ value: tenant.city || '', disabled: !editable });
  const countrySelect = select({ options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })), value: tenant.country, disabled: !editable });
  const currencyInput = input({ value: tenant.settings.currency, disabled: !editable });
  const servicesInput = input({ value: (tenant.settings.services || []).join(', '), disabled: !editable });
  const followUpInput = input({ type: 'number', min: 1, max: 12, value: tenant.settings.followUpAfterWeeks || 3, disabled: !editable });
  const thresholdInput = input({ type: 'number', min: 0, step: '0.001', value: tenant.settings.approvalThreshold ?? 100, disabled: !editable });

  return h('div.stack',
    card({
      title: 'This church',
      subtitle: `Created ${formatDate(tenant.createdAt)} · id "${tenant.id}"`,
      children: [
        h('div.form-grid',
          field({ label: 'Name', control: nameInput, full: true }),
          field({ label: 'Short name', control: shortInput }),
          field({ label: 'City', control: cityInput }),
          field({ label: 'Country', control: countrySelect }),
          field({ label: 'Currency', control: currencyInput, help: 'Kuwait uses KWD, with three decimal places.' }),
          field({ label: 'Services', control: servicesInput, full: true, help: 'Comma separated. These are the options when recording attendance.' }),
          field({ label: 'Follow up after (weeks)', control: followUpInput, help: 'How long before an absence becomes a care flag.' }),
          field({ label: 'Approval threshold', control: thresholdInput, help: 'Expenses above this need a second person to approve.' })),
        editable ? h('div.row', { style: { marginTop: '16px' } },
          h('button.btn.btn--primary', {
            onClick: async () => {
              await ctx.app.registry.update(tenant.id, {
                name: nameInput.value,
                shortName: shortInput.value,
                city: cityInput.value,
                country: countrySelect.value,
                settings: {
                  ...tenant.settings,
                  currency: currencyInput.value,
                  services: servicesInput.value.split(',').map((s) => s.trim()).filter(Boolean),
                  followUpAfterWeeks: Number(followUpInput.value) || 3,
                  approvalThreshold: Number(thresholdInput.value) || 0,
                },
              });
              ctx.db.log('settings.church', 'Church settings updated.');
              await ctx.db.flush();
              toast('Saved. Reload to see the new name everywhere.', { variant: 'ok' });
              ctx.refresh();
            },
          }, 'Save changes')) : h('p.small.muted', 'Your role can view these but not change them.'),
      ],
    }),
    card({
      title: 'Branding',
      children: [
        h('div.row',
          h('span', {
            style: {
              width: '46px', height: '46px', borderRadius: '14px', background: tenant.accent,
              color: 'white', display: 'grid', placeItems: 'center',
            },
          }, icon('church', { size: 22 })),
          h('div', null,
            h('p.small', 'Accent colour'),
            h('p.tiny.subtle', tenant.accent))),
        editable ? h('div.row', { style: { marginTop: '12px', flexWrap: 'wrap' } },
          ...['#2F6F5E', '#1D4ED8', '#7C3AED', '#B45309', '#A33B2A', '#0F766E', '#BE185D', '#4338CA'].map((colour) =>
            h('button', {
              'aria-label': `Use ${colour}`,
              style: {
                width: '32px', height: '32px', borderRadius: '10px', background: colour,
                border: colour === tenant.accent ? '2px solid var(--ink)' : '1px solid var(--border)', cursor: 'pointer',
              },
              onClick: async () => {
                await ctx.app.registry.update(tenant.id, { accent: colour });
                toast('Colour updated. Reload to see it in the sidebar.');
                ctx.refresh();
              },
            }))) : null,
      ],
    }),
    card({
      title: 'Compliance and local law',
      children: [
        h('p.small.muted',
          'Shepherd keeps your records, versions and audit trail so you can answer questions about them. '
          + 'It does not give legal advice, and what a church must file, retain or register differs across Kuwait, '
          + 'Bahrain, Qatar, the UAE, Oman and Saudi Arabia.'),
        h('p.small.muted', { style: { marginTop: '8px' } },
          'Verify your own obligations — registration, employment, data protection, financial reporting — with the '
          + 'relevant authorities or a local adviser. Where this app suggests a retention period or a document type, '
          + 'treat it as a prompt to check, not as advice.'),
      ],
    }));
}

/* ── users ───────────────────────────────────────────────────────────────── */

function usersTab(ctx) {
  const { db } = ctx;
  const users = db.all('users');

  return h('div.stack',
    card({
      title: 'Who has access',
      subtitle: `${users.length} accounts`,
      actions: [ctx.can('users:write')
        ? h('button.btn.btn--sm.btn--primary', { onClick: () => addUser(ctx) }, icon('plus', { size: 14 }), 'Add user')
        : null].filter(Boolean),
      children: [table({
        columns: [
          {
            label: 'Name',
            render: (user) => h('div.row', avatar(user.name, { size: 'sm' }),
              h('div', null,
                h('div', { style: { fontWeight: '500' } }, user.name),
                h('div.tiny.subtle', user.email))),
          },
          { label: 'Role', render: (user) => badge(roleLabel(user.role), 'accent') },
          { label: 'Two-factor', render: (user) => (user.totp && user.totp.enabled ? badge('On', 'ok') : badge('Off', 'warn')) },
          { label: 'Last sign-in', value: (user) => (user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'never') },
          { label: 'Devices', numeric: true, value: (user) => (user.devices || []).length },
          { label: '', render: (user) => (user.suspended ? badge('Suspended', 'danger') : null) },
        ],
        rows: users,
        onRowClick: ctx.can('users:write') ? (user) => editUser(ctx, user) : undefined,
      })],
    }),
    card({
      title: 'What each role can do',
      subtitle: 'Roles are fixed; individual permissions can be added or removed per user.',
      children: [h('div.stack.stack--sm', ...ROLE_IDS.map((id) => {
        const role = ROLES[id];
        const count = db.where('users', (u) => u.role === id).length;
        return h('details', { style: { border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 14px' } },
          h('summary', { style: { cursor: 'pointer' } },
            h('strong.small', role.label),
            h('span.tiny.subtle', ` — ${count} ${count === 1 ? 'person' : 'people'}`)),
          h('p.small.muted', { style: { marginTop: '8px' } }, role.description),
          h('div.chip-list', { style: { marginTop: '8px' } },
            ...Object.keys(RESOURCES)
              .filter((resource) => can({ role: id }, `${resource}:read`))
              .map((resource) => h('span.chip', {
                title: ACTIONS.filter((a) => can({ role: id }, `${resource}:${a}`)).join(', '),
              }, RESOURCES[resource]))));
      }))],
    }));
}

function addUser(ctx) {
  const nameInput = input({ required: true });
  const emailInput = input({ type: 'email', required: true });
  const roleSelect = select({
    options: assignableRoles(ctx.user).map((id) => ({ value: id, label: ROLES[id].label })),
    value: 'volunteer',
  });
  const passInput = input({ type: 'password', required: true, autocomplete: 'new-password' });
  const memberSelect = select({ options: refOptions(ctx.db, 'members', { emptyLabel: 'Not linked yet' }), value: '' });

  formModal({
    title: 'Add a user',
    submitLabel: 'Create account',
    fields: [
      h('p.small.muted',
        'You are giving this person a key to the church\'s encrypted records. '
        + 'Set a passphrase with them present, and have them change it afterwards from their own account.'),
      h('div.form-grid',
        field({ label: 'Full name', control: nameInput, full: true }),
        field({ label: 'Email', control: emailInput }),
        field({ label: 'Role', control: roleSelect }),
        field({ label: 'Initial passphrase', control: passInput, help: 'At least 10 characters.' }),
        field({
          label: 'Linked member profile', control: memberSelect, full: true,
          help: 'Ties this account to a person record — needed for their personalised leadership dashboard, ministry workspace access and task list.',
        })),
    ],
    onSubmit: async () => {
      const created = await ctx.session.createUser({
        db: ctx.db,
        actorVaultKey: ctx.session.vaultKey,
        name: nameInput.value,
        email: emailInput.value,
        role: roleSelect.value,
        passphrase: passInput.value,
        memberId: memberSelect.value || null,
      });
      toast(`${nameInput.value} can now sign in.`, { variant: 'ok' });
      ctx.refresh();
      return created;
    },
  });
}

function editUser(ctx, user) {
  const roleSelect = select({
    options: assignableRoles(ctx.user).map((id) => ({ value: id, label: ROLES[id].label })),
    value: user.role,
  });
  let suspended = !!user.suspended;
  const suspendBox = checkbox({ label: 'Suspend this account', checked: suspended, onChange: (value) => { suspended = value; } });
  const memberSelect = select({ options: refOptions(ctx.db, 'members', { emptyLabel: 'Not linked' }), value: user.memberId || '' });

  const grants = new Set(user.grants || []);
  const grantOptions = ['counseling:read', 'counseling:write', 'finance:read', 'finance:approve', 'documents:write', 'audit:read'];
  const grantBoxes = grantOptions.map((permission) => checkbox({
    label: permission.replace(':', ' — '),
    checked: grants.has(permission),
    onChange: (on) => (on ? grants.add(permission) : grants.delete(permission)),
  }));

  formModal({
    title: user.name,
    submitLabel: 'Save',
    fields: [
      h('p.small.muted', `${user.email} · last signed in ${user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'never'}`),
      field({ label: 'Role', control: roleSelect }),
      field({
        label: 'Linked member profile', control: memberSelect,
        help: 'Needed to match this leader to a ministry, a rota assignment, and their own task list.',
      }),
      h('div.field',
        h('label.field__label', 'Extra permissions'),
        h('p.tiny.subtle', 'Granted on top of the role. Use sparingly — the role is the thing people understand.'),
        ...grantBoxes),
      h('div.field', suspendBox),
      (user.devices || []).length ? h('div.field',
        h('label.field__label', 'Devices'),
        ...user.devices.map((device) => h('p.tiny.subtle', `${device.label} · last seen ${relativeTime(device.lastSeenAt)}`))) : null,
    ],
    onSubmit: async () => {
      ctx.db.update('users', user.id, {
        role: roleSelect.value, suspended, grants: [...grants], memberId: memberSelect.value || null,
      });
      ctx.db.log('users.update', `${user.name}: role ${roleSelect.value}${suspended ? ', suspended' : ''}.`);
      await ctx.db.flush();
      toast('Saved.', { variant: 'ok' });
      ctx.refresh();
    },
  });
}

/* ── security ────────────────────────────────────────────────────────────── */

function securityTab(ctx) {
  const user = ctx.db.find('users', ctx.user.id) || ctx.user;
  const twoFactorOn = !!(user.totp && user.totp.enabled);

  return h('div.stack',
    card({
      title: 'Your account',
      children: [
        h('div.row.row--between',
          h('div', null,
            h('strong.small', 'Two-factor authentication'),
            h('p.small.muted', twoFactorOn
              ? 'On. A code from your authenticator app is required at every sign-in.'
              : 'Off. Anyone who learns your passphrase can open this church\'s records.')),
          twoFactorOn
            ? h('button.btn.btn--sm', { onClick: () => disableTotp(ctx, user) }, 'Turn off')
            : h('button.btn.btn--sm.btn--primary', { onClick: () => enableTotp(ctx, user) }, 'Turn on')),
        h('hr.divider'),
        h('div.row.row--between',
          h('div', null,
            h('strong.small', 'Passphrase'),
            h('p.small.muted', 'Changing it re-wraps your key, so you keep access to everything already encrypted.')),
          h('button.btn.btn--sm', { onClick: () => changePassphrase(ctx, user) }, 'Change')),
        h('hr.divider'),
        h('div', null,
          h('strong.small', 'Devices'),
          (user.devices || []).length
            ? list((user.devices || []).map((device) => listItem({
              leading: icon('lock', { size: 16 }),
              title: device.label,
              meta: `First seen ${formatDate(device.firstSeenAt)} · last ${relativeTime(device.lastSeenAt)} · ${device.count || 1} sign-ins`,
            })))
            : h('p.small.muted', 'No devices recorded yet.')),
      ],
    }),
    card({
      title: 'How this church\'s data is protected',
      children: [h('div.stack.stack--sm',
        securityRow('Encrypted at rest', 'Counselling notes, finance, budgets, projects and the document vault are encrypted with AES-GCM before they are written. The key is random per church, wrapped with each user\'s passphrase.', true),
        securityRow('Separated per church', 'Every church has its own storage namespace. A session for one church cannot read another, and an import from another church is refused.', true),
        securityRow('Audit trail', `Every create, update, delete, sign-in and export is recorded. ${ctx.db.all('audit').length} entries so far.`, true),
        securityRow('Two-factor', twoFactorOn ? 'On for your account.' : 'Not on for your account.', twoFactorOn),
        securityRow('Idle lock', 'Signing out happens automatically after 45 minutes of inactivity, and when the browser tab is closed.', true),
        securityRow('Backups', 'Not automatic. This is on you: take an export from the Data tab and keep it somewhere safe.', false),
      )],
    }),
    card({
      title: 'What this does not protect against',
      children: [h('ul.small.muted', { style: { paddingLeft: '18px', display: 'grid', gap: '6px' } },
        h('li', 'A lost passphrase. Nobody — including us — can recover the encrypted records without it. Write it down and keep it somewhere physically safe.'),
        h('li', 'Malicious software already running on this device.'),
        h('li', 'Someone with your unlocked device and an open session.'),
        h('li', 'Data you export. Once a CSV leaves the app it is an ordinary file on an ordinary device.'))],
    }));
}

function securityRow(title, detail, ok) {
  return h('div.row', { style: { alignItems: 'flex-start', gap: '10px' } },
    h('span', { class: `dot ${ok ? 'dot--ok' : 'dot--warn'}`, style: { marginTop: '7px' } }),
    h('div', null,
      h('strong.small', title),
      h('p.small.muted', detail)));
}

async function enableTotp(ctx, user) {
  const secret = generateTotpSecret();
  const uri = totpUri(secret, user.email, `Shepherd — ${ctx.tenant.shortName}`);
  const codeInput = input({ inputmode: 'numeric', maxlength: 6, placeholder: '000000' });

  formModal({
    title: 'Turn on two-factor',
    submitLabel: 'Verify and turn on',
    fields: [
      h('p.small.muted', 'Add this secret to an authenticator app (Google Authenticator, 1Password, Aegis), then enter the code it shows.'),
      h('div.panel',
        h('p.eyebrow', 'Secret'),
        h('code.mono', { style: { fontSize: '1rem', letterSpacing: '.08em', wordBreak: 'break-all' } }, secret)),
      h('details', h('summary.small', 'Or copy the setup link'),
        h('code.tiny.mono', { style: { wordBreak: 'break-all' } }, uri)),
      field({ label: 'Code from the app', control: codeInput }),
    ],
    onSubmit: async () => {
      const codes = await ctx.session.enableTotp({ db: ctx.db, userId: user.id, secret, code: codeInput.value });
      showRecoveryCodes(codes);
      ctx.refresh();
    },
  });
}

function showRecoveryCodes(codes) {
  modal({
    title: 'Save these recovery codes',
    body: h('div.stack',
      h('p.small.muted', 'Each works once, if you lose your authenticator. They are shown now and never again — Shepherd only keeps their hashes.'),
      h('div.panel.mono', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
        ...codes.map((code) => h('span', code))),
      h('button.btn', {
        onClick: async () => {
          try { await navigator.clipboard.writeText(codes.join('\n')); toast('Copied.', { variant: 'ok' }); }
          catch { toast('Select them and copy.'); }
        },
      }, 'Copy all')),
  });
}

function disableTotp(ctx, user) {
  const passInput = input({ type: 'password', required: true });
  formModal({
    title: 'Turn off two-factor',
    submitLabel: 'Turn off',
    danger: true,
    fields: [
      h('p.small.muted', 'Confirm your passphrase.'),
      field({ label: 'Passphrase', control: passInput }),
    ],
    onSubmit: async () => {
      await ctx.session.disableTotp({ db: ctx.db, userId: user.id, passphrase: passInput.value });
      toast('Two-factor is off.');
      ctx.refresh();
    },
  });
}

function changePassphrase(ctx, user) {
  const currentInput = input({ type: 'password', required: true, autocomplete: 'current-password' });
  const nextInput = input({ type: 'password', required: true, autocomplete: 'new-password' });
  const confirmInput = input({ type: 'password', required: true, autocomplete: 'new-password' });

  formModal({
    title: 'Change your passphrase',
    submitLabel: 'Change it',
    fields: [
      field({ label: 'Current passphrase', control: currentInput }),
      field({ label: 'New passphrase', control: nextInput, help: 'At least 10 characters. Longer beats complicated.' }),
      field({ label: 'Confirm', control: confirmInput }),
    ],
    onSubmit: async () => {
      if (nextInput.value !== confirmInput.value) throw new Error('The two new passphrases do not match.');
      await ctx.session.changePassphrase({
        db: ctx.db, userId: user.id,
        currentPassphrase: currentInput.value,
        newPassphrase: nextInput.value,
      });
      toast('Changed. Use the new one next time you sign in.', { variant: 'ok' });
    },
  });
}

/* ── AI ──────────────────────────────────────────────────────────────────── */

function aiTab(ctx) {
  const config = ctx.assistant.config;
  const endpointInput = input({ value: config.endpoint, placeholder: 'https://your-worker.example.workers.dev' });
  const secretInput = input({ type: 'password', value: config.secret, placeholder: 'Shared secret, if your endpoint needs one' });
  const modelInput = input({ value: config.model });
  let enabled = config.enabled;
  const enabledBox = checkbox({ label: 'Allow AI features in this church', checked: enabled, onChange: (value) => { enabled = value; } });

  return h('div.stack',
    card({
      title: 'AI service',
      subtitle: ctx.assistant.remoteAvailable ? 'Connected' : 'Not connected — everything falls back to on-device drafting.',
      children: [
        h('p.small.muted',
          'Shepherd computes its insights on this device and never sends your records anywhere for that. '
          + 'Drafting (sermon assets, summaries, announcements, translations) can optionally use a language model, '
          + 'through an endpoint you control.'),
        h('div.form-grid', { style: { marginTop: '14px' } },
          field({ label: 'Endpoint', control: endpointInput, full: true, help: 'A URL that accepts POST { model, system, messages } and answers with Anthropic-style content, or { text }.' }),
          field({ label: 'Shared secret', control: secretInput, help: 'Sent as the x-proxy-secret header.' }),
          field({ label: 'Model', control: modelInput })),
        h('div.field', enabledBox),
        h('div.row', { style: { marginTop: '12px' } },
          h('button.btn.btn--primary', {
            onClick: () => {
              ctx.app.saveAIConfig({
                endpoint: endpointInput.value.trim(),
                secret: secretInput.value,
                model: modelInput.value.trim() || 'claude-sonnet-4-5',
                enabled,
              });
              ctx.db.log('settings.ai', `AI ${enabled && endpointInput.value ? 'connected' : 'set to on-device only'}.`);
              toast('Saved.', { variant: 'ok' });
              ctx.refresh();
            },
          }, 'Save'),
          h('button.btn', {
            onClick: async () => {
              const result = await ctx.assistant.run('announcement.draft', { subject: 'Test', details: 'Checking the connection.' });
              toast(result.source === 'model' ? `Connected — answered by ${result.model}.` : 'No model answered; using on-device drafting.', { variant: result.source === 'model' ? 'ok' : '' });
            },
          }, 'Test connection')),
      ],
    }),
    card({
      title: 'What is sent, and what never is',
      children: [h('div.stack.stack--sm',
        securityRow('Never sent', 'Counselling notes, financial records and the document vault are excluded from every AI request.', true),
        securityRow('Sent only when you ask', 'The text of the specific thing you are drafting — a sermon title and passage, minutes you asked to summarise, an announcement you are writing.', true),
        securityRow('Knowledge answers', 'The passages retrieved for your question, filtered to what your role may read, are sent with it.', true),
        securityRow('Labelled', 'Everything generated is stored and displayed as AI-generated, with the model and time.', true),
      )],
    }));
}

/* ── data ────────────────────────────────────────────────────────────────── */

function dataTab(ctx) {
  const { db } = ctx;
  const counts = ['members', 'attendance', 'care', 'prayers', 'events', 'songs', 'sermons', 'meetings', 'transactions', 'documents']
    .map((name) => ({ name, count: db.all(name).length }));

  return h('div.stack',
    card({
      title: 'Backup',
      subtitle: 'Nobody else has a copy of this. Take one regularly.',
      children: [
        h('p.small.muted',
          'The export is a JSON file containing everything, decrypted, because it has to be readable to be useful. '
          + 'Treat it exactly as you would a printed set of the church\'s records: keep it somewhere safe, and delete old copies.'),
        h('div.row.row--wrap', { style: { marginTop: '12px' } },
          h('button.btn.btn--primary', {
            onClick: () => {
              const snapshot = db.exportAll();
              downloadJSON(`${ctx.tenant.id}-backup-${isoDate(new Date())}.json`, snapshot);
              db.log('export', 'Full backup exported.');
              db.flush();
              toast('Backup downloaded.', { variant: 'ok' });
            },
          }, icon('download', { size: 15 }), 'Export everything'),
          h('button.btn', { onClick: () => restore(ctx) }, 'Restore from a backup')),
      ],
    }),
    card({
      title: 'What is in here',
      children: [table({
        columns: [
          { label: 'Records', value: (row) => sentence(row.name) },
          { label: 'Count', numeric: true, key: 'count' },
        ],
        rows: counts,
      })],
    }),
    card({
      title: 'Import from a spreadsheet',
      subtitle: 'Bring in a real roster or worker\'s schedule. Parsed entirely on this device — the file never leaves your browser.',
      children: [
        h('p.small.muted', 'Export to CSV first (Google Sheets/Excel: File → Download → CSV, comma-separated values), then choose it below.'),
        h('div.row.row--wrap', { style: { marginTop: '12px' } },
          h('button.btn', { onClick: () => importMembers(ctx) }, icon('users', { size: 15 }), 'Import members'),
          h('button.btn', { onClick: () => importSchedule(ctx) }, icon('calendar', { size: 15 }), 'Import worship schedule')),
      ],
    }),
    card({
      title: 'Example data',
      children: [
        h('p.small.muted', 'The demonstration congregation, rota, sermons and budget. Remove it once your own records are in.'),
        h('div.row', { style: { marginTop: '12px' } },
          h('button.btn', {
            onClick: async () => {
              seedTenant(db, { user: ctx.user });
              await db.flush();
              toast('Example data added.', { variant: 'ok' });
              ctx.refresh();
            },
          }, 'Add example data'),
          h('button.btn.btn--danger', {
            onClick: async () => {
              const ok = await confirm({
                title: 'Remove all records?',
                message: 'This clears people, attendance, care, prayer, events, worship, preaching, leadership, finance and documents from this church. User accounts and settings stay. It cannot be undone — export a backup first.',
                confirmLabel: 'Remove everything',
                danger: true,
              });
              if (!ok) return;
              await clearSeedData(db);
              toast('Records cleared.');
              ctx.refresh();
            },
          }, icon('trash', { size: 15 }), 'Clear all records')),
      ],
    }));
}

function restore(ctx) {
  const fileInput = h('input.input', { type: 'file', accept: 'application/json' });
  let merge = false;
  const mergeBox = checkbox({ label: 'Merge into the current records instead of replacing them', checked: false, onChange: (value) => { merge = value; } });

  formModal({
    title: 'Restore from a backup',
    submitLabel: 'Restore',
    danger: true,
    fields: [
      h('p.small.muted', 'The file must be an export from this same church — Shepherd refuses another church\'s backup.'),
      field({ label: 'Backup file', control: fileInput }),
      h('div.field', mergeBox),
    ],
    onSubmit: async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) throw new Error('Choose a file.');
      const snapshot = JSON.parse(await file.text());
      ctx.db.importAll(snapshot, { merge });
      ctx.db.log('restore', `Restored from a backup taken ${snapshot.exportedAt || 'at an unknown time'}.`);
      await ctx.db.flush();
      toast('Restored.', { variant: 'ok' });
      ctx.refresh();
    },
  });
}

/**
 * Import members from a CSV export — the reduced per-church sheet shape
 * (Complete Name, Sex, Civil Status, Date of Birth, Address, Mobile/Email)
 * or the richer form-response shape (adds Ministry Interest/s, Satellite
 * Church, Joining Year, Spouse, Anniversary) both work; whatever columns are
 * present get used. Existing members with the same name are skipped rather
 * than duplicated.
 */
function importMembers(ctx) {
  const { db } = ctx;
  const fileInput = h('input.input', { type: 'file', accept: '.csv,text/csv' });
  const filterInput = input({ placeholder: 'e.g. Abundance — leave blank to import every row' });
  const preview = h('div');
  let parsed = null;

  const parseAndPreview = async () => {
    preview.textContent = '';
    const file = fileInput.files && fileInput.files[0];
    if (!file) { parsed = null; return; }
    const text = await file.text();
    parsed = parseMembersCSV(text, { satelliteChurchFilter: filterInput.value });
    const existing = new Set(db.all('members').map((m) => normalizeName(m.fullName)));
    const dupes = parsed.records.filter((r) => existing.has(normalizeName(r.fullName))).length;
    preview.appendChild(h('div.stack.stack--sm',
      h('p.small', `${parsed.records.length} member${parsed.records.length === 1 ? '' : 's'} ready to import`
        + `${dupes ? ` (${dupes} look already in People and will be skipped)` : ''}.`),
      parsed.warnings.length ? h('div.stack.stack--sm', ...parsed.warnings.slice(0, 8).map((w) => h('p.tiny.subtle', w))) : null,
      parsed.records.length ? h('div.chip-list', ...parsed.records.slice(0, 24).map((r) => h('span.chip', r.fullName)),
        parsed.records.length > 24 ? h('span.tiny.subtle', `and ${parsed.records.length - 24} more…`) : null) : null));
  };
  fileInput.addEventListener('change', parseAndPreview);
  filterInput.addEventListener('input', parseAndPreview);

  formModal({
    title: 'Import members from a spreadsheet',
    submitLabel: 'Import',
    wide: true,
    fields: [
      h('p.small.muted',
        'Recognised columns: Complete Name, Sex, Civil Status, Date of Birth, Address, Ministry Interest/s, '
        + 'Joining Year, Spouse Name, Wedding Anniversary, Mobile Number/Email Address, Satellite Church — '
        + 'whatever is present is used, nothing else is required.'),
      field({ label: 'CSV file', control: fileInput }),
      field({ label: 'Only import one satellite church (optional)', control: filterInput,
        help: 'Use this when the file covers more than one church — matched against a "Satellite Church" column if the file has one.' }),
      preview,
    ],
    onSubmit: async () => {
      if (!parsed) throw new Error('Choose a CSV file first.');
      const existing = new Set(db.all('members').map((m) => normalizeName(m.fullName)));
      let created = 0;
      let skipped = 0;
      for (const record of parsed.records) {
        const key = normalizeName(record.fullName);
        if (existing.has(key)) { skipped += 1; continue; }
        db.insert('members', blank('members', record));
        existing.add(key);
        created += 1;
      }
      await db.flush();
      toast(`${created} member${created === 1 ? '' : 's'} imported${skipped ? `, ${skipped} skipped as likely duplicates` : ''}.`, { variant: 'ok' });
      ctx.refresh();
    },
  });
}

/**
 * Import a worker's schedule — Date, Service (Friday/Sunday), Presider, Song
 * Leader, Preacher, Pastoral Prayer, Food-in-Charge, Communion Assistants.
 * Names are matched against People; anyone not found is left unassigned
 * rather than guessed at or auto-created.
 */
function importSchedule(ctx) {
  const { db } = ctx;
  const fileInput = h('input.input', { type: 'file', accept: '.csv,text/csv' });
  const yearInput = input({ type: 'number', value: String(new Date().getFullYear()) });
  const preview = h('div');
  let parsed = null;

  const parseAndPreview = async () => {
    preview.textContent = '';
    const file = fileInput.files && fileInput.files[0];
    if (!file) { parsed = null; return; }
    const text = await file.text();
    parsed = parseScheduleCSV(text, { defaultYear: Number(yearInput.value) || undefined });
    const members = db.all('members');
    const unmatched = new Set();
    for (const r of parsed.records) {
      for (const nameField of ['presiderName', 'songLeaderName', 'preacherName', 'pastoralPrayerName']) {
        if (r[nameField] && !matchMemberByName(members, r[nameField])) unmatched.add(r[nameField]);
      }
    }
    preview.appendChild(h('div.stack.stack--sm',
      h('p.small', `${parsed.records.length} service${parsed.records.length === 1 ? '' : 's'} ready to import.`),
      parsed.warnings.length ? h('div.stack.stack--sm', ...parsed.warnings.slice(0, 8).map((w) => h('p.tiny.subtle', w))) : null,
      unmatched.size ? h('div', null,
        h('p.small', { style: { fontWeight: '600', marginTop: '8px' } },
          `${unmatched.size} name${unmatched.size === 1 ? '' : 's'} not found in People — those roles will be left unassigned:`),
        h('div.chip-list', ...[...unmatched].map((n) => h('span.chip', n)))) : null));
  };
  fileInput.addEventListener('change', parseAndPreview);
  yearInput.addEventListener('input', parseAndPreview);

  formModal({
    title: 'Import a worship service schedule',
    submitLabel: 'Import',
    wide: true,
    fields: [
      h('p.small.muted',
        'Recognised columns: Date, Service (Friday/Sunday), Theme, Presider, Song Leader, Preacher, Pastoral Prayer, '
        + 'Food-in-Charge, Communion Assistants. A date with no year of its own (like "07-Aug") uses the year below.'),
      field({ label: 'CSV file', control: fileInput }),
      field({ label: 'Year (for dates with no year of their own)', control: yearInput }),
      preview,
    ],
    onSubmit: async () => {
      if (!parsed) throw new Error('Choose a CSV file first.');
      const members = db.all('members');
      const existingKeys = new Set(db.all('serviceSchedule').map((s) => `${s.date}|${s.serviceType}`));
      let created = 0;
      let skipped = 0;
      for (const record of parsed.records) {
        const key = `${record.date}|${record.serviceType}`;
        if (existingKeys.has(key)) { skipped += 1; continue; }
        db.insert('serviceSchedule', blank('serviceSchedule', {
          date: record.date,
          serviceType: record.serviceType,
          service: record.service,
          theme: record.theme,
          presidingLeaderId: (matchMemberByName(members, record.presiderName) || {}).id || null,
          worshipSongLeaderId: (matchMemberByName(members, record.songLeaderName) || {}).id || null,
          preacherId: (matchMemberByName(members, record.preacherName) || {}).id || null,
          pastoralPrayerId: (matchMemberByName(members, record.pastoralPrayerName) || {}).id || null,
          foodInCharge: record.foodInCharge,
          communionNotes: record.communionNote,
        }));
        existingKeys.add(key);
        created += 1;
      }
      await db.flush();
      toast(`${created} service${created === 1 ? '' : 's'} imported${skipped ? `, ${skipped} skipped as already scheduled` : ''}.`, { variant: 'ok' });
      ctx.refresh();
    },
  });
}

/* ── audit ───────────────────────────────────────────────────────────────── */

function auditTab(ctx) {
  const { db } = ctx;
  let query = '';
  const results = h('div');

  const draw = () => {
    const entries = db.all('audit')
      .filter((entry) => !query
        || String(entry.summary || '').toLowerCase().includes(query.toLowerCase())
        || String(entry.actorName || '').toLowerCase().includes(query.toLowerCase())
        || String(entry.action || '').toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 300);

    results.textContent = '';
    results.appendChild(entries.length
      ? table({
        columns: [
          { label: 'When', value: (entry) => formatDateTime(entry.at) },
          { label: 'Who', value: (entry) => entry.actorName || 'system' },
          { label: 'Action', render: (entry) => badge(entry.action) },
          { label: 'What', value: (entry) => entry.summary },
        ],
        rows: entries,
      })
      : emptyState({ title: 'Nothing recorded yet', iconName: 'clock' }));
  };

  const wrap = h('div.stack',
    card({
      title: 'Audit log',
      subtitle: `${db.all('audit').length} entries · append-only`,
      children: [
        searchField({ placeholder: 'Search the log…', onInput: (value) => { query = value; draw(); } }),
        h('div', { style: { marginTop: '12px' } }, results),
      ],
    }));
  draw();
  return wrap;
}
