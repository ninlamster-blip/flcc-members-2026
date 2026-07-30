/**
 * The data model.
 *
 * One place describes every collection: which permission resource guards it,
 * whether it is encrypted at rest, which fields are searchable, and what a
 * valid record looks like. The database, the search index, the exporters and
 * the audit log all read this — adding a collection is a single edit here
 * plus a module that uses it.
 *
 * Field types: `string` `text` `number` `money` `bool` `date` `datetime`
 * `enum` `ref` `list` `object`.
 */

/**
 * @typedef {object} FieldDef
 * @property {string} label
 * @property {string} type
 * @property {boolean} [required]
 * @property {string[]} [options]
 * @property {string} [ref]        collection name for `ref`/`list<ref>`
 * @property {unknown} [default]
 * @property {string} [help]
 *
 * @typedef {object} CollectionDef
 * @property {string} label
 * @property {string} resource      RBAC resource guarding it
 * @property {boolean} [encrypted]  AES-GCM at rest
 * @property {string[]} [searchable] fields fed to the global index
 * @property {string} [titleField]
 * @property {Record<string, FieldDef>} fields
 */

import {
  canWriteActionItem, canWriteAnnualPlan, canWriteEnrollment, canAccessJournalEntry, canAccessOwnPreferences,
} from './policies.js';

/**
 * The two recurring worship services every BOTR church runs, plus room for
 * an administrator to record something else (a Christmas Eve service, a
 * baptism Sunday) without inventing a new enum value for every one-off.
 */
export const SERVICE_TYPES = ['friday', 'sunday', 'other'];

/** Equip's course categories — discipleship and ministry training, not just Bible knowledge. */
export const EQUIP_CATEGORIES = [
  'Foundations of the Christian Faith', 'Discipleship', 'Leadership Development', 'Evangelism',
  'Prayer', 'Bible Study', 'Worship Ministry', "Children's Ministry", 'Youth Ministry',
  'Marriage & Family', 'Finance & Stewardship', 'Church Administration', 'Pastoral Care',
  'Missions', 'Apologetics', 'Spiritual Formation',
];

const person = {
  fullName:     { label: 'Full name', type: 'string', required: true },
  preferredName:{ label: 'Preferred name', type: 'string' },
  gender:       { label: 'Gender', type: 'enum', options: ['female', 'male', 'unspecified'], default: 'unspecified' },
  birthDate:    { label: 'Date of birth', type: 'date' },
  phone:        { label: 'Mobile', type: 'string' },
  whatsapp:     { label: 'WhatsApp', type: 'string' },
  email:        { label: 'Email', type: 'string' },
  nationality:  { label: 'Nationality', type: 'string' },
  language:     { label: 'Preferred language', type: 'enum', options: ['English', 'Arabic', 'Tagalog', 'Hindi', 'Malayalam', 'Urdu'], default: 'English' },
  area:         { label: 'Area', type: 'string', help: 'Governorate or district — used for care visits and transport.' },
};

