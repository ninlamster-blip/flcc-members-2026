#!/usr/bin/env node
/* Onboard a church onto the shared app.
 *
 *   node scripts/new-church.mjs "FLCC - Living Hope" living-hope Love [#0F766E]
 *
 * Adds it to the registry in church.js, scaffolds churches/<slug>/ from
 * churches/_template/, and regenerates the /c/ links. Nothing else to do —
 * its leaders publish members and schedules from the same editors everyone
 * else uses, and the app is the same app.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, addToRegistry } from './lib/registry.mjs';
import { execFileSync } from 'node:child_process';

const [, , name, slug, sector, accent = '#A33B2A'] = process.argv;

if (!name || !slug || !sector) {
  console.error('usage: node scripts/new-church.mjs "<Display Name>" <slug> <Hope|Faith|Love> [#accent]');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`slug must be lowercase letters, numbers and dashes — got "${slug}"`);
  process.exit(1);
}
if (!['Hope', 'Faith', 'Love'].includes(sector)) {
  console.error(`sector must be Hope, Faith or Love — got "${sector}"`);
  process.exit(1);
}

// Only the files every church needs on day one. Copy the other ministry files
// out of churches/_template/ when that ministry starts — until the file exists,
// the app simply hides that tab.
const DAY_ONE = ['data.json', 'attendance.json'];

const templateDir = join(ROOT, 'churches', '_template');
const churchDir = join(ROOT, 'churches', slug);
const available = await readdir(templateDir);

await mkdir(churchDir, { recursive: true });
for (const file of DAY_ONE) {
  if (!available.includes(file)) continue;
  const json = JSON.parse(await readFile(join(templateDir, file), 'utf8'));
  if (json.meta) json.meta.churchName = name;
  await writeFile(join(churchDir, file), JSON.stringify(json, null, 2) + '\n');
}

const short = name.replace(/^FLCC\s*-\s*/, '').trim() || name;
await addToRegistry({ slug, name, short, sector, accent });

execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-church-links.mjs')], { stdio: 'inherit' });

console.log(`
Added ${name}
  data     churches/${slug}/       (${DAY_ONE.join(', ')})
  link     /c/${slug}/
  more     copy churches/_template/{prayer,music,worship,equip}.json in when
           that ministry starts

Commit the new files, then send the link to their leader.`);
