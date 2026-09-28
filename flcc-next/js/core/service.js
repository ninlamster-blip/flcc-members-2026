// Service day: the notes a young person keeps at church.
//
// FLCC's main service meets on Friday, the first day of the weekend in Kuwait,
// and some congregations meet on Saturday, so the Today tab offers the notes
// sheet on both. The sermon for a date comes from content/sermons.json, which a
// leader fills in from the dashboard; with no sermon entered, the sheet still
// works and the young person writes the passage down themselves.
//
// Pure: storage is read and written by the screen.

/** Days the Today tab offers the notes sheet (0 = Sunday … 5 = Friday, 6 = Saturday). */
export const SERVICE_DAYS = [5, 6];

export const isServiceDay = (day) => SERVICE_DAYS.includes(new Date(`${day}T12:00:00`).getDay());

/**
 * The sermon to show on `day`: the one dated that day, or else the most recent
 * one in the six days before it — so Saturday's congregations see Friday's.
 */
export function sermonFor(sermons, day) {
  const on = (sermons || []).filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(row.date || '') && row.date <= day);
  const latest = on.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!latest) return null;
  const age = (new Date(`${day}T12:00:00`) - new Date(`${latest.date}T12:00:00`)) / 86400000;
  return age <= 6 ? latest : null;
}

/** The four prompts on the sheet, in the order they are asked. */
export const PROMPTS = [
  { key: 'passage', label: 'The Bible passage', kids: 'Which Bible verses did we read?', teens: 'The passage, and anything in it that stood out' },
  { key: 'learned', label: 'One thing I learned', kids: 'What did you learn about God?', teens: 'The one thing worth remembering' },
  { key: 'doing', label: 'One thing I will do', kids: 'What will you do this week because of it?', teens: 'What changes this week, if you take it seriously?' },
  { key: 'question', label: 'A question I still have', kids: 'Anything you want to ask?', teens: 'What you are still not sure about' },
];

/** A note worth keeping has something written in it besides the passage. */
export const worthKeeping = (note) => PROMPTS.slice(1).some((prompt) => String(note[prompt.key] || '').trim());

/** Keep one note per day: saving again on the same day replaces it. */
export function keep(items, note) {
  return [note, ...(items || []).filter((row) => row.date !== note.date)].slice(0, 52);
}
