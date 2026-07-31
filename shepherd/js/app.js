/**
 * The application shell.
 *
 * Boots the platform, decides whether to show the church picker, the sign-in
 * screen or the app itself, and owns everything that surrounds a module:
 * navigation, global search, theme, the idle lock, and the context object each
 * module is handed.
 */

import { h, icon, render } from './core/dom.js';
import { localStorageAdapter } from './core/storage.js';
import { TenantRegistry, tenantFromLocation, provisionTenant, COUNTRIES } from './core/tenant.js';
import { Database } from './core/db.js';
import { SessionManager, AuthError } from './core/session.js';
import { SearchIndex } from './core/search.js';
import { Assistant, DEFAULT_AI_CONFIG } from './core/ai.js';
import { Router } from './core/router.js';
import { can, ROLES, roleLabel } from './core/rbac.js';
import { configureFormat } from './core/format.js';
import { COLLECTIONS } from './core/schema.js';
import { seedTenant } from './core/seed.js';
import {
  card, field, input, select, toast, modal, formModal, avatar, badge, emptyState,
} from './core/ui.js';

const THEME_KEY = 'shepherd/v1/theme';
const AI_CONFIG_KEY = 'shepherd/v1/ai-config';
const FLCC_SYNC_CONFIG_KEY = 'shepherd/v1/flcc-sync-config';
const DEFAULT_FLCC_SYNC_CONFIG = { autoSync: false, lastSyncedAt: null };

/** Navigation — order is the order in the sidebar. */
export const MODULES = [
  { id: 'dashboard',      title: 'Dashboard',      icon: 'home',      resource: 'dashboard',      group: 'Today',    mobile: true,  load: () => import('./modules/dashboard.js') },
  { id: 'network',        title: 'Network Overview', icon: 'church',  resource: 'network',        group: 'Today',                   load: () => import('./modules/network.js') },
  { id: 'members',        title: 'People',         icon: 'users',     resource: 'members',        group: 'Care',     mobile: true,  load: () => import('./modules/members.js') },
  { id: 'care',           title: 'Member care',    icon: 'heart',     resource: 'care',           group: 'Care',                    load: () => import('./modules/care.js') },
  { id: 'prayer',         title: 'Prayer centre',  icon: 'heart',     resource: 'prayer',         group: 'Care',     mobile: true,  load: () => import('./modules/prayer.js') },
  { id: 'events',         title: 'Events',         icon: 'calendar',  resource: 'events',         group: 'Gather',   mobile: true,  load: () => import('./modules/events.js') },
  { id: 'worship',        title: 'Worship',        icon: 'music',     resource: 'worship',        group: 'Gather',                  load: () => import('./modules/worship.js') },
  { id: 'preaching',      title: 'Preaching',      icon: 'book',      resource: 'preaching',      group: 'Gather',                  load: () => import('./modules/preaching.js') },
  { id: 'equip',          title: 'Equip',          icon: 'graduation', resource: 'equip',         group: 'Grow',     mobile: true,  load: () => import('./modules/equip.js') },
  { id: 'leadership',     title: 'Leadership',     icon: 'shield',    resource: 'leadership',     group: 'Lead',                    load: () => import('./modules/leadership.js') },
  { id: 'finance',        title: 'Finance',        icon: 'wallet',    resource: 'finance',        group: 'Lead',                    load: () => import('./modules/finance.js') },
  { id: 'documents',      title: 'Document vault', icon: 'folder',    resource: 'documents',      group: 'Lead',                    load: () => import('./modules/documents.js') },
  { id: 'knowledge',      title: 'Knowledge',      icon: 'brain',     resource: 'knowledge',      group: 'Lead',                    load: () => import('./modules/knowledge.js') },
  { id: 'communications', title: 'Communications', icon: 'megaphone', resource: 'communications', group: 'Lead',                    load: () => import('./modules/communications.js') },
  { id: 'reports',        title: 'Reports',        icon: 'chart',     resource: 'reports',        group: 'Lead',                    load: () => import('./modules/reports.js') },
  { id: 'assistant',      title: 'Assistant',      icon: 'sparkles',  resource: 'assistant',      group: 'Lead',     mobile: true,  load: () => import('./modules/assistant.js') },
  { id: 'settings',       title: 'Settings',       icon: 'settings',  resource: 'settings',       group: 'Lead',                    load: () => import('./modules/settings.js') },
];

