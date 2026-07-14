// One deterministic challenge per calendar day, tracked against the current
// session's progress (level reached / lines cleared / tetrises performed).
const TEMPLATES = [
  { type: 'level', goal: 6, label: (g) => `Reach Level ${g}` },
  { type: 'lines', goal: 40, label: (g) => `Clear ${g} lines` },
  { type: 'tetris', goal: 3, label: (g) => `Perform ${g} Tetrises` },
  { type: 'level', goal: 5, label: (g) => `Reach Level ${g}` },
  { type: 'lines', goal: 25, label: (g) => `Clear ${g} lines in one session` },
  { type: 'tspin', goal: 2, label: (g) => `Land ${g} T-Spins` },
];

function seedFor(date) {
  const s = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

export function todaysChallenge(date = new Date()) {
  const seed = seedFor(date);
  const t = TEMPLATES[seed % TEMPLATES.length];
  return { day: date.toISOString().slice(0, 10), type: t.type, goal: t.goal, label: t.label(t.goal) };
}

export function evaluateProgress(challenge, session) {
  const value = {
    level: session.highestLevel,
    lines: session.linesThisSession,
    tetris: session.tetrisThisSession,
    tspin: session.tSpinThisSession,
  }[challenge.type] || 0;
  return { value, done: value >= challenge.goal };
}
