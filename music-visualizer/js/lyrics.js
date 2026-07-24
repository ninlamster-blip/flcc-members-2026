// Lyrics parsing. No CDN dependency — safe to import statically.
//
// Supports standard .lrc time-tagged lines ([mm:ss.xx]Some words) for real,
// accurate sync, and plain untimed text pasted straight from a lyrics site.
// Untimed text has no timing information at all, so it's spread evenly
// across the track's duration as a rough approximation — a moving
// highlight to follow along, not real line-by-line sync. Callers must keep
// that distinction visible (see the "synced" flag) rather than presenting
// an estimate as if it were accurate.

const LRC_TAG_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?\]/g;

export function parseLyrics(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  let sawTimestamp = false;

  for (const raw of rawLines) {
    LRC_TAG_RE.lastIndex = 0;
    const tags = [...raw.matchAll(LRC_TAG_RE)];
    const content = raw.replace(LRC_TAG_RE, '').trim();
    if (!content) continue;
    if (tags.length) {
      sawTimestamp = true;
      for (const tag of tags) {
        const minutes = parseInt(tag[1], 10);
        const seconds = parseInt(tag[2], 10);
        const frac = tag[3] ? parseFloat(`0.${tag[3]}`) : 0;
        lines.push({ time: minutes * 60 + seconds + frac, text: content });
      }
    } else {
      lines.push({ time: null, text: content });
    }
  }

  if (sawTimestamp) lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  return { lines, synced: sawTimestamp };
}

// Only meaningful when synced === false. Spreads untimed lines evenly
// across [2%, 96%] of the track so there's still a moving highlight —
// an estimate, not real timing.
export function estimateLyricsTiming(lines, duration) {
  if (!lines.length || !isFinite(duration) || duration <= 0) return lines;
  const start = duration * 0.02;
  const end = duration * 0.96;
  const span = Math.max(0, end - start);
  const step = lines.length > 1 ? span / (lines.length - 1) : 0;
  return lines.map((line, i) => ({ ...line, time: start + step * i }));
}

export function findActiveLineIndex(lines, currentTime) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) idx = i;
    else break;
  }
  return idx;
}
