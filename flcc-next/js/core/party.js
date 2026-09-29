// Play together, on one phone: 2 to 4 players take turns answering.
//
// Pass-and-play needs no server and sends nothing anywhere — the names typed
// here are forgotten when the round ends. Pure, so turn order and scoring can
// be tested without a browser.

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const PER_PLAYER = 5;          // questions each, so a round is short enough for a Kids Club corner
export const NAME_LENGTH = 16;

/** Clean up what was typed: trimmed, short, and never empty or a duplicate. */
export function names(typed) {
  const out = [];
  for (const raw of typed || []) {
    let name = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, NAME_LENGTH);
    if (!name) continue;
    const base = name;
    for (let n = 2; out.includes(name); n++) name = `${base} ${n}`;
    out.push(name);
  }
  return out.slice(0, MAX_PLAYERS);
}

/** A new round for these players, over these questions (one each, in turn). */
export function create(players, questions) {
  const list = names(players);
  if (list.length < MIN_PLAYERS) throw new Error(`Play together needs at least ${MIN_PLAYERS} players`);
  const turns = Math.min(questions.length, list.length * PER_PLAYER);
  return {
    players: list.map((name) => ({ name, score: 0 })),
    questions: questions.slice(0, turns - (turns % list.length)),
    turn: 0,
  };
}

/** Whose turn it is, and what they are asked, or null when the round is over. */
export function current(game) {
  if (game.turn >= game.questions.length) return null;
  return { player: game.players[game.turn % game.players.length], question: game.questions[game.turn], number: game.turn + 1 };
}

/** Record an answer for whoever's turn it is, and move on. */
export function answer(game, right) {
  const now = current(game);
  if (!now) return game;
  if (right) now.player.score += 1;
  game.turn += 1;
  return game;
}

/**
 * The final standings, best first, with everyone on the top score sharing
 * first place — a draw is a draw, not a coin toss.
 */
export function standings(game) {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const top = sorted.length ? sorted[0].score : 0;
  return { sorted, winners: sorted.filter((p) => p.score === top), outOf: game.questions.length / game.players.length };
}
