/**
 * The shell: boot, navigation, and the few things that outlive a screen —
 * the database, the search index, the audio player, and a recording in
 * progress.
 *
 * Views are ordinary modules that export `render(app, route)` and return a
 * DOM node. They are imported the first time they are visited.
 */

import { h, icon, mount } from './core/dom.js';
import { Database } from './core/db.js';
import { localStorageAdapter, indexedDbBlobs, namespaced } from './core/store.js';
import { Router } from './core/router.js';
import { ModelClient, DEFAULT_MODEL } from './core/ai.js';
import { chooseProvider } from './core/transcribe.js';
import { indexDatabase } from './core/retrieval.js';
import { Player } from './core/audio.js';
import { RecordingSession } from './core/session.js';
import { toast, announce } from './core/ui.js';

const NAMESPACE = 'longhand/v1/';

export const NAV = [
  { name: 'home',     label: 'Home',     iconName: 'home' },
  { name: 'record',   label: 'Record',   iconName: 'record' },
  { name: 'meetings', label: 'Meetings', iconName: 'meetings' },
  { name: 'memory',   label: 'AI Memory',iconName: 'memory' },
  { name: 'tasks',    label: 'Tasks',    iconName: 'tasks' },
  { name: 'people',   label: 'People',   iconName: 'people' },
  { name: 'search',   label: 'Search',   iconName: 'search' },
  { name: 'settings', label: 'Settings', iconName: 'settings' },
];

/** The five that fit a phone's thumb. */
const MOBILE_NAV = ['home', 'record', 'meetings', 'memory', 'search'];

const VIEWS = {
  home:     () => import('./views/home.js'),
  record:   () => import('./views/record.js'),
  meetings: () => import('./views/meetings.js'),
  meeting:  () => import('./views/meeting.js'),
  memory:   () => import('./views/memory.js'),
  tasks:    () => import('./views/tasks.js'),
  people:   () => import('./views/people.js'),
  search:   () => import('./views/search.js'),
  settings: () => import('./views/settings.js'),
};

/** Settings the app reads; each one is editable on the Settings screen. */
export const SETTING_DEFAULTS = {
  aiEndpoint: '',
  sttEndpoint: '',
  proxySecret: '',
  model: DEFAULT_MODEL,
  transcriptionProvider: 'auto',
  chunkSeconds: 12,
  askBeforeDeleting: true,
  autoProcess: true,
};

export class App {
  constructor({ root }) {
    this.root = root;
    this.db = null;
    this.player = new Player();
    /** @type {RecordingSession|null} */
    this.session = null;
    this._index = null;
    this._indexStale = true;
    this.router = new Router(VIEWS);
    this.viewHost = null;
  }

  async start() {
    const storage = namespaced(localStorageAdapter(), NAMESPACE);
    this.db = await new Database({ storage, blobs: indexedDbBlobs() }).open();

    // A meeting left mid-recording by a closed tab is stranded, not lost.
    for (const meeting of this.db.where('meetings', { status: 'recording' })) {
      this.db.update('meetings', meeting.id, {
        status: 'failed',
        error: 'Recording stopped unexpectedly — the browser tab closed. Whatever was transcribed is below.',
      });
    }

    this.db.addEventListener('change', (event) => {
      const collection = event.detail && event.detail.collection;
      if (collection === 'segments' || collection === 'meetings' || collection === '*' || collection === 'speakers') {
        this._indexStale = true;
      }
      this.paintCounts();
    });

    this.render();
    this.router.addEventListener('navigate', (event) => this.show(event.detail));
    this.router.start();
    this.bindKeys();
    return this;
  }

  /* ── configuration ─────────────────────────────────────────────────────── */

  setting(key) {
    const value = this.db.setting(key, SETTING_DEFAULTS[key]);
    return value === undefined ? SETTING_DEFAULTS[key] : value;
  }

  /** The model endpoint. Defaults to this site's own Worker (`/proxy`), which
   *  is where the API key lives; a different one can be set in Settings. */
  get modelEndpoint() {
    return this.setting('aiEndpoint') || sameOrigin('/proxy');
  }

  get sttEndpoint() {
    return this.setting('sttEndpoint') || sameOrigin('/stt');
  }

  get client() {
    return new ModelClient({
      endpoint: this.modelEndpoint,
      secret: this.setting('proxySecret'),
      model: this.setting('model'),
    });
  }

  get provider() {
    return chooseProvider({
      provider: this.setting('transcriptionProvider'),
      sttUrl: this.sttEndpoint,
      secret: this.setting('proxySecret'),
    });
  }

  /** The search index, rebuilt only when the transcripts have moved on. */
  get index() {
    if (!this._index || this._indexStale) {
      this._index = indexDatabase(this.db);
      this._indexStale = false;
    }
    return this._index;
  }

  /* ── shell ─────────────────────────────────────────────────────────────── */

