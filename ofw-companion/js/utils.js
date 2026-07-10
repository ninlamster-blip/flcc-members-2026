// Shared helpers for FLCC Kasama.

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function friendlyDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  const today = todayKey();
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Minimal markdown → HTML for AI replies: paragraphs, **bold**, *italic*. Everything else stays literal.
export function renderRichText(str) {
  const safe = escapeHtml(str).trim();
  return safe
    .split(/\n{2,}/)
    .map((para) => `<p>${para
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function firstNameOf(name) {
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed.split(/\s+/)[0] : '';
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

// Signals of acute distress. Matching any of these opens the crisis support
// sheet alongside (never instead of) the companion's response.
const CRISIS_PATTERNS = [
  /suicid/i, /kill (myself|my self)/i, /end (my|it all|my life)/i, /hurt myself/i,
  /self[- ]harm/i, /no reason to live/i, /better off dead/i, /want to die/i, /wanna die/i,
  /magpakamatay/i, /magpapakamatay/i, /ayoko nang mabuhay/i, /ayaw ko nang mabuhay/i,
  /wala nang kwenta ang buhay/i, /gusto ko nang mamatay/i, /sasaktan ko ang sarili/i
];

export function detectsCrisis(text) {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

// Lightweight heart-state classifier used for offline comfort, verse and
// prayer selection. The AI does the nuanced work when connected; this only
// needs to be roughly right, and to never punish a wrong guess.
const EMOTION_KEYWORDS = {
  lonely: [/lonel/i, /alone/i, /nobody/i, /no one/i, /forgotten/i, /nag-?iisa/i, /mag-?isa/i, /walang kasama/i, /walang kausap/i],
  homesick: [/miss/i, /home ?sick/i, /umuwi/i, /uwi/i, /namimiss/i, /na-?miss/i, /anak/i, /asawa/i, /pamilya/i, /family/i, /birthday.*(missed|hindi)/i, /pasko/i, /christmas/i, /celebration/i],
  exhausted: [/tired/i, /exhaust/i, /pagod/i, /empty/i, /no energy/i, /burn(ed|t)? ?out/i, /wala nang lakas/i, /puyat/i, /drained/i],
  invisible: [/invisible/i, /appreciat/i, /only my work/i, /walang pumapansin/i, /hindi.*pinapansin/i, /parang alipin/i, /parang robot/i, /unseen/i, /walang kwenta/i],
  anxious: [/anxi/i, /worr/i, /afraid/i, /scared/i, /fear/i, /kaba/i, /takot/i, /what if/i, /paano kung/i, /lose my job/i, /matanggal/i, /visa/i, /contract/i],
  heavy: [/sad/i, /cry/i, /iyak/i, /umiiyak/i, /malungkot/i, /lungkot/i, /heavy/i, /mabigat/i, /depress/i, /broken/i, /hurt/i, /masakit/i, /sakit ng loob/i, /problema/i],
  grateful: [/grateful/i, /thankful/i, /salamat/i, /blessed/i, /blessing/i, /pasasalamat/i],
  happy: [/happy/i, /masaya/i, /saya/i, /good news/i, /magandang balita/i, /excited/i, /promoted/i, /nakapasa/i, /graduat/i]
};

export function classifyHeart(text) {
  const scores = {};
  for (const [emotion, patterns] of Object.entries(EMOTION_KEYWORDS)) {
    scores[emotion] = patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
  }
  let best = 'neutral';
  let bestScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > bestScore) { best = emotion; bestScore = score; }
  }
  return best;
}