export class App {
  constructor({ root, storage = localStorageAdapter() }) {
    this.root = root;
    this.storage = storage;
    this.registry = new TenantRegistry(storage);
    this.session = new SessionManager({ storage });
    /** @type {Database|null} */
    this.db = null;
    /** @type {SearchIndex|null} */
    this.search = null;
    /** @type {Assistant|null} */
    this.assistant = null;
    this.tenant = null;
    this.router = null;
    this._unsubscribeDb = null;
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */

  async start() {
    this.applyTheme(localStorage.getItem(THEME_KEY) || 'auto');
    await this.registry.load();

    const restored = await this.session.restore(async (tenantId, vaultKey) => {
      const tenant = this.registry.get(tenantId);
      if (!tenant) throw new Error('unknown tenant');
      this.tenant = tenant;
      this.db = await new Database({ tenantId, storage: this.storage, vaultKey }).open();
      return this.db;
    });

    if (restored) {
      await this.enterApp();
    } else {
      this.renderAuth();
    }

    // Idle lock — a church laptop left open on the vestry table locks itself.
    ['click', 'keydown', 'touchstart'].forEach((event) => {
      window.addEventListener(event, () => this.session.touch().then((alive) => {
        if (!alive && this.db) this.handleSignOut('idle');
      }), { passive: true });
    });

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && this.db) {
        e.preventDefault();
        this.openSearch();
      }
    });
  }

  /* ── auth screens ──────────────────────────────────────────────────────── */

  renderAuth() {
    const tenants = this.registry.list();
    const requested = tenantFromLocation();
    const target = (requested && this.registry.get(requested))
      || (tenants.length === 1 ? tenants[0] : null);

    if (!tenants.length) return this.renderFirstRun();
    if (!target) return this.renderChurchPicker(tenants);
    return this.renderSignIn(target);
  }

  _authShell(children) {
    render(this.root, h('div.auth', h('div.auth__card.stack', ...children)));
  }

  renderFirstRun() {
    this._authShell([
      h('div.auth__logo', icon('church', { size: 24 })),
      h('h1.display', null, 'Shepherd'),
      h('p.muted', null,
        'A secure operating system for church leaders — built for Kuwait, ready for the Gulf. '
        + 'Set up your church to begin. Everything stays on this device unless you export it.'),
      h('button.btn.btn--primary.btn--lg', { onClick: () => this.openCreateChurch() },
        icon('plus', { size: 18 }), 'Set up a church'),
      h('p.tiny.subtle', null,
        'Each church gets its own isolated storage, users, documents and finances. No church can see another.'),
    ]);
  }

  renderChurchPicker(tenants) {
    this._authShell([
      h('div.auth__logo', icon('church', { size: 24 })),
      h('h1.display', null, 'Choose your church'),
      h('p.muted', null, 'Each church on this device keeps its own records, entirely separate.'),
      h('div.stack.stack--sm', ...tenants.map((tenant) => h('button.church-pick', {
        onClick: () => this.renderSignIn(tenant),
      },
        h('span.dot', { style: { background: tenant.accent, width: '10px', height: '10px' } }),
        h('span', { style: { flex: '1' } },
          h('span', { style: { display: 'block', fontWeight: '550' } }, tenant.name),
          h('span.tiny.subtle', null, [tenant.city, countryName(tenant.country)].filter(Boolean).join(', '))),
        icon('chevronRight', { size: 16 })))),
      h('button.btn.btn--ghost', { onClick: () => this.openCreateChurch() }, icon('plus', { size: 16 }), 'Add another church'),
    ]);
  }

  renderSignIn(tenant, { error = '', needsTotp = false, email = '' } = {}) {
    const emailInput = input({ type: 'email', name: 'email', autocomplete: 'username', value: email, required: true });
    const passInput = input({ type: 'password', name: 'passphrase', autocomplete: 'current-password', required: true });
    const totpInput = input({ inputmode: 'numeric', name: 'totp', autocomplete: 'one-time-code', placeholder: '000000', maxlength: 6 });

    const submit = async (e) => {
      e.preventDefault();
      button.disabled = true;
      button.textContent = 'Checking…';
      try {
        const db = await new Database({ tenantId: tenant.id, storage: this.storage }).open();
        await this.session.signIn({
          db,
          tenantId: tenant.id,
          email: emailInput.value,
          passphrase: passInput.value,
          totpCode: totpInput.value,
        });
        this.tenant = tenant;
        this.db = db;
        await this.registry.rememberLast(tenant.id);
        await this.enterApp();
      } catch (err) {
        const isTotp = err instanceof AuthError && (err.code === 'totp-required' || err.code === 'totp');
        this.renderSignIn(tenant, { error: err.message, needsTotp: isTotp, email: emailInput.value });
      }
    };

    const button = h('button.btn.btn--primary.btn--lg.btn--block', { type: 'submit' }, 'Sign in');
    const form = h('form.stack', { onSubmit: submit },
      field({ label: 'Email', control: emailInput }),
      field({ label: 'Passphrase', control: passInput }),
      needsTotp ? field({ label: 'Authenticator code', control: totpInput, help: 'Six digits from your authenticator app, or a recovery code.' }) : null,
      error ? h('p.field__error', { role: 'alert' }, error) : null,
      button);

    this._authShell([
      h('div.auth__logo', { style: { background: tenant.accent } }, icon('church', { size: 24 })),
      h('h1.display', null, tenant.name),
      h('p.muted', null, 'Sign in to continue.'),
      card({ children: [form] }),
      h('div.row',
        this.registry.list().length > 1
          ? h('button.btn.btn--ghost.btn--sm', { onClick: () => this.renderChurchPicker(this.registry.list()) }, icon('arrowLeft', { size: 14 }), 'Other church')
          : null,
        h('div.spacer'),
        h('button.btn.btn--ghost.btn--sm', { onClick: () => this.openCreateChurch() }, 'Set up a new church')),
      h('p.tiny.subtle', null,
        'Your passphrase unlocks this church\'s encrypted records — counselling notes, finance and documents. '
        + 'Nobody can reset it for you, so keep it somewhere safe.'),
    ]);
    setTimeout(() => (needsTotp ? totpInput : emailInput).focus(), 50);
  }

  openCreateChurch() {
    const nameInput = input({ required: true, placeholder: 'Grace Community Church' });
    const shortInput = input({ placeholder: 'Grace' });
    const cityInput = input({ placeholder: 'Kuwait City' });
    const countrySelect = select({
      options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
      value: 'KW',
    });
    const adminName = input({ required: true, placeholder: 'Pastor Ruth Antonio' });
    const adminEmail = input({ type: 'email', required: true, autocomplete: 'email' });
    const adminPass = input({ type: 'password', required: true, autocomplete: 'new-password' });
    const adminPass2 = input({ type: 'password', required: true, autocomplete: 'new-password' });
    const withDemo = h('input', { type: 'checkbox' });

    formModal({
      title: 'Set up a church',
      submitLabel: 'Create church',
      wide: true,
      fields: [
        h('p.small.muted', null,
          'This creates an isolated workspace: its own encrypted storage, users, finances and documents. '
          + 'You will be its first administrator.'),
        h('div.form-grid',
          field({ label: 'Church name', control: nameInput, full: true }),
          field({ label: 'Short name', control: shortInput, help: 'Used in tight spaces.' }),
          field({ label: 'City', control: cityInput }),
          field({ label: 'Country', control: countrySelect })),
        h('hr.divider'),
        h('h3', null, 'First administrator'),
        h('div.form-grid',
          field({ label: 'Full name', control: adminName, full: true }),
          field({ label: 'Email', control: adminEmail }),
          field({ label: 'Passphrase', control: adminPass, help: 'At least 10 characters. This encrypts the church\'s records.' }),
          field({ label: 'Confirm passphrase', control: adminPass2 })),
        h('label.checkbox', withDemo,
          h('span', null,
            h('span', { style: { display: 'block' } }, 'Add example data'),
            h('span.tiny.subtle', null, 'A demonstration congregation, rota, sermons and budget, so you can see how everything fits. Removable later from Settings.'))),
      ],
      onSubmit: async () => {
        if (adminPass.value !== adminPass2.value) throw new Error('The two passphrases do not match.');
        const { tenant, db, user, vaultKey } = await provisionTenant({
          registry: this.registry,
          storage: this.storage,
          tenant: {
            name: nameInput.value,
            shortName: shortInput.value || nameInput.value,
            city: cityInput.value,
            country: countrySelect.value,
          },
          admin: { name: adminName.value, email: adminEmail.value, passphrase: adminPass.value },
        });
        if (withDemo.checked) {
          seedTenant(db, { user });
          await db.flush();
        }
        this.tenant = tenant;
        this.db = db;
        this.session.current = { tenantId: tenant.id, user, vaultKey, startedAt: Date.now(), lastSeenAt: Date.now() };
        await this.session._persist();
        await this.registry.rememberLast(tenant.id);
        await this.enterApp();
        toast(`${tenant.name} is ready.`, { variant: 'ok' });
      },
    });
  }

  /* ── the app ───────────────────────────────────────────────────────────── */

  async enterApp() {
    const tenant = this.tenant;
    configureFormat({
      currency: tenant.settings.currency,
      timeZone: tenant.settings.timeZone,
      locale: tenant.settings.locale,
    });

    this.search = new SearchIndex(this.db);
    this.assistant = new Assistant({
      db: this.db,
      search: this.search,
      config: this.loadAIConfig(),
    });

    const content = h('main#content.main', { tabindex: '-1' });
    const container = h('div', { id: 'route' });
    content.appendChild(this.renderTopbar());
    content.appendChild(container);

    const shell = h('div.app',
      h('a.skip-link', { href: '#content' }, 'Skip to content'),
      this.renderSidebar(),
      content);
    render(this.root, shell, this.renderTabbar());

    this.router = new Router({
      routes: Object.fromEntries(this.visibleModules().map((m) => [m.id, m])),
      fallback: 'dashboard',
      container,
      context: this.context(),
      canAccess: (route) => can(this.session.user, `${route.resource}:read`),
      onDenied: () => emptyState({
        title: 'Not available to your role',
        detail: `You are signed in as ${roleLabel(this.session.user.role)}. Ask a church administrator if you need access.`,
        iconName: 'lock',
      }),
      onAfter: (route) => this.syncNav(route.id),
    });

    // Any data change re-renders the current screen: the dashboard a treasurer
    // is looking at updates the moment a gift is recorded on someone else's tab.
    // Audit entries are the exception — they are written by almost everything
    // (including generating an AI draft), and re-rendering on them would wipe
    // out the very output the user just asked for.
    this._unsubscribeDb = this.db.subscribe((collection) => {
      if (collection === 'audit') return;
      this.scheduleRefresh();
    });
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(`shepherd/v1/t/${this.tenant.id}/`)) this.reloadFromStorage();
    });

    await this.router.start();
  }

  visibleModules() {
    return MODULES.filter((m) => can(this.session.user, `${m.resource}:read`));
  }

  context() {
    return {
      app: this,
      get db() { return this.app.db; },
      get user() { return this.app.session.user; },
      get tenant() { return this.app.tenant; },
      get settings() { return this.app.tenant.settings; },
      get assistant() { return this.app.assistant; },
      get search() { return this.app.search; },
      get session() { return this.app.session; },
      can: (permission) => can(this.session.user, permission),
      navigate: (path) => this.router.navigate(path),
      refresh: () => this.scheduleRefresh(),
      toast,
      openSearch: () => this.openSearch(),
    };
  }

  scheduleRefresh() {
    if (this._refreshTimer) return;
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      if (this.router) this.router.refresh();
    }, 60);
  }

  /** Another tab wrote to this tenant — reload and re-render. */
  async reloadFromStorage() {
    const vaultKey = this.session.vaultKey;
    this.db = await new Database({ tenantId: this.tenant.id, storage: this.storage, vaultKey, actor: this.session.user }).open();
    this.search.dispose();
    this.search = new SearchIndex(this.db);
    this.assistant.db = this.db;
    this.assistant.search = this.search;
    this.scheduleRefresh();
  }

  renderSidebar() {
    const modules = this.visibleModules();
    const groups = [];
    for (const module of modules) {
      let group = groups.find((g) => g.name === module.group);
      if (!group) groups.push((group = { name: module.group, items: [] }));
      group.items.push(module);
    }

    this._navItems = new Map();
    const nav = h('nav.sidebar__nav', { 'aria-label': 'Sections' });
    for (const group of groups) {
      nav.appendChild(h('p.eyebrow.nav-section', null, group.name));
      for (const module of group.items) {
        const link = h('a.nav-item', { href: `#/${module.id}` }, icon(module.icon, { size: 18 }), module.title);
        this._navItems.set(module.id, link);
        nav.appendChild(link);
      }
    }

    return h('aside.sidebar',
      h('div.sidebar__brand',
        h('span', {
          style: {
            width: '30px', height: '30px', borderRadius: '9px', background: this.tenant.accent,
            color: 'white', display: 'grid', placeItems: 'center', flex: 'none',
          },
        }, icon('church', { size: 17 })),
        h('span', { style: { minWidth: 0 } },
          h('span.truncate', { style: { display: 'block', fontWeight: '600', fontSize: '.875rem' } }, this.tenant.shortName),
          h('span.tiny.subtle.truncate', { style: { display: 'block' } }, 'Shepherd'))),
      nav,
      h('div.sidebar__foot',
        h('button.nav-item', { onClick: () => this.openAccountMenu() },
          avatar(this.session.user.name, { size: 'sm' }),
          h('span.truncate', { style: { minWidth: 0 } }, this.session.user.name))));
  }

  renderTopbar() {
    return h('header.topbar',
      h('button.icon-btn.only-mobile', { 'aria-label': 'Menu', onClick: () => this.openMobileMenu() }, icon('menu', { size: 20 })),
      h('span.topbar__title.truncate.only-mobile', null, this.tenant.shortName),
      h('div.topbar__spacer'),
      h('button.btn.btn--sm', { onClick: () => this.openSearch(), 'aria-label': 'Search everything' },
        icon('search', { size: 15 }),
        h('span.hide-mobile', null, 'Search'),
        h('span.kbd.hide-mobile', null, '⌘K')),
      h('button.icon-btn', { 'aria-label': 'Switch theme', onClick: () => this.cycleTheme() },
        icon(document.documentElement.dataset.theme === 'dark' ? 'moon' : 'sun', { size: 18 })),
      h('button.icon-btn.hide-mobile', { 'aria-label': 'Your account', onClick: () => this.openAccountMenu() },
        avatar(this.session.user.name, { size: 'sm' })));
  }

  renderTabbar() {
    const items = this.visibleModules().filter((m) => m.mobile).slice(0, 5);
    this._tabItems = new Map();
    const bar = h('nav.tabbar', { 'aria-label': 'Main' });
    for (const module of items) {
      const link = h('a.tabbar__item', { href: `#/${module.id}` }, icon(module.icon, { size: 21 }), module.title);
      this._tabItems.set(module.id, link);
      bar.appendChild(link);
    }
    bar.appendChild(h('button.tabbar__item', { onClick: () => this.openMobileMenu() }, icon('menu', { size: 21 }), 'More'));
    return bar;
  }

  syncNav(activeId) {
    for (const [id, el] of this._navItems || []) {
      if (id === activeId) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }
    for (const [id, el] of this._tabItems || []) {
      if (id === activeId) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }
    const module = MODULES.find((m) => m.id === activeId);
    document.title = module ? `${module.title} · ${this.tenant.shortName} · Shepherd` : 'Shepherd';
  }

  openMobileMenu() {
    const ref = modal({
      title: 'Go to',
      body: h('div.stack.stack--sm', ...this.visibleModules().map((module) => h('a.nav-item', {
        href: `#/${module.id}`,
        onClick: () => ref.close(),
      }, icon(module.icon, { size: 18 }), module.title))),
    });
  }

  openAccountMenu() {
    const user = this.session.user;
    const ref = modal({
      title: 'Your account',
      body: h('div.stack',
        h('div.row',
          avatar(user.name, { size: 'lg' }),
          h('div', null,
            h('div', { style: { fontWeight: '600' } }, user.name),
            h('div.small.muted', null, user.email),
            h('div', { style: { marginTop: '4px' } }, badge(roleLabel(user.role), 'accent')))),
        h('hr.divider'),
        h('p.small.muted', null, `${this.tenant.name} · ${[this.tenant.city, countryName(this.tenant.country)].filter(Boolean).join(', ')}`),
        h('div.stack.stack--sm',
          can(user, 'settings:read')
            ? h('a.btn.btn--block', { href: '#/settings', onClick: () => ref.close() }, icon('settings', { size: 16 }), 'Settings & security')
            : null,
          this.registry.list().length > 1
            ? h('button.btn.btn--block', { onClick: async () => { ref.close(); await this.handleSignOut('switch'); } }, icon('church', { size: 16 }), 'Switch church')
            : null,
          h('button.btn.btn--block.btn--danger', { onClick: async () => { ref.close(); await this.handleSignOut('manual'); } },
            icon('logout', { size: 16 }), 'Sign out'))),
    });
  }

  /**
   * @param {string} reason
   * @param {string} [targetTenantId] jump straight to this church's own
   *   sign-in form instead of the generic picker — used by the Network
   *   Overview's "Open this church" action (see `tenantFromLocation`).
   */
  async handleSignOut(reason, targetTenantId) {
    if (this._unsubscribeDb) this._unsubscribeDb();
    if (this.db) await this.db.flush();
    await this.session.signOut(reason, this.db);
    if (this.router) this.router.stop();
    if (this.search) this.search.dispose();
    this.db = null;
    this.router = null;
    window.location.hash = targetTenantId ? `#/c/${targetTenantId}/` : '';
    this.renderAuth();
    if (reason === 'idle') toast('Signed out after 45 minutes of inactivity.', { variant: '' });
  }

  /* ── global search ─────────────────────────────────────────────────────── */

  openSearch() {
    if (document.querySelector('.sheet-search')) return;
    const results = h('div.sheet-search__results');
    const box = h('input', {
      type: 'search', placeholder: 'Search people, songs, sermons, minutes, documents…',
      'aria-label': 'Search everything', autocomplete: 'off',
    });
    let hits = [];
    let cursor = 0;

    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
    const go = (hit) => {
      close();
      this.router.navigate(routeForHit(hit));
    };

    const draw = () => {
      const query = box.value.trim();
      if (!query) {
        render(results, h('p.small.subtle', { style: { padding: '18px' } },
          'Type to search across people, prayer, songs, sermons, events, minutes, documents and policies.'));
        hits = [];
        return;
      }
      const groups = this.search.grouped(query, { user: this.session.user });
      hits = groups.flatMap((g) => g.hits);
      cursor = 0;
      if (!hits.length) {
        render(results, h('p.small.subtle', { style: { padding: '18px' } }, `Nothing matches “${query}”.`));
        return;
      }
      render(results, ...groups.map((group) => h('div', null,
        h('p.eyebrow.sheet-search__group', null, group.label),
        ...group.hits.map((hit) => h('button.sheet-search__hit', {
          onClick: () => go(hit),
          'aria-selected': String(hits.indexOf(hit) === cursor),
        },
          h('div', { style: { fontWeight: '500', fontSize: '.875rem' } }, hit.title || '(untitled)'),
          h('div.tiny.subtle.truncate', null, hit.snippet))))));
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!hits.length) return;
        cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
        const nodes = results.querySelectorAll('.sheet-search__hit');
        nodes.forEach((node, i) => node.setAttribute('aria-selected', String(i === cursor)));
        if (nodes[cursor]) nodes[cursor].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && hits[cursor]) {
        e.preventDefault();
        go(hits[cursor]);
      }
    };

    box.addEventListener('input', draw);
    const overlay = h('div.sheet-search', { onMousedown: (e) => { if (e.target === overlay) close(); } },
      h('div.sheet-search__panel', { role: 'dialog', 'aria-label': 'Search' },
        h('div.sheet-search__input', icon('search', { size: 18 }), box),
        results));
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
    draw();
    box.focus();
  }

  /* ── preferences ───────────────────────────────────────────────────────── */

  applyTheme(theme) {
    const resolved = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePref = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0E1011' : '#FBFBFA');
  }

  cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    const current = document.documentElement.dataset.themePref || 'auto';
    const next = order[(order.indexOf(current) + 1) % order.length];
    localStorage.setItem(THEME_KEY, next);
    this.applyTheme(next);
    // Redraw the bar so its sun/moon icon matches what the user is now looking at.
    const bar = document.querySelector('.topbar');
    if (bar) bar.replaceWith(this.renderTopbar());
    toast(`Theme: ${next}`);
  }

  loadAIConfig() {
    try {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(localStorage.getItem(`${AI_CONFIG_KEY}/${this.tenant.id}`) || '{}') };
    } catch {
      return { ...DEFAULT_AI_CONFIG };
    }
  }

  saveAIConfig(config) {
    localStorage.setItem(`${AI_CONFIG_KEY}/${this.tenant.id}`, JSON.stringify(config));
    this.assistant.setConfig(config);
  }

  loadFLCCSyncConfig() {
    try {
      return { ...DEFAULT_FLCC_SYNC_CONFIG, ...JSON.parse(localStorage.getItem(`${FLCC_SYNC_CONFIG_KEY}/${this.tenant.id}`) || '{}') };
    } catch {
      return { ...DEFAULT_FLCC_SYNC_CONFIG };
    }
  }

  saveFLCCSyncConfig(config) {
    localStorage.setItem(`${FLCC_SYNC_CONFIG_KEY}/${this.tenant.id}`, JSON.stringify({ ...this.loadFLCCSyncConfig(), ...config }));
  }
}

/** Where a search hit lives. */
export function routeForHit(hit) {
  const map = {
    members: '/members', families: '/members', care: '/care', counseling: '/care',
    ministries: '/members', committees: '/leadership', meetings: '/leadership',
    actionItems: '/leadership', decisions: '/leadership', goals: '/leadership',
    songs: '/worship', setlists: '/worship', sermons: '/preaching', series: '/preaching',
    illustrations: '/preaching', prayers: '/prayer', prayerChains: '/prayer',
    events: '/events', eventTasks: '/events', budgets: '/finance', transactions: '/finance',
    projects: '/finance', documents: '/documents', knowledge: '/knowledge',
    announcements: '/communications', users: '/settings',
  };
  const base = map[hit.collection] || '/dashboard';
  return `${base}/${hit.id}`;
}

function countryName(code) {
  const country = COUNTRIES.find((c) => c.code === code);
  return country ? country.name : code;
}

export { COLLECTIONS, ROLES };
