/* =============================================================================
   FLCC multi-church registry + resolver
   -----------------------------------------------------------------------------
   Every church in the BOTR network runs the SAME app files — same structure,
   same design. Only the data differs. This file answers two questions for every
   page:

     1. Which church is this visitor looking at?   → FLCC.slug
     2. Where does that church's data live?        → FLCC.data('data.json')

   Loaded as a plain <script> BEFORE the app code, so everything here is
   synchronous — no fetch, no await, no race with the React mount.

   HOW A CHURCH IS RESOLVED (first match wins)
     1. Pretty path      /c/shekinah/            (the link you hand out)
     2. Query string     index.html?church=shekinah
     3. Sticky choice    localStorage, from the last explicit visit
     4. Default          abundance

   ADDING A CHURCH
     node scripts/new-church.mjs "Name" <slug> <sector>
   which appends to the registry below and scaffolds churches/<slug>/.
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULT_SLUG = 'abundance';
  var CHURCH_LS_KEY = 'flcc-church-v1';

  /* ── Registry ───────────────────────────────────────────────────────────────
     `name`   fallback display name — a church's own data.json meta.churchName
              wins over this once its leaders publish one.
     `dataBase`
              where this church's JSON lives, relative to the site root.
              Abundance is '.' for historical reasons: its files have sat at the
              repo root since day one and are read by ofw-companion/,
              daily-blessing/ and outside bookmarks. Everyone else lives under
              churches/<slug>/. Code never special-cases this — it just reads
              the field.
     `accent` identity dot only (picker, church chip). The app's theme colours
              are deliberately NOT swapped per church: same design everywhere.
     scripts/new-church.mjs appends entries between the two markers. */
  /* REGISTRY-START */
  var CHURCHES = [
    { slug: 'abundance',   name: 'FLCC - Abundance Church', short: 'Abundance',   sector: 'Hope',  dataBase: '.',                      accent: '#A33B2A' },
    { slug: 'fb',          name: 'FLCC - FB',               short: 'FB',          sector: 'Hope',  dataBase: './churches/fb',          accent: '#B45309' },
    { slug: 'ft',          name: 'FLCC - F&T',              short: 'F&T',         sector: 'Hope',  dataBase: './churches/ft',          accent: '#C2410C' },
    { slug: 'cornerstone', name: 'FLCC - Cornerstone',      short: 'Cornerstone', sector: 'Hope',  dataBase: './churches/cornerstone', accent: '#9A3412' },
    { slug: 'botr-friday', name: 'FLCC - BOTR Friday',      short: 'BOTR Friday', sector: 'Faith', dataBase: './churches/botr-friday', accent: '#1D4ED8' },
    { slug: 'botr-sunday', name: 'FLCC - BOTR Sunday',      short: 'BOTR Sunday', sector: 'Faith', dataBase: './churches/botr-sunday', accent: '#4338CA' },
    { slug: 'shekinah',    name: 'FLCC - Shekinah',         short: 'Shekinah',    sector: 'Faith', dataBase: './churches/shekinah',    accent: '#1E40AF' },
    { slug: 'agape',       name: 'FLCC - Agape',            short: 'Agape',       sector: 'Faith', dataBase: './churches/agape',       accent: '#0E7490' },
    { slug: 'hotk',        name: 'FLCC - HOTK',             short: 'HOTK',        sector: 'Faith', dataBase: './churches/hotk',        accent: '#0F766E' },
    { slug: 'mtcc',        name: 'FLCC - MTCC',             short: 'MTCC',        sector: 'Love',  dataBase: './churches/mtcc',        accent: '#15803D' },
    { slug: 'gil',         name: 'FLCC - GIL',              short: 'GIL',         sector: 'Love',  dataBase: './churches/gil',         accent: '#4D7C0F' },
    { slug: 'jaoc',        name: 'FLCC - JAOC',             short: 'JAOC',        sector: 'Love',  dataBase: './churches/jaoc',        accent: '#6D28D9' },
    { slug: 'harvester',   name: 'FLCC - Harvester',        short: 'Harvester',   sector: 'Love',  dataBase: './churches/harvester',   accent: '#7E22CE' },
    { slug: 'virtual',     name: 'FLCC - Virtual Church',   short: 'Virtual',     sector: 'Love',  dataBase: './churches/virtual',     accent: '#BE185D' },
  ];
  /* REGISTRY-END */

  var SECTORS = ['Hope', 'Faith', 'Love'];

  function find(slug) {
    if (!slug) return null;
    slug = String(slug).toLowerCase();
    for (var i = 0; i < CHURCHES.length; i++) {
      if (CHURCHES[i].slug === slug) return CHURCHES[i];
    }
    return null;
  }

  // 1. /c/<slug>/ — the pretty link. Matches anywhere in the path so it works
  //    whether the site is served from the domain root or a project subpath
  //    (GitHub Pages serves this repo from /flcc-members-2026/).
  function fromPath() {
    var m = /\/c\/([a-z0-9-]+)(\/|$)/i.exec(window.location.pathname);
    return m ? m[1].toLowerCase() : null;
  }

  // 2. ?church=<slug>
  function fromQuery() {
    try {
      return (new URLSearchParams(window.location.search).get('church') || '').toLowerCase() || null;
    } catch (e) {
      return null;
    }
  }

  // 3. Whatever they chose last time.
  function fromStore() {
    try { return (localStorage.getItem(CHURCH_LS_KEY) || '').toLowerCase() || null; } catch (e) { return null; }
  }

  var pathSlug = fromPath();
  var querySlug = fromQuery();
  var requested = pathSlug || querySlug;          // came from the URL = explicit
  var church = find(requested) || find(fromStore()) || find(DEFAULT_SLUG);

  // An explicit, valid URL choice becomes the sticky one. An unknown slug in the
  // URL is ignored rather than remembered — a typo shouldn't strand someone in
  // the wrong church on every later visit.
  if (requested && church.slug === requested) {
    try { localStorage.setItem(CHURCH_LS_KEY, church.slug); } catch (e) {}
  }

  var base = church.dataBase.replace(/\/+$/, '');

  var FLCC = {
    churches: CHURCHES,
    sectors: SECTORS,
    defaultSlug: DEFAULT_SLUG,

    slug: church.slug,
    church: church,
    name: church.name,
    short: church.short,
    /** "FLCC Shekinah" — for lines like "Senior Pastor · FLCC Shekinah". */
    plainName: 'FLCC ' + church.short,
    /** "FLCC - Shekinah Family" — the sign-off on shared messages. */
    family: 'FLCC - ' + church.short + ' Family',
    /** "#ShekinahFamily" — safe for a hashtag. */
    hashtag: '#' + church.short.replace(/[^A-Za-z0-9]/g, '') + 'Family',
    accent: church.accent,
    isDefault: church.slug === DEFAULT_SLUG,
    /** True when the URL named this church (vs. inherited from storage). */
    explicit: !!(requested && church.slug === requested),

    /** Where to READ a data file from: FLCC.data('data.json'). */
    data: function (file) { return base + '/' + String(file).replace(/^\.?\//, ''); },

    /** Same, for a church that is NOT the current one:
     *    FLCC.dataFor('jaoc', 'data.json')  →  './churches/jaoc/data.json'
     *  Network-wide features — the assistant's church directory, anything that
     *  reads across the whole BOTR network — need every church's paths, not
     *  just this visitor's. Returns null for an unknown slug so a caller can
     *  skip it rather than fetch a 404. */
    dataFor: function (slug, file) {
      var c = find(slug);
      if (!c) return null;
      return c.dataBase.replace(/\/+$/, '') + '/' + String(file).replace(/^\.?\//, '');
    },

    /** Where to WRITE it in the repo, for the GitHub-publishing editors. */
    publishPath: function (file) {
      file = String(file).replace(/^\.?\//, '');
      return base === '.' ? file : base.replace(/^\.\//, '') + '/' + file;
    },

    /** Namespace a localStorage key so churches never clobber each other.
     *  Abundance keeps the original un-prefixed keys, so every member already
     *  using the app keeps their identity, notes, progress and streaks. */
    key: function (k) { return church.slug === DEFAULT_SLUG ? k : church.slug + ':' + k; },

    /** Build an in-app link that stays on the current church. */
    url: function (path) {
      if (church.slug === DEFAULT_SLUG) return path;
      return path + (path.indexOf('?') === -1 ? '?' : '&') + 'church=' + church.slug;
    },

    /** The shareable pretty link for a church, from anywhere on the site. */
    prettyUrl: function (slug) {
      var root = window.location.pathname.replace(/\/c\/[a-z0-9-]+\/?$/i, '/').replace(/[^/]*$/, '');
      return window.location.origin + root + 'c/' + (slug || church.slug) + '/';
    },

    find: find,

    bySector: function () {
      return SECTORS.map(function (s) {
        return { sector: s, churches: CHURCHES.filter(function (c) { return c.sector === s; }) };
      });
    },

    /** Switch church and reload into it. */
    setChurch: function (slug) {
      var next = find(slug);
      if (!next) return false;
      try { localStorage.setItem(CHURCH_LS_KEY, next.slug); } catch (e) {}
      var page = window.location.pathname.split('/').pop() || 'index.html';
      window.location.href = next.slug === DEFAULT_SLUG ? page : page + '?church=' + next.slug;
      return true;
    },
  };

  window.FLCC = FLCC;
})();
