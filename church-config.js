/* ===========================================================================
 * church-config.js — per-church identity for one copy of this app
 * ===========================================================================
 *
 * Every church in the FLCC BOTR network runs its OWN copy of this repo, with
 * its own GitHub Pages site, its own publishing token and its own data files.
 * This file is the one place that says which church this copy belongs to.
 *
 * `tools/setup-church.mjs` writes this file for you when a new church forks
 * the repo — you should not normally need to hand-edit it. If you do, keep it
 * plain: it is loaded by a <script> tag, so no imports and no build step.
 *
 * The network-level branding ("FLCC", the BOTR network, the statement of
 * faith in botr.json) is shared by every church and is deliberately NOT in
 * here. Only what makes this church itself.
 * ------------------------------------------------------------------------- */

window.CHURCH_CONFIG = {
  /* Full display name. Shown in page titles and used as the fallback when a
   * data file has no meta.churchName of its own. */
  churchName: 'FLCC - Abundance Church',

  /* Just this satellite's name, no "FLCC" prefix — used in short labels and
   * in the Friday/Sunday service tags (e.g. "Abundance-Fri"). */
  satelliteName: 'Abundance',

  /* Which BOTR sector this church belongs to: Hope, Faith or Love.
   * See botr.json → sectorLeaders. */
  sector: 'Hope',

  /* Where the admin pages publish to: "owner/repo" on GitHub.
   *
   * Leave this EMPTY to auto-detect from the GitHub Pages URL — which is what
   * you want in almost every case. A copy served from
   * `yourname.github.io/your-repo/` detects `yourname/your-repo` by itself, so
   * a fresh fork publishes to its own repo with no configuration at all.
   *
   * Set it explicitly ONLY if this copy is served from somewhere that isn't
   * github.io (a custom domain, or the Cloudflare Worker in wrangler.toml),
   * because the URL carries no owner/repo to detect in that case.
   *
   * Getting this wrong is the one mistake with real consequences: it points
   * one church's "Publish" button at another church's data. It never silently
   * misfires — if detection fails, publishing stops with an error rather than
   * guessing. */
  repo: '',
};

/* ---------------------------------------------------------------------------
 * resolveChurchRepo() → "owner/repo"
 *
 * Throws a message written for whoever is standing in front of the screen —
 * usually a ministry volunteer, not a developer — because it surfaces in an
 * alert() when publishing fails.
 * ------------------------------------------------------------------------- */
window.resolveChurchRepo = function resolveChurchRepo() {
  const configured = (window.CHURCH_CONFIG?.repo || '').trim();
  if (configured) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(configured)) {
      throw new Error(
        `church-config.js has repo: "${configured}", which is not in the ` +
        `expected "owner/repo" form. Fix that line and reload.`
      );
    }
    return configured;
  }

  // Auto-detect from a GitHub Pages URL.
  const host = location.hostname.toLowerCase();
  const gh = host.match(/^([\w-]+)\.github\.io$/);
  if (gh) {
    const owner = gh[1];
    const segments = location.pathname.split('/').filter(Boolean);

    // Two shapes of GitHub Pages site, told apart by the first path segment:
    //
    //   project site — owner.github.io/repo/page.html  → owner/repo
    //   user site    — owner.github.io/page.html       → owner/owner.github.io
    //
    // A lone segment is ambiguous: "/flcc-agape" is a repo served at its root,
    // while "/attendance.html" is a page in a user site. A trailing .html is
    // what separates them — every page in this app ends that way, and repo
    // names in the network do not.
    const looksLikeAPage = segments.length === 1 && /\.html?$/i.test(segments[0]);
    if (segments.length === 0 || looksLikeAPage) return `${owner}/${host}`;
    return `${owner}/${segments[0]}`;
  }

  throw new Error(
    'Cannot tell which GitHub repository to publish to.\n\n' +
    `This page is open at ${location.hostname || 'a local file'}, which is not ` +
    'a github.io address, so the repository cannot be detected automatically.\n\n' +
    'Fix: open church-config.js and set repo to your own "owner/repo" ' +
    '(for example "shekinah-kuwait/flcc-shekinah-2026"), then reload this page.'
  );
};

/* Same resolution, for places that want to *show* the repo (setup help text)
 * rather than publish to it — returns null instead of throwing, so an
 * un-detectable repo degrades to slightly vaguer instructions instead of
 * breaking the page that explains how to fix it. */
window.resolveChurchRepoSafe = function resolveChurchRepoSafe() {
  try { return window.resolveChurchRepo(); } catch { return null; }
};
