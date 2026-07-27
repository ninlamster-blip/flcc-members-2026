/* Read and edit the church registry that lives inside church.js.
   church.js is the single source of truth: it has to be a plain <script> the
   browser can run synchronously, so the registry lives there rather than in a
   .json file the pages would have to fetch before they could load any data. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CHURCH_JS = join(ROOT, 'church.js');

const START = '/* REGISTRY-START';
const END = '/* REGISTRY-END */';

function slice(src) {
  const s = src.indexOf(START);
  const e = src.indexOf(END);
  if (s === -1 || e === -1) throw new Error('church.js: registry markers not found');
  const openBracket = src.indexOf('[', s);
  const closeBracket = src.lastIndexOf(']', e);
  return { openBracket, closeBracket, literal: src.slice(openBracket, closeBracket + 1) };
}

export async function readRegistry() {
  const src = await readFile(CHURCH_JS, 'utf8');
  const { literal } = slice(src);
  // Local build script reading a literal we control — an array literal is all
  // it can be, the markers sit inside a comment block in our own source.
  return new Function(`return ${literal}`)();
}

export async function addToRegistry(entry) {
  const src = await readFile(CHURCH_JS, 'utf8');
  const { closeBracket } = slice(src);
  const existing = await readRegistry();
  if (existing.some((c) => c.slug === entry.slug)) {
    throw new Error(`church "${entry.slug}" is already in the registry`);
  }
  const line =
    `    { slug: '${entry.slug}', name: '${entry.name.replace(/'/g, "\\'")}', ` +
    `short: '${entry.short.replace(/'/g, "\\'")}', sector: '${entry.sector}', ` +
    `dataBase: './churches/${entry.slug}', accent: '${entry.accent}' },\n`;
  // Keep the closing bracket's own indentation intact.
  const head = src.slice(0, closeBracket).replace(/[ \t]*$/, '');
  const out = head + line + '  ' + src.slice(closeBracket);
  await writeFile(CHURCH_JS, out);
  return entry;
}