/** @type {Record<string, CollectionDef>} */
export const COLLECTIONS = {
  members: {
    label: 'Members',
    resource: 'members',
    titleField: 'fullName',
    searchable: ['fullName', 'preferredName', 'phone', 'email', 'ministries', 'notes'],
    fields: {
      ...person,
      status:        { label: 'Membership status', type: 'enum', required: true, options: ['visitor', 'regular', 'member', 'inactive', 'transferred'], default: 'visitor' },
      joinedOn:      { label: 'First visit', type: 'date' },
      membershipDate:{ label: 'Membership date', type: 'date' },
      baptised:      { label: 'Baptised', type: 'bool', default: false },
      baptismDate:   { label: 'Baptism date', type: 'date' },
      newBeliever:   { label: 'New believer', type: 'bool', default: false },
      maritalStatus: { label: 'Marital status', type: 'enum', options: ['single', 'married', 'widowed', 'separated'], default: 'single' },
      anniversary:   { label: 'Wedding anniversary', type: 'date' },
      familyId:      { label: 'Family', type: 'ref', ref: 'families' },
      familyRole:    { label: 'Role in family', type: 'enum', options: ['head', 'spouse', 'child', 'relative', 'other'], default: 'other' },
      ministries:    { label: 'Ministries', type: 'list' },
      spiritualGifts:{ label: 'Gifts & skills', type: 'list' },
      emergencyName:  { label: 'Emergency contact', type: 'string' },
      emergencyPhone: { label: 'Emergency phone', type: 'string' },
      emergencyRelation: { label: 'Relationship', type: 'string' },
      careLevel:     { label: 'Care level', type: 'enum', options: ['none', 'watch', 'priority'], default: 'none' },
      awayUntil:     { label: 'Away until', type: 'date', help: 'Set when someone is travelling or unavailable to serve — the rota suggestion skips them until this date.' },
      notes:         { label: 'General notes', type: 'text', help: 'Non-confidential. Counselling notes live in their own permissioned file.' },
      photoColor:    { label: 'Avatar colour', type: 'string' },
      learningGoal:  { label: 'Annual learning goal (courses)', type: 'number', help: 'Used by Equip → My Learning to show progress toward a yearly target.' },
      archived:      { label: 'Archived', type: 'bool', default: false },
    },
  },

  families: {
    label: 'Families',
    resource: 'members',
    titleField: 'name',
    searchable: ['name', 'address'],
    fields: {
      name:    { label: 'Family name', type: 'string', required: true },
      address: { label: 'Address', type: 'text' },
      area:    { label: 'Area', type: 'string' },
      phone:   { label: 'Home phone', type: 'string' },
      notes:   { label: 'Notes', type: 'text' },
    },
  },

  attendance: {
    label: 'Attendance',
    resource: 'members',
    titleField: 'date',
    fields: {
      date:      { label: 'Date', type: 'date', required: true },
      service:   { label: 'Service', type: 'string', required: true, default: 'Sunday Worship' },
      memberIds: { label: 'Present', type: 'list', ref: 'members' },
      visitors:  { label: 'Visitors', type: 'number', default: 0 },
      total:     { label: 'Total present', type: 'number', default: 0 },
      notes:     { label: 'Notes', type: 'text' },
    },
  },

  care: {
    label: 'Care & follow-ups',
    resource: 'care',
    titleField: 'summary',
    searchable: ['summary', 'detail'],
    fields: {
      memberId:  { label: 'Person', type: 'ref', ref: 'members', required: true },
      type:      { label: 'Type', type: 'enum', required: true, options: ['follow-up', 'visit', 'call', 'message', 'hospital', 'bereavement', 'need'], default: 'follow-up' },
      summary:   { label: 'Summary', type: 'string', required: true },
      detail:    { label: 'Detail', type: 'text' },
      dueDate:   { label: 'Due', type: 'date' },
      completedAt: { label: 'Completed', type: 'datetime' },
      assignedTo:{ label: 'Assigned to', type: 'ref', ref: 'users' },
      outcome:   { label: 'Outcome', type: 'text' },
      priority:  { label: 'Priority', type: 'enum', options: ['low', 'normal', 'urgent'], default: 'normal' },
    },
  },

  counseling: {
    label: 'Counselling notes',
    resource: 'counseling',
    encrypted: true,
    titleField: 'subject',
    fields: {
      memberId:  { label: 'Person', type: 'ref', ref: 'members', required: true },
      date:      { label: 'Session date', type: 'date', required: true },
      subject:   { label: 'Subject', type: 'string', required: true },
      notes:     { label: 'Notes', type: 'text' },
      followUp:  { label: 'Follow-up plan', type: 'text' },
      restricted:{ label: 'Restrict to author', type: 'bool', default: true, help: 'Only the author and the senior pastor can open a restricted note.' },
    },
  },

  ministries: {
    label: 'Ministries',
    resource: 'members',
    titleField: 'name',
    searchable: ['name', 'purpose'],
    fields: {
      name:     { label: 'Ministry', type: 'string', required: true },
      purpose:  { label: 'Purpose', type: 'text' },
      leadId:   { label: 'Ministry head', type: 'ref', ref: 'members' },
      deputyId: { label: 'Deputy / second-in-command', type: 'ref', ref: 'members', help: 'Optional — who could step in if the lead had to step back. Feeds succession planning.' },
      meetingDay: { label: 'Meets', type: 'string' },
      active:   { label: 'Active', type: 'bool', default: true },
      minVolunteers: { label: 'Volunteers needed', type: 'number', default: 0 },
    },
  },

  committees: {
    label: 'Committees',
    resource: 'leadership',
    titleField: 'name',
    searchable: ['name', 'mandate'],
    fields: {
      name:    { label: 'Committee', type: 'string', required: true },
      mandate: { label: 'Mandate', type: 'text' },
      chairId: { label: 'Chair', type: 'ref', ref: 'members' },
      deputyChairId: { label: 'Deputy chair', type: 'ref', ref: 'members', help: 'Optional — feeds succession planning.' },
      memberIds: { label: 'Members', type: 'list', ref: 'members' },
      cadence: { label: 'Meets', type: 'string' },
    },
  },

  meetings: {
    label: 'Meetings',
    resource: 'leadership',
    titleField: 'title',
    searchable: ['title', 'agenda', 'minutes', 'summary'],
    fields: {
      title:     { label: 'Title', type: 'string', required: true },
      date:      { label: 'Date', type: 'datetime', required: true },
      committeeId: { label: 'Committee', type: 'ref', ref: 'committees' },
      attendees: { label: 'Attendees', type: 'list', ref: 'members' },
      agenda:    { label: 'Agenda', type: 'text' },
      minutes:   { label: 'Minutes', type: 'text' },
      summary:   { label: 'Summary', type: 'text' },
      confidential: { label: 'Leadership only', type: 'bool', default: false },
      aiGenerated: { label: 'Contains AI draft', type: 'bool', default: false },
    },
  },

  actionItems: {
    label: 'Action items',
    resource: 'leadership',
    titleField: 'title',
    searchable: ['title', 'detail'],
    instanceWrite: canWriteActionItem,
    fields: {
      title:    { label: 'Action', type: 'string', required: true },
      detail:   { label: 'Detail', type: 'text' },
      meetingId:{ label: 'From meeting', type: 'ref', ref: 'meetings' },
      ministryId: { label: 'Ministry', type: 'ref', ref: 'ministries', help: 'Optional — links this action to a ministry workspace.' },
      ownerId:  { label: 'Owner', type: 'ref', ref: 'members' },
      dueDate:  { label: 'Due', type: 'date' },
      status:   { label: 'Status', type: 'enum', options: ['open', 'in-progress', 'done', 'dropped'], default: 'open' },
    },
  },

  decisions: {
    label: 'Decision log',
    resource: 'leadership',
    titleField: 'title',
    searchable: ['title', 'decision', 'rationale'],
    fields: {
      title:     { label: 'Decision', type: 'string', required: true },
      date:      { label: 'Decided on', type: 'date', required: true },
      decision:  { label: 'What was decided', type: 'text', required: true },
      rationale: { label: 'Why', type: 'text' },
      meetingId: { label: 'Meeting', type: 'ref', ref: 'meetings' },
      area:      { label: 'Area', type: 'string' },
      reviewOn:  { label: 'Review on', type: 'date' },
    },
  },

  /**
   * A personal reflection, not a shared record — see `canAccessJournalEntry`
   * in policies.js. Its own resource on purpose: no role, including
   * church_admin and senior_pastor, is ever granted `journal:write` in
   * rbac.js — reusing `leadership`'s resource would let their blanket
   * `leadership:write`/`leadership:*` bypass `instanceWrite` entirely, since
   * a resource-level grant is checked before it. Every write, for every
   * role, goes through `instanceWrite` alone, which only ever admits the
   * entry's own author. The same function filters what the journal tab ever
   * queries, so no one else's entry is even displayed. Deliberately not
   * `searchable`: see `journal` in `NEVER_INDEXED` below.
   */
  journal: {
    label: 'Leadership journal',
    resource: 'journal',
    encrypted: true,
    instanceWrite: canAccessJournalEntry,
    titleField: 'title',
    fields: {
      title:    { label: 'Title', type: 'string', required: true },
      date:     { label: 'Date', type: 'date', required: true },
      entry:    { label: 'Entry', type: 'text', required: true },
      tags:     { label: 'Tags', type: 'list' },
      linkedDecisionId: { label: 'Related decision', type: 'ref', ref: 'decisions' },
      linkedMeetingId:  { label: 'Related meeting', type: 'ref', ref: 'meetings' },
    },
  },

  /**
   * One row per (user, insight-kind) dismissal — not one row per user with a
   * growing array, so each dismissal is its own auditable record. Recording
   * `detail` alongside it is what makes this "smart": `activeNotifications`
   * in ai.js brings the insight back the moment the underlying facts change
   * (a different count, a different name), rather than silencing a category
   * forever after one look. `resource: 'dashboard'` reuses the widely-held
   * `dashboard:read`; only `canAccessOwnPreferences` (self-only) governs the
   * write, since a dismissal is a personal "I've seen this," not a shared
   * record for anyone else to edit.
   */
  dismissals: {
    label: 'Dismissed insights',
    resource: 'dashboard',
    instanceWrite: canAccessOwnPreferences,
    titleField: 'insightId',
    fields: {
      insightId: { label: 'Insight', type: 'string', required: true },
      detail:    { label: 'Detail at dismissal', type: 'text' },
    },
  },

  /** One row per user: personal dashboard preferences, self-owned like `dismissals`. */
  preferences: {
    label: 'Dashboard preferences',
    resource: 'dashboard',
    instanceWrite: canAccessOwnPreferences,
    titleField: 'id',
    fields: {
      browserNotifications: { label: 'Browser notifications for urgent insights', type: 'bool', default: false },
    },
  },

  goals: {
    label: 'Goals',
    resource: 'leadership',
    titleField: 'title',
    searchable: ['title', 'detail'],
    fields: {
      title:   { label: 'Goal', type: 'string', required: true },
      detail:  { label: 'Detail', type: 'text' },
      year:    { label: 'Year', type: 'number' },
      ownerId: { label: 'Owner', type: 'ref', ref: 'members' },
      ministryId: { label: 'Ministry', type: 'ref', ref: 'ministries', help: 'Optional — feeds this goal into that ministry\'s health score.' },
      target:  { label: 'Target', type: 'number', default: 100 },
      progress:{ label: 'Progress', type: 'number', default: 0 },
      unit:    { label: 'Unit', type: 'string', default: '%' },
      status:  { label: 'Status', type: 'enum', options: ['planned', 'active', 'achieved', 'paused'], default: 'active' },
    },
  },

  serviceSchedule: {
    label: 'Service schedule',
    resource: 'worship',
    titleField: 'service',
    searchable: ['service', 'theme', 'scripture', 'notes'],
    fields: {
      // General information
      date:            { label: 'Date', type: 'date', required: true },
      serviceType:     { label: 'Service type', type: 'enum', options: SERVICE_TYPES, default: 'friday', required: true },
      service:         { label: 'Service title', type: 'string', required: true, default: 'Friday Worship' },
      theme:           { label: 'Theme', type: 'string' },
      scripture:       { label: 'Scripture', type: 'string' },
      preacherId:      { label: 'Preacher', type: 'ref', ref: 'members' },
      presidingLeaderId: { label: 'Presiding leader', type: 'ref', ref: 'members' },
      notes:           { label: 'Notes', type: 'text' },

      // Worship team — one combined role, not two
      worshipSongLeaderId: { label: 'Worship & Song Leader', type: 'ref', ref: 'members' },

      // Emcee — opening prayer and the tithes & offering exhortation are the
      // emcee's job, not separate roles to staff.
      emceeId:         { label: 'Emcee', type: 'ref', ref: 'members' },

      // Some churches assign the pastoral/opening prayer as its own named
      // role rather than folding it into the emcee's job — this sits
      // alongside the emcee model rather than replacing it, so either fits.
      pastoralPrayerId: { label: 'Pastoral prayer', type: 'ref', ref: 'members' },

      // Communion — not every week; see policies.isCommunionScheduled.
      communionOverride:   {
        label: 'Communion', type: 'enum', options: ['auto', 'yes', 'no'], default: 'auto',
        help: 'Automatic: the first Friday and first Sunday of each month. Override only for an exception.',
      },
      communionMinisterId: { label: 'Assigned minister', type: 'ref', ref: 'members' },
      communionNotes:      { label: 'Preparation notes', type: 'text' },
      communionChecklist:  { label: 'Elements checklist', type: 'list' },

      // Children & Youth — handled together during the service, not as
      // separate assignments.
      childrenYouthLeaderId:    { label: 'Leader', type: 'ref', ref: 'members' },
      childrenYouthAssistantId: { label: 'Assistant', type: 'ref', ref: 'members' },
      childrenYouthClassroom:   { label: 'Classroom', type: 'string' },
      childrenYouthAttendance:  { label: 'Attendance', type: 'number' },
      childrenYouthLesson:      { label: 'Lesson', type: 'string' },
      childrenYouthNotes:       { label: 'Notes', type: 'text' },

      // Additional roles
      mediaId:         { label: 'Media', type: 'ref', ref: 'members' },
      soundId:         { label: 'Sound', type: 'ref', ref: 'members' },
      usherId:         { label: 'Usher', type: 'ref', ref: 'members' },
      securityId:      { label: 'Security', type: 'ref', ref: 'members' },
      hospitalityId:   { label: 'Hospitality', type: 'ref', ref: 'members' },
      prayerTeamId:    { label: 'Prayer team', type: 'ref', ref: 'members' },
      parkingId:       { label: 'Parking', type: 'ref', ref: 'members' },
      photographyId:   { label: 'Photography', type: 'ref', ref: 'members' },
      foodInCharge:    { label: 'Food in charge', type: 'string', help: 'Often a family or a pair, not one person — free text rather than a single member.' },

      // Planning
      rehearsalAt:     { label: 'Rehearsal / practice', type: 'datetime' },
      orderOfService:  { label: 'Order of service', type: 'text' },
      status:          { label: 'Status', type: 'enum', options: ['planning', 'confirmed', 'completed', 'cancelled'], default: 'planning' },
    },
  },

  annualPlans: {
    label: 'Annual plans',
    resource: 'leadership',
    titleField: 'title',
    searchable: ['title', 'vision', 'objectives'],
    instanceWrite: canWriteAnnualPlan,
    fields: {
      ministryId:  { label: 'Ministry', type: 'ref', ref: 'ministries', required: true },
      year:        { label: 'Year', type: 'number', required: true },
      title:       { label: 'Plan title', type: 'string', required: true },
      vision:      { label: 'Vision', type: 'text' },
      objectives:  { label: 'Objectives', type: 'list' },
      kpis:        { label: 'KPIs', type: 'list' },
      budget:      { label: 'Budget', type: 'money', default: 0 },
      volunteerNeeds: { label: 'Volunteer needs', type: 'text' },
      q1Review:    { label: 'Q1 review', type: 'text' },
      q2Review:    { label: 'Q2 review', type: 'text' },
      q3Review:    { label: 'Q3 review', type: 'text' },
      q4Review:    { label: 'Q4 review', type: 'text' },
      status:      { label: 'Status', type: 'enum', options: ['draft', 'active', 'reviewed', 'complete'], default: 'draft' },
    },
  },

  songs: {
    label: 'Songs',
    resource: 'worship',
    titleField: 'title',
    searchable: ['title', 'author', 'themes', 'lyrics', 'scripture'],
    fields: {
      title:     { label: 'Title', type: 'string', required: true },
      author:    { label: 'Author / artist', type: 'string' },
      key:       { label: 'Key', type: 'enum', options: ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] },
      bpm:       { label: 'BPM', type: 'number' },
      timeSignature: { label: 'Time', type: 'string', default: '4/4' },
      themes:    { label: 'Themes', type: 'list' },
      scripture: { label: 'Scripture', type: 'string' },
      mood:      { label: 'Mood', type: 'enum', options: ['celebration', 'adoration', 'reflection', 'lament', 'declaration', 'communion'] },
      season:    { label: 'Season', type: 'enum', options: ['any', 'advent', 'christmas', 'lent', 'easter', 'pentecost', 'thanksgiving'], default: 'any' },
      language:  { label: 'Language', type: 'enum', options: ['English', 'Arabic', 'Tagalog', 'Hindi', 'Malayalam'], default: 'English' },
      lyrics:    { label: 'Lyrics', type: 'text' },
      chords:    { label: 'Chord sheet', type: 'text' },
      ccli:      { label: 'CCLI number', type: 'string' },
      notes:     { label: 'Notes', type: 'text' },
    },
  },

  setlists: {
    label: 'Setlists',
    resource: 'worship',
    titleField: 'title',
    searchable: ['title', 'notes'],
    fields: {
      title:    { label: 'Service', type: 'string', required: true },
      date:     { label: 'Date', type: 'date', required: true },
      songIds:  { label: 'Songs', type: 'list', ref: 'songs' },
      leadId:   { label: 'Worship leader', type: 'ref', ref: 'members' },
      team:     { label: 'Team', type: 'list' },
      rehearsal:{ label: 'Rehearsal', type: 'datetime' },
      notes:    { label: 'Notes', type: 'text' },
    },
  },

  series: {
    label: 'Sermon series',
    resource: 'preaching',
    titleField: 'title',
    searchable: ['title', 'bigIdea'],
    fields: {
      title:     { label: 'Series', type: 'string', required: true },
      bigIdea:   { label: 'Big idea', type: 'text' },
      startDate: { label: 'Starts', type: 'date' },
      endDate:   { label: 'Ends', type: 'date' },
      book:      { label: 'Book / theme', type: 'string' },
    },
  },

  sermons: {
    label: 'Sermons',
    resource: 'preaching',
    titleField: 'title',
    searchable: ['title', 'passage', 'bigIdea', 'outline', 'notes', 'tags'],
    fields: {
      title:    { label: 'Title', type: 'string', required: true },
      date:     { label: 'Preached on', type: 'date' },
      seriesId: { label: 'Series', type: 'ref', ref: 'series' },
      preacherId: { label: 'Preacher', type: 'ref', ref: 'members' },
      passage:  { label: 'Passage', type: 'string' },
      bigIdea:  { label: 'Big idea', type: 'text' },
      outline:  { label: 'Outline', type: 'text' },
      notes:    { label: 'Notes', type: 'text' },
      tags:     { label: 'Tags', type: 'list' },
      status:   { label: 'Status', type: 'enum', options: ['idea', 'drafting', 'ready', 'preached'], default: 'idea' },
      assets:   { label: 'Generated assets', type: 'object' },
    },
  },

  illustrations: {
    label: 'Illustrations & quotes',
    resource: 'preaching',
    titleField: 'title',
    searchable: ['title', 'body', 'source', 'tags'],
    fields: {
      title:  { label: 'Title', type: 'string', required: true },
      kind:   { label: 'Kind', type: 'enum', options: ['illustration', 'quote', 'statistic', 'story'], default: 'illustration' },
      body:   { label: 'Body', type: 'text', required: true },
      source: { label: 'Source', type: 'string' },
      tags:   { label: 'Tags', type: 'list' },
      usedOn: { label: 'Last used', type: 'date' },
    },
  },

  prayers: {
    label: 'Prayer requests',
    resource: 'prayer',
    titleField: 'title',
    searchable: ['title', 'detail', 'category'],
    fields: {
      title:    { label: 'Request', type: 'string', required: true },
      detail:   { label: 'Detail', type: 'text' },
      memberId: { label: 'Person', type: 'ref', ref: 'members' },
      requestedBy: { label: 'Requested by', type: 'string' },
      category: { label: 'Category', type: 'enum', options: ['health', 'family', 'work', 'travel', 'spiritual', 'financial', 'thanksgiving', 'other'], default: 'other' },
      visibility: { label: 'Visibility', type: 'enum', options: ['wall', 'leaders', 'private'], default: 'wall' },
      urgent:   { label: 'Urgent', type: 'bool', default: false },
      status:   { label: 'Status', type: 'enum', options: ['open', 'praying', 'answered', 'closed'], default: 'open' },
      answeredNote: { label: 'How it was answered', type: 'text' },
      answeredOn:   { label: 'Answered on', type: 'date' },
      prayedCount:  { label: 'Prayed', type: 'number', default: 0 },
      chainId:  { label: 'Prayer chain', type: 'ref', ref: 'prayerChains' },
    },
  },

  prayerChains: {
    label: 'Prayer chains',
    resource: 'prayer',
    titleField: 'name',
    searchable: ['name', 'purpose'],
    fields: {
      name:    { label: 'Chain', type: 'string', required: true },
      purpose: { label: 'Purpose', type: 'text' },
      memberIds: { label: 'Members', type: 'list', ref: 'members' },
      active:  { label: 'Active', type: 'bool', default: true },
    },
  },

  events: {
    label: 'Events',
    resource: 'events',
    titleField: 'title',
    searchable: ['title', 'description', 'venue', 'type'],
    fields: {
      title:    { label: 'Event', type: 'string', required: true },
      type:     { label: 'Type', type: 'enum', options: ['service', 'retreat', 'conference', 'baptism', 'communion', 'training', 'seminar', 'outreach', 'fellowship'], default: 'service' },
      startsAt: { label: 'Starts', type: 'datetime', required: true },
      endsAt:   { label: 'Ends', type: 'datetime' },
      venue:    { label: 'Venue', type: 'string' },
      description: { label: 'Description', type: 'text' },
      capacity: { label: 'Capacity', type: 'number' },
      budget:   { label: 'Budget', type: 'money', default: 0 },
      ownerId:  { label: 'Coordinator', type: 'ref', ref: 'members' },
      status:   { label: 'Status', type: 'enum', options: ['planning', 'confirmed', 'done', 'cancelled'], default: 'planning' },
      checkinCode: { label: 'Check-in code', type: 'string' },
      recurring: { label: 'Repeats', type: 'enum', options: ['none', 'weekly', 'monthly'], default: 'none' },
    },
  },

  eventTasks: {
    label: 'Event tasks',
    resource: 'events',
    titleField: 'title',
    searchable: ['title'],
    fields: {
      eventId: { label: 'Event', type: 'ref', ref: 'events', required: true },
      title:   { label: 'Task', type: 'string', required: true },
      ownerId: { label: 'Owner', type: 'ref', ref: 'members' },
      dueDate: { label: 'Due', type: 'date' },
      done:    { label: 'Done', type: 'bool', default: false },
      role:    { label: 'Role', type: 'string' },
    },
  },

  checkins: {
    label: 'Check-ins',
    resource: 'events',
    titleField: 'name',
    fields: {
      eventId:  { label: 'Event', type: 'ref', ref: 'events', required: true },
      memberId: { label: 'Member', type: 'ref', ref: 'members' },
      name:     { label: 'Name', type: 'string' },
      at:       { label: 'Checked in', type: 'datetime', required: true },
      method:   { label: 'Method', type: 'enum', options: ['qr', 'manual', 'kiosk'], default: 'manual' },
      firstTime:{ label: 'First time', type: 'bool', default: false },
    },
  },

  budgets: {
    label: 'Budgets',
    resource: 'finance',
    encrypted: true,
    titleField: 'name',
    fields: {
      name:     { label: 'Budget line', type: 'string', required: true },
      year:     { label: 'Year', type: 'number', required: true },
      category: { label: 'Category', type: 'string', required: true },
      department: { label: 'Department', type: 'string' },
      amount:   { label: 'Allocated', type: 'money', required: true, default: 0 },
      notes:    { label: 'Notes', type: 'text' },
    },
  },

  transactions: {
    label: 'Giving & expenses',
    resource: 'finance',
    encrypted: true,
    titleField: 'description',
    fields: {
      kind:        { label: 'Kind', type: 'enum', required: true, options: ['giving', 'expense'], default: 'giving' },
      date:        { label: 'Date', type: 'date', required: true },
      amount:      { label: 'Amount', type: 'money', required: true, default: 0 },
      currency:    { label: 'Currency', type: 'string', default: 'KWD' },
      category:    { label: 'Category', type: 'string', required: true },
      department:  { label: 'Department', type: 'string' },
      projectId:   { label: 'Project', type: 'ref', ref: 'projects' },
      description: { label: 'Description', type: 'string' },
      method:      { label: 'Method', type: 'enum', options: ['cash', 'knet', 'transfer', 'card', 'in-kind'], default: 'cash' },
      memberId:    { label: 'Given by', type: 'ref', ref: 'members' },
      anonymous:   { label: 'Anonymous', type: 'bool', default: false },
      receiptRef:  { label: 'Receipt reference', type: 'string' },
      documentId:  { label: 'Receipt document', type: 'ref', ref: 'documents' },
      status:      { label: 'Status', type: 'enum', options: ['recorded', 'pending-approval', 'approved', 'rejected'], default: 'recorded' },
      approvedBy:  { label: 'Approved by', type: 'ref', ref: 'users' },
      approvedAt:  { label: 'Approved at', type: 'datetime' },
    },
  },

  projects: {
    label: 'Projects & funds',
    resource: 'finance',
    encrypted: true,
    titleField: 'name',
    fields: {
      name:   { label: 'Project', type: 'string', required: true },
      goal:   { label: 'Goal', type: 'money', default: 0 },
      notes:  { label: 'Notes', type: 'text' },
      active: { label: 'Active', type: 'bool', default: true },
    },
  },

  documents: {
    label: 'Document vault',
    resource: 'documents',
    encrypted: true,
    titleField: 'title',
    searchable: ['title', 'description', 'tags', 'category'],
    fields: {
      title:      { label: 'Title', type: 'string', required: true },
      category:   { label: 'Category', type: 'enum', required: true, options: ['policy', 'minutes', 'insurance', 'facility', 'lease', 'legal', 'contract', 'training', 'photo', 'video', 'finance', 'other'], default: 'other' },
      description:{ label: 'Description', type: 'text' },
      tags:       { label: 'Tags', type: 'list' },
      fileName:   { label: 'File', type: 'string' },
      mimeType:   { label: 'Type', type: 'string' },
      size:       { label: 'Size', type: 'number', default: 0 },
      content:    { label: 'Content', type: 'text', help: 'Text or data URL — encrypted at rest.' },
      checksum:   { label: 'Checksum', type: 'string' },
      version:    { label: 'Version', type: 'number', default: 1 },
      history:    { label: 'Version history', type: 'list' },
      restrictedTo: { label: 'Restricted to roles', type: 'list' },
      expiresOn:  { label: 'Expires', type: 'date', help: 'Leases, insurance and licences — Shepherd reminds you before this date.' },
    },
  },

  knowledge: {
    label: 'Knowledge entries',
    resource: 'knowledge',
    titleField: 'question',
    searchable: ['question', 'answer', 'tags'],
    fields: {
      question: { label: 'Question', type: 'string', required: true },
      answer:   { label: 'Answer', type: 'text', required: true },
      tags:     { label: 'Tags', type: 'list' },
      sourceType: { label: 'Source', type: 'string' },
      sourceId: { label: 'Source id', type: 'string' },
      reviewedBy: { label: 'Reviewed by', type: 'ref', ref: 'users' },
      aiGenerated: { label: 'AI drafted', type: 'bool', default: false },
    },
  },

  courses: {
    label: 'Courses',
    resource: 'equip',
    titleField: 'title',
    searchable: ['title', 'description', 'category', 'instructor'],
    fields: {
      title:        { label: 'Title', type: 'string', required: true },
      category:     { label: 'Category', type: 'enum', options: EQUIP_CATEGORIES, default: EQUIP_CATEGORIES[0], required: true },
      description:  { label: 'Description', type: 'text' },
      instructor:   { label: 'Instructor', type: 'string' },
      duration:     { label: 'Duration', type: 'string' },
      level:        { label: 'Level', type: 'enum', options: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
      prerequisites: { label: 'Prerequisites', type: 'list', ref: 'courses' },
      objectives:   { label: 'Objectives', type: 'list' },
      // Each lesson: { title, type: 'video'|'audio'|'reading'|'pdf', summary,
      // quiz: [{ question, options, answer }] }. Authored as structured data —
      // seeded, or edited as JSON — rather than through a WYSIWYG lesson
      // builder, which is a separate feature this pass does not attempt.
      lessons:      { label: 'Lessons', type: 'object' },
      discussionQuestions: { label: 'Discussion questions', type: 'list' },
      leaderOnly:   { label: 'Leader training', type: 'bool', default: false, help: 'Restricted to ministry leadership roles — see policies.canEnrollInCourse.' },
      archived:     { label: 'Archived', type: 'bool', default: false },
    },
  },

  learningPaths: {
    label: 'Learning paths',
    resource: 'equip',
    titleField: 'title',
    searchable: ['title', 'description', 'audience'],
    fields: {
      title:       { label: 'Title', type: 'string', required: true },
      description: { label: 'Description', type: 'text' },
      audience:    { label: 'Who it is for', type: 'string' },
      courseIds:   { label: 'Courses, in order', type: 'list', ref: 'courses' },
    },
  },

  enrollments: {
    label: 'Enrollments',
    resource: 'equip',
    titleField: 'courseId',
    instanceWrite: canWriteEnrollment,
    fields: {
      memberId:         { label: 'Member', type: 'ref', ref: 'members', required: true },
      courseId:         { label: 'Course', type: 'ref', ref: 'courses', required: true },
      status:           { label: 'Status', type: 'enum', options: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
      completedLessons: { label: 'Completed lessons', type: 'list' },
      quizScore:        { label: 'Quiz score', type: 'number' },
      bookmarked:       { label: 'Bookmarked', type: 'bool', default: false },
      startedAt:        { label: 'Started', type: 'date' },
      completedAt:      { label: 'Completed', type: 'date' },
      certificateId:    { label: 'Certificate', type: 'ref', ref: 'certificates' },
    },
  },

  /**
   * Issued by the completion flow in equip.js, not through a generic form.
   * `instanceWrite` reuses `canWriteEnrollment` (it only reads `memberId`):
   * a member may only ever issue a certificate that names themselves —
   * the same trust boundary the client already places on their own
   * enrollment record, not a new one.
   */
  certificates: {
    label: 'Certificates',
    resource: 'equip',
    titleField: 'certificateNumber',
    instanceWrite: canWriteEnrollment,
    fields: {
      memberId:          { label: 'Member', type: 'ref', ref: 'members', required: true },
      courseId:          { label: 'Course', type: 'ref', ref: 'courses', required: true },
      courseTitle:       { label: 'Course title', type: 'string', required: true },
      instructor:        { label: 'Instructor', type: 'string' },
      issuedAt:          { label: 'Issued', type: 'date', required: true },
      certificateNumber: { label: 'Certificate number', type: 'string', required: true },
      verificationId:    { label: 'Verification ID', type: 'string', required: true },
    },
  },

  announcements: {
    label: 'Announcements',
    resource: 'communications',
    titleField: 'title',
    searchable: ['title', 'body', 'channel'],
    fields: {
      title:    { label: 'Title', type: 'string', required: true },
      body:     { label: 'Message', type: 'text', required: true },
      channel:  { label: 'Channel', type: 'enum', options: ['app', 'email', 'whatsapp', 'sms', 'push', 'bulletin'], default: 'app' },
      audience: { label: 'Audience', type: 'enum', options: ['everyone', 'members', 'leaders', 'volunteers', 'ministry'], default: 'everyone' },
      ministry: { label: 'Ministry', type: 'string' },
      language: { label: 'Language', type: 'enum', options: ['English', 'Arabic', 'Tagalog'], default: 'English' },
      scheduledFor: { label: 'Send on', type: 'datetime' },
      status:   { label: 'Status', type: 'enum', options: ['draft', 'approved', 'sent'], default: 'draft' },
      aiGenerated: { label: 'AI drafted', type: 'bool', default: false },
      sentAt:   { label: 'Sent', type: 'datetime' },
    },
  },

  users: {
    label: 'Users',
    resource: 'users',
    titleField: 'name',
    searchable: ['name', 'email'],
    fields: {
      name:     { label: 'Name', type: 'string', required: true },
      email:    { label: 'Email', type: 'string', required: true },
      role:     { label: 'Role', type: 'string', required: true, default: 'volunteer' },
      memberId: { label: 'Linked member', type: 'ref', ref: 'members' },
      grants:   { label: 'Extra permissions', type: 'list' },
      revocations: { label: 'Removed permissions', type: 'list' },
      suspended:{ label: 'Suspended', type: 'bool', default: false },
      auth:     { label: 'Credentials', type: 'object' },
      vault:    { label: 'Wrapped vault key', type: 'object' },
      totp:     { label: 'Two-factor', type: 'object' },
      lastLoginAt: { label: 'Last sign-in', type: 'datetime' },
      devices:  { label: 'Devices', type: 'list' },
    },
  },

  audit: {
    label: 'Audit log',
    resource: 'audit',
    titleField: 'action',
    fields: {
      at:        { label: 'When', type: 'datetime', required: true },
      actorId:   { label: 'Who', type: 'ref', ref: 'users' },
      actorName: { label: 'Name', type: 'string' },
      action:    { label: 'Action', type: 'string', required: true },
      collection:{ label: 'Collection', type: 'string' },
      docId:     { label: 'Record', type: 'string' },
      summary:   { label: 'Summary', type: 'string' },
      ip:        { label: 'Device', type: 'string' },
    },
  },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS);

/** Collections whose payload is encrypted before it is written. */
export const ENCRYPTED_COLLECTIONS = COLLECTION_NAMES.filter((name) => COLLECTIONS[name].encrypted);

/** @param {string} name */
export function collectionDef(name) {
  const def = COLLECTIONS[name];
  if (!def) throw new Error(`Unknown collection: ${name}`);
  return def;
}

/**
 * Validate a record against its schema.
 * @returns {{ok: boolean, errors: {field: string, message: string}[]}}
 */
export function validate(collection, doc) {
  const def = collectionDef(collection);
  const errors = [];
  for (const [field, spec] of Object.entries(def.fields)) {
    const value = doc[field];
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    if (spec.required && empty) {
      errors.push({ field, message: `${spec.label} is required.` });
      continue;
    }
    if (empty) continue;
    if (spec.type === 'number' || spec.type === 'money') {
      if (Number.isNaN(Number(value))) errors.push({ field, message: `${spec.label} must be a number.` });
      else if (spec.type === 'money' && Number(value) < 0) errors.push({ field, message: `${spec.label} cannot be negative.` });
    }
    if (spec.type === 'enum' && spec.options && !spec.options.includes(value)) {
      errors.push({ field, message: `${spec.label} must be one of: ${spec.options.join(', ')}.` });
    }
    if (spec.type === 'list' && !Array.isArray(value)) {
      errors.push({ field, message: `${spec.label} must be a list.` });
    }
    if ((spec.type === 'date' || spec.type === 'datetime') && Number.isNaN(new Date(value).getTime())) {
      errors.push({ field, message: `${spec.label} is not a valid date.` });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** A new record with every default filled in. */
export function blank(collection, overrides = {}) {
  const def = collectionDef(collection);
  const doc = {};
  for (const [field, spec] of Object.entries(def.fields)) {
    if ('default' in spec) doc[field] = Array.isArray(spec.default) ? [...spec.default] : spec.default;
    else if (spec.type === 'list') doc[field] = [];
  }
  return { ...doc, ...overrides };
}

/** The text a record contributes to the global search index. */
export function searchableText(collection, doc) {
  const def = collectionDef(collection);
  const fields = def.searchable || (def.titleField ? [def.titleField] : []);
  return fields
    .map((field) => {
      const value = doc[field];
      if (Array.isArray(value)) return value.join(' ');
      return value == null ? '' : String(value);
    })
    .join(' ')
    .trim();
}

/** Human title for a record, for search results and audit lines. */
export function docTitle(collection, doc) {
  const def = COLLECTIONS[collection];
  const field = def && def.titleField;
  return (field && doc && doc[field]) ? String(doc[field]) : (doc && doc.id) || '';
}
