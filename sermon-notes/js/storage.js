/* =============================================================================
   STORAGE — the member's own device, and nowhere else.
   -----------------------------------------------------------------------------
   Sermon notes are private. Nothing here is uploaded, there is no account, and
   the only thing that ever leaves the phone is what the member themselves taps
   Share on.

   The key is `flcc-sermon-notes-v1`, namespaced per church by FLCC.key() — the
   same key, and the same `date|Service` note ids, that the members app has
   always used. This app is a second door onto one set of notes, not a second
   set: notes written in either one open in the other.

   Two things follow from sharing storage with an older writer, and both are
   deliberate:

     · A save spreads the stored note first, so fields this app knows nothing
       about survive it. The members app does the same, which is why the
       passage, verses and takeaway added here are not lost when a note is
       later opened over there.

     · A body written in the members app is contentEditable HTML. It is read as
       text (notes.js) but only written back as text once the member has
       actually typed something. Opening an old note and closing it again
       leaves it byte for byte as it was.
   ========================================================================== */

const NOTES_KEY = 'flcc-sermon-notes-v1';
const CACHE_KEY = 'flcc-sermon-notes-schedule-v1';

/** church.js namespaces every key. Without it — a test, a file:// page opened
 *  on its own — the un-prefixed key is the right answer anyway. */
function key(name) {
  return (typeof window !== 'undefined' && window.FLCC && window.FLCC.key) ? window.FLCC.key(name) : name;
}

function read(name, fallback) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    // Private mode, or a full quota. The note stays on screen and in memory;
    // saying so is the app's job, not this function's.
    return false;
  }
}

/* ── Notes ────────────────────────────────────────────────────────────────── */

export function loadNotes() {
  const notes = read(NOTES_KEY, {});
  return notes && typeof notes === 'object' ? notes : {};
}

export function loadNote(id) {
  return loadNotes()[id] || null;
}

/**
 * Save one note. `patch` carries only the fields that changed, so a note is
 * never flattened by a screen that happened not to know about a field.
 * Returns false when the device refused to store it.
 */
export function saveNote(id, patch) {
  const notes = loadNotes();
  const existing = notes[id] || {};
  const now = new Date().toISOString();
  notes[id] = {
    ...existing,
    ...patch,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  return write(NOTES_KEY, notes);
}

export function deleteNote(id) {
  const notes = loadNotes();
  delete notes[id];
  return write(NOTES_KEY, notes);
}

/* ── The schedule, kept for the next time there is no signal ──────────────── */

/**
 * The schedule is fetched fresh on every open, with ?t=, so a republished one
 * reaches members the same day — which means there is nothing cached to fall
 * back on when the signal is gone, and a church hall with no signal is exactly
 * where this app has to open. So the handful of fields a note needs — date,
 * service, preacher, theme — are kept here after every successful load. This
 * rather than the service worker's cache, because it survives the worker being
 * evicted and is there on the very first offline open.
 */
export function cacheServices(services) {
  write(CACHE_KEY, { at: new Date().toISOString(), services });
}

export function cachedServices() {
  const cached = read(CACHE_KEY, null);
  return cached && Array.isArray(cached.services) ? cached : null;
}
