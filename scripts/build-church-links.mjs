#!/usr/bin/env node
/* Generate the pretty per-church links from the registry in church.js:
 *
 *   /c/                  church picker, grouped by BOTR sector
 *   /c/<slug>/           the link you hand a church — remembers the choice and
 *                        opens the one shared app with that church loaded
 *
 * GitHub Pages serves static files only, so a "pretty path" has to be a real
 * directory. These stubs are that directory. Re-run after editing the registry:
 *
 *   node scripts/build-church-links.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, readRegistry } from './lib/registry.mjs';

const HEAD = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#FAFAF5; --surface:#FFFFFF; --ink:#18181B; --ink-muted:#52525B;
          --ink-subtle:#A1A1AA; --border:#E7E5DE; --accent:#A33B2A; }
  * { box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  html { font-size:17px; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font-family:'Geist',ui-sans-serif,system-ui,sans-serif;
         font-feature-settings:"ss01","ss03"; }
  .font-display { font-family:'Fraunces',Georgia,serif; letter-spacing:-0.01em; }
</style>
</head>
<body>`;

function redirectStub(church) {
  return `${HEAD(`${church.name} · FLCC Members`)}
<main style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;padding:2rem;text-align:center">
  <div style="width:44px;height:44px;border-radius:50%;background:${church.accent}"></div>
  <h1 class="font-display" style="margin:0;font-size:1.375rem;font-weight:600">${church.name}</h1>
  <p style="margin:0;color:var(--ink-muted);font-size:.9375rem">Opening your church app…</p>
  <noscript><p style="color:var(--ink-muted)"><a href="../../index.html?church=${church.slug}" style="color:var(--accent)">Continue to ${church.name}</a></p></noscript>
</main>
<script src="../../church.js"></script>
<script>
  // church.js has already stored "${church.slug}" from this path, so the app
  // will open on this church even after the query string is gone.
  location.replace('../../index.html?church=${church.slug}');
</script>
</body>
</html>
`;
}

function pickerPage(registry) {
  const sectors = ['Hope', 'Faith', 'Love'];
  const groups = sectors
    .map((sector) => {
      const cards = registry
        .filter((c) => c.sector === sector)
        .map(
          (c) => `      <a href="./${c.slug}/" style="display:flex;align-items:center;gap:.75rem;padding:.875rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:14px;text-decoration:none;color:inherit">
        <span style="flex:none;width:12px;height:12px;border-radius:50%;background:${c.accent}"></span>
        <span style="flex:1;min-width:0">
          <span style="display:block;font-weight:500;font-size:.9375rem">${c.short}</span>
          <span style="display:block;color:var(--ink-subtle);font-size:.75rem">${c.name}</span>
        </span>
        <span style="color:var(--ink-subtle)">›</span>
      </a>`
        )
        .join('\n');
      return `    <section style="margin-bottom:1.75rem">
      <h2 style="margin:0 0 .625rem;font-size:.6875rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-subtle)">${sector} Sector</h2>
      <div style="display:grid;gap:.5rem">
${cards}
      </div>
    </section>`;
    })
    .join('\n');

  return `${HEAD('FLCC BOTR Network · Choose your church')}
<main style="max-width:520px;margin:0 auto;padding:2.5rem 1.25rem 3rem">
  <header style="margin-bottom:2rem;text-align:center">
    <p style="margin:0 0 .375rem;font-size:.6875rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)">FLCC BOTR Network</p>
    <h1 class="font-display" style="margin:0 0 .5rem;font-size:1.75rem;font-weight:600">Choose your church</h1>
    <p style="margin:0;color:var(--ink-muted);font-size:.9375rem">Same app, same schedule tools — your church's own members, leaders and services.</p>
  </header>
${groups}
  <p style="margin:0;text-align:center;color:var(--ink-subtle);font-size:.75rem">Your choice is remembered on this device. You can switch any time from the About tab.</p>
</main>
</body>
</html>
`;
}

const registry = await readRegistry();
await mkdir(join(ROOT, 'c'), { recursive: true });
await writeFile(join(ROOT, 'c', 'index.html'), pickerPage(registry));
for (const church of registry) {
  const dir = join(ROOT, 'c', church.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), redirectStub(church));
}
console.log(`Wrote c/index.html and ${registry.length} church links.`);