  render() {
    this.viewHost = h('main.main#main', { tabindex: '-1' });
    const shell = h('div.app',
      h('a.skip-link', { href: '#main' }, 'Skip to content'),
      this.rail(),
      this.viewHost);
    mount(this.root, h('div', shell, this.tabbar()));
    this.paintCounts();
  }

  rail() {
    this.railNav = h('nav.rail__nav', { 'aria-label': 'Sections' });
    for (const item of NAV) {
      this.railNav.appendChild(h('a.rail__link', { href: `#/${item.name}`, dataset: { nav: item.name } },
        icon(item.iconName, { size: 17 }),
        item.label,
        h('span.rail__count', { dataset: { count: item.name } })));
    }
    this.recordingBanner = h('div', { hidden: true });
    return h('aside.rail',
      h('div.rail__mark', mark(), h('strong', 'Longhand')),
      this.railNav,
      h('div.rail__foot', this.recordingBanner));
  }

  tabbar() {
    const bar = h('nav.tabbar.mobile-only', { 'aria-label': 'Sections' });
    for (const name of MOBILE_NAV) {
      const item = NAV.find((n) => n.name === name);
      bar.appendChild(h('a', { href: `#/${item.name}`, dataset: { nav: item.name } },
        icon(item.iconName, { size: 20 }),
        h('span', item.label === 'AI Memory' ? 'Memory' : item.label)));
    }
    return bar;
  }

  paintCounts() {
    if (!this.db || !this.railNav) return;
    const open = this.db.where('actions', { status: 'open' }).length;
    for (const node of document.querySelectorAll('[data-count]')) {
      node.textContent = node.dataset.count === 'tasks' && open ? String(open) : '';
    }
    // The "return to recording" shortcut is for when you have wandered off;
    // on the recording screen itself it is just noise.
    const onRecordScreen = this.router.current && this.router.current.name === 'record';
    const recording = Boolean(this.session && this.session.active && !onRecordScreen);
    if (this.recordingBanner) {
      this.recordingBanner.hidden = !recording;
      if (recording) {
        this.recordingBanner.replaceChildren(h('a.btn.btn--record.btn--block', { href: '#/record' },
          h('span.dot.dot--record'), 'Recording — return'));
      }
    }
  }

  markCurrent(name) {
    for (const node of document.querySelectorAll('[data-nav]')) {
      const active = node.dataset.nav === name
        || (name === 'meeting' && node.dataset.nav === 'meetings');
      if (active) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    }
  }

  async show(route) {
    this.markCurrent(route.name);
    this.paintCounts();
    const load = VIEWS[route.name] || VIEWS.home;
    try {
      const module = await load();
      const node = await module.render(this, route);
      mount(this.viewHost, node);
      // Only move focus when the reader asked for a new screen, never on the
      // in-place re-renders a view does to itself.
      if (this._lastRoute !== `${route.name}/${route.params.join('/')}`) {
        this.viewHost.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }
      this._lastRoute = `${route.name}/${route.params.join('/')}`;
      const title = document.querySelector('.page-title');
      document.title = title ? `${title.textContent} · Longhand` : 'Longhand';
      announce(title ? title.textContent : route.name);
    } catch (err) {
      console.error(err);
      mount(this.viewHost, h('div.view',
        h('h1.page-title', 'This screen did not load'),
        h('p.lede', err && err.message ? err.message : String(err)),
        h('p.meta', 'Your recordings are unaffected. Reloading the page usually fixes this.')));
    }
  }

  /** Re-run the current route — how a view refreshes itself after a write. */
  refresh() { this.show(this.router.current); }

  go(name, params = [], query = {}) { this.router.go(name, params, query); }

  bindKeys() {
    document.addEventListener('keydown', (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        this.go('search');
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/') { event.preventDefault(); this.go('search'); }
      if (event.key === ' ' && this.player.available) { event.preventDefault(); this.player.toggle(); }
    });
  }

  /* ── recording ─────────────────────────────────────────────────────────── */

  async startRecording({ title } = {}) {
    if (this.session && this.session.active) return this.session;
    const session = new RecordingSession({
      db: this.db,
      provider: this.provider,
      chunkSeconds: Number(this.setting('chunkSeconds')) || 12,
    });
    await session.start({ title });
    this.session = session;
    session.addEventListener('state', () => this.paintCounts());
    this.paintCounts();
    return session;
  }

  endRecording() {
    this.session = null;
    this.paintCounts();
    this._indexStale = true;
  }

  notify(message) { toast(message); }
}

function sameOrigin(path) {
  try {
    if (typeof location === 'undefined' || !/^https?:/.test(location.protocol)) return '';
    return new URL(path, location.origin).toString();
  } catch { return ''; }
}

/** The mark: a stack of transcript lines. Drawn, not decorated. */
function mark() {
  return h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' },
    h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 }),
    h('path', { d: 'M7 9h7M7 12.5h10M7 16h5', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
}
