/**
 * Reaching into a single-file app.
 *
 * The FLCC apps are one HTML file each: markup, styles and a single
 * <script type="text/babel"> block holding the whole React app. That is
 * deliberate — they are served as static files with no build step — but it
 * means the logic inside them can't be `import`ed the way shepherd/js/core/*
 * can.
 *
 * So we lift named top-level declarations out of the script block by source
 * slicing and evaluate them on their own. Only pure helpers are extractable
 * this way: anything containing JSX, hooks or DOM access will not survive,
 * which is a useful constraint — it keeps the tested logic honest and pushes
 * the interesting rules out of the components.
 *
 * If a function you want isn't extractable, that's the signal to lift it to
 * the top level of the app file first, the way rosterForService and
 * upcomingOccasions were.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The contents of the app's <script type="text/babel"> block. */
export function appSource(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const open = html.indexOf('<script type="text/babel"');
  if (open === -1) throw new Error(`${file}: no babel script block`);
  const start = html.indexOf('>', open) + 1;
  const end = html.indexOf('</script>', start);
  if (end === -1) throw new Error(`${file}: unterminated script block`);
  return html.slice(start, end);
}

/** Read a whole file from the repo root. */
export function readRepoFile(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

export function readRepoJSON(file) {
  return JSON.parse(readRepoFile(file));
}

export function repoPath(file) {
  return path.join(ROOT, file);
}

export function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

/** Slice `function NAME(...) { ... }` out of `src` by matching braces.
 *  Only matches declarations at column 0, which is where the app files put
 *  their top-level helpers. */
function sliceFunction(src, name) {
  const decl = new RegExp(`^function\\s+${name}\\s*\\(`, 'm');
  const m = decl.exec(src);
  if (!m) return null;

  // Skip the parameter list before looking for the body. A destructured
  // parameter — function f({ a, b }) — opens a brace of its own, and taking
  // that one as the body silently truncates the function.
  let parens = 1;
  let i = m.index + m[0].length;   // just past the opening "("
  for (; i < src.length && parens > 0; i++) {
    if (src[i] === '(') parens++;
    else if (src[i] === ')') parens--;
  }
  const bodyStart = src.indexOf('{', i);
  if (bodyStart === -1) return null;

  // Brace matching that skips over strings, template literals, regex-ish
  // slashes and comments — enough for the helpers we extract.
  let depth = 0;
  let quote = null;
  i = bodyStart;
  let inLine = false;
  let inBlock = false;

  for (; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    const prev = src[i - 1];

    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; i++; } continue; }
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') { inLine = true; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
    void prev;
  }
  return null;
}

/** Slice a top-level `const NAME = …;` out of `src`, single line or not.
 *  Multi-line array and object literals are matched by counting brackets, so
 *  a lookup table can be tested without being flattened onto one line. */
function sliceConst(src, name) {
  const start = new RegExp(`^const\\s+${name}\\s*=`, 'm').exec(src);
  if (!start) return null;

  let depth = 0;
  let quote = null;
  for (let i = start.index; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) return src.slice(start.index, i + 1);
    else if (c === '\n' && depth === 0 && /=\s*$/.test(src.slice(start.index, i))) continue;
  }
  return null;
}

/**
 * Extract named top-level declarations from an app file and evaluate them.
 *
 *   const { getSessionSummary } = load('attendance.html', ['getSessionSummary']);
 *
 * Names may be functions or single-line consts. Throws with a clear message
 * when a name isn't found or isn't extractable, so a rename in the app file
 * fails the suite loudly instead of silently testing nothing.
 *
 * `globals` supplies anything the extracted code closes over that the app
 * would otherwise provide — `CHURCH`, for instance, which is `window.FLCC` in
 * the running page:
 *
 *   load('attendance.html', ['buildAttendanceJSON'], { CHURCH: { name: 'FLCC - Test' } })
 */
export function load(file, names, globals = {}) {
  const src = appSource(file);
  const parts = [];

  for (const key of Object.keys(globals)) {
    parts.push(`const ${key} = __globals__[${JSON.stringify(key)}];`);
  }

  for (const name of names) {
    const code = sliceFunction(src, name) ?? sliceConst(src, name);
    if (!code) {
      throw new Error(
        `${file}: could not extract "${name}". It must be a top-level ` +
        `function declaration or single-line const in the babel block. ` +
        `If it moved or was renamed, update the test; if it's now inside a ` +
        `component, lift it back to the top level.`
      );
    }
    parts.push(code);
  }

  parts.push(`return { ${names.join(', ')} };`);

  try {
    return new Function('__globals__', parts.join('\n\n'))(globals);
  } catch (err) {
    throw new Error(`${file}: extracted source failed to evaluate — ${err.message}`);
  }
}

/**
 * Evaluate church.js against a fake browser at `href`, returning its FLCC
 * global. church.js is a plain IIFE that only touches window.location and
 * localStorage, so a couple of stubs are enough — and testing the real file
 * beats re-describing the registry in the tests.
 */
export function loadChurch(href = 'https://example.org/index.html') {
  const url = new URL(href);
  const store = new Map();
  const win = {
    location: { pathname: url.pathname, search: url.search, origin: url.origin, href },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
  };
  const src = readRepoFile('church.js');
  new Function('window', 'URLSearchParams', 'localStorage', src)(win, URLSearchParams, win.localStorage);
  if (!win.FLCC) throw new Error('church.js did not define window.FLCC');
  return win.FLCC;
}
