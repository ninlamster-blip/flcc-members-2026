/**
 * The data model.
 *
 * Every AI-generated object — a decision, an action item, a topic, an answer
 * — carries `segmentIds`: the transcript segments it came from. That field is
 * not decoration and not optional. It is what makes an answer checkable, and
 * `intelligence.js` drops anything the model returns without one.
 */

/** @type {Record<string, {label: string, title?: string, searchable?: string[]}>} */
export const COLLECTIONS = {
  meetings:  { label: 'Meetings', title: 'title', searchable: ['title', 'summary', 'notes'] },
  segments:  { label: 'Transcript', title: 'text', searchable: ['text'] },
  speakers:  { label: 'Speakers', title: 'label' },
  people:    { label: 'People', title: 'name', searchable: ['name'] },
  decisions: { label: 'Decisions', title: 'text', searchable: ['text'] },
  actions:   { label: 'Action items', title: 'task', searchable: ['task', 'context'] },
  questions: { label: 'Open questions', title: 'text', searchable: ['text'] },
  topics:    { label: 'Topics', title: 'name', searchable: ['name'] },
  moments:   { label: 'Key moments', title: 'label', searchable: ['label'] },
  notes:     { label: 'Notes', title: 'text', searchable: ['text'] },
  folders:   { label: 'Folders', title: 'name' },
  memory:    { label: 'AI Memory', title: 'question', searchable: ['question', 'answer'] },
};

/** Meeting lifecycle. `status` is the single source of truth for what a
 *  meeting row shows, and every one of these states is reachable. */
export const MEETING_STATUS = {
  recording:   'Recording',
  transcribing:'Transcribing',
  processing:  'Processing',
  ready:       'Ready',
  failed:      'Needs attention',
};

export const ACTION_STATUS = { open: 'Open', done: 'Completed' };

const NOW = () => new Date().toISOString();

const DEFAULTS = {
  meetings: () => ({
    title: '', startedAt: NOW(), durationSec: 0, status: 'recording',
    audioId: null, audioType: '', audioBytes: 0,
    summary: '', keyPoints: [], participantIds: [], folderId: null,
    favorite: false, archived: false, language: 'en',
    transcriptSource: '', processedAt: null, error: null, notes: '',
  }),
  segments: () => ({
    meetingId: '', speakerId: '', start: 0, end: 0, text: '',
    confidence: null, edited: false, createdAt: NOW(),
  }),
  // A speaker is per-meeting ("Speaker 2 in Tuesday's call"); linking it to a
  // person is a separate, reversible act, which is why personId is nullable.
  speakers: () => ({ meetingId: '', label: '', personId: null, order: 0 }),
  people:   () => ({ name: '', aliases: [], createdAt: NOW() }),
  decisions:() => ({ meetingId: '', text: '', segmentIds: [], createdAt: NOW() }),
  actions:  () => ({
    meetingId: '', task: '', ownerName: '', personId: null, dueDate: null,
    context: '', segmentIds: [], status: 'open', createdAt: NOW(), completedAt: null,
  }),
  questions:() => ({ meetingId: '', text: '', segmentIds: [], resolved: false, createdAt: NOW() }),
  topics:   () => ({ meetingId: '', name: '', segmentIds: [] }),
  moments:  () => ({ meetingId: '', label: '', segmentIds: [], bookmarked: false, createdAt: NOW() }),
  notes:    () => ({ meetingId: '', segmentId: null, text: '', createdAt: NOW() }),
  folders:  () => ({ name: '', createdAt: NOW() }),
  memory:   () => ({ question: '', answer: '', sources: [], scope: 'all', meetingId: null, createdAt: NOW() }),
};

/** A new record of `collection`, with `values` layered on the defaults. */
export function blank(collection, values = {}) {
  const make = DEFAULTS[collection];
  if (!make) throw new Error(`Unknown collection: ${collection}`);
  return { ...make(), ...values };
}

/** Validation is deliberately thin: enough to keep a broken write out of the
 *  store, not a second copy of the type system. */
export function validate(collection, record) {
  const errors = [];
  if (!DEFAULTS[collection]) errors.push(`Unknown collection ${collection}`);
  if (collection === 'meetings') {
    if (!String(record.title || '').trim()) errors.push('A meeting needs a title.');
    if (!MEETING_STATUS[record.status]) errors.push(`Unknown status ${record.status}`);
  }
  if (collection === 'segments') {
    if (!record.meetingId) errors.push('A segment must belong to a meeting.');
    if (!(Number(record.end) >= Number(record.start))) errors.push('A segment ends after it starts.');
  }
  if (collection === 'actions') {
    if (!String(record.task || '').trim()) errors.push('An action item needs a task.');
    if (!ACTION_STATUS[record.status]) errors.push(`Unknown status ${record.status}`);
  }
  for (const key of ['decisions', 'actions', 'questions', 'topics', 'moments']) {
    if (collection === key && !Array.isArray(record.segmentIds)) {
      errors.push('Generated records must reference their transcript segments.');
    }
  }
  return errors;
}
