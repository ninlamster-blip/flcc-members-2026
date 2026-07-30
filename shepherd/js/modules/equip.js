/**
 * Equip — the learning platform.
 *
 * Courses, learning paths, quizzes, certificates and an AI learning coach,
 * for members and leaders alike. Two things keep it consistent with the rest
 * of Shepherd rather than a bolted-on LMS:
 *
 *   - Progress is tracked the same way ministry-scoped records already are:
 *     an `enrollments` row belongs to one member (`policies.canWriteEnrollment`
 *     is the same per-instance ACL shape as `canWriteActionItem`), so an
 *     ordinary member can track their own learning without holding the
 *     catalogue-authoring `equip:write` permission church_admin holds.
 *   - Recommendations, learning hours and leadership readiness are computed
 *     from real enrollment and course records (`core/ai.js`), never
 *     fabricated; the AI coach only adds encouragement around what is
 *     already true, and everything it drafts carries the usual label.
 *
 * Course authoring reuses the generic schema-driven editor (`openRecordModal`)
 * rather than a bespoke lesson builder — a full rich-media lesson authoring
 * UI (video upload, drag-drop quiz builder) is a separate feature this pass
 * does not attempt. Lessons are structured data (seeded, or edited as JSON
 * through the `lessons` field), consumed richly by every learner.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, list, listItem, emptyState, badge, segmented, statCard,
  toast, aiOutput, progress, searchField, modal, field, input,
} from '../core/ui.js';
import { formatDate } from '../core/format.js';
import { blank } from '../core/schema.js';
import { memberName, sentence, matches, newButton, openRecordModal, friendly } from './_shared.js';
import { learningProgress, recommendNextCourse, leadershipReadiness } from '../core/ai.js';
import { canEnrollInCourse } from '../core/policies.js';
import { uid } from '../core/id.js';
import { printReport } from '../core/exporters.js';

const COURSE_FIELDS = ['title', 'category', 'description', 'instructor', 'duration', 'level', 'prerequisites', 'objectives', 'lessons', 'discussionQuestions', 'leaderOnly', 'archived'];
const PATH_FIELDS = ['title', 'description', 'audience', 'courseIds'];

const DAILY_VERSES = [
  { text: 'The Lord is my shepherd; I shall not want.', ref: 'Psalm 23:1' },
  { text: 'I can do all things through him who strengthens me.', ref: 'Philippians 4:13' },
  { text: 'Trust in the Lord with all your heart, and do not lean on your own understanding.', ref: 'Proverbs 3:5' },
  { text: 'Be strong and courageous. Do not be frightened, for the Lord your God is with you.', ref: 'Joshua 1:9' },
  { text: 'And we know that for those who love God all things work together for good.', ref: 'Romans 8:28' },
  { text: 'Come to me, all who labour and are heavy laden, and I will give you rest.', ref: 'Matthew 11:28' },
  { text: 'The steadfast love of the Lord never ceases; his mercies never come to an end.', ref: 'Lamentations 3:22' },
];

export async function render(ctx, route) {
  const tab = route.query.tab || 'dashboard';
  const body = h('div');
  body.appendChild(
    tab === 'library' ? libraryTab(ctx, route)
      : tab === 'paths' ? pathsTab(ctx)
      : tab === 'my' ? myLearningTab(ctx)
      : equipDashboardTab(ctx),
  );

  return page({
    title: 'Equip',
    subtitle: 'Grow in faith, deepen biblical knowledge, develop ministry skills, and prepare for greater service.',
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'library', label: 'Course Library' },
            { value: 'paths', label: 'Learning Paths' },
            { value: 'my', label: 'My Learning' },
          ],
          value: tab,
          onChange: (v) => ctx.navigate(`/equip?tab=${v}`),
        })),
      body,
    ],
  });
}

/* ── dashboard ───────────────────────────────────────────────────────────── */

function equipDashboardTab(ctx) {
  const { db, user } = ctx;
  const learning = learningProgress(db, user);
  const recommended = recommendNextCourse(db, user);
  const bookmarked = user.memberId
    ? db.where('enrollments', (e) => e.memberId === user.memberId && e.bookmarked).map((e) => db.find('courses', e.courseId)).filter(Boolean)
    : [];

  return h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: learning.completed.length, label: 'Courses completed' }),
      statCard({ value: learning.inProgress.length, label: 'In progress' }),
      statCard({ value: learning.hours, label: 'Learning hours' }),
      statCard({ value: learning.certificates.length, label: 'Certificates earned' })),
    dailyVerseCard(),
    learning.inProgress.length ? card({
      title: 'Continue learning',
      children: [list(learning.inProgress.map((e) => courseListItem(ctx, db.find('courses', e.courseId))).filter(Boolean))],
    }) : null,
    recommended ? card({
      title: 'Recommended courses',
      actions: [badge('Computed for you', 'accent')],
      children: [courseListItem(ctx, recommended, `${recommended.category} · ${recommended.description || ''}`)],
    }) : null,
    aiCoachCard(ctx, learning, recommended),
    learning.completed.length ? card({
      title: 'Recently completed',
      children: [list(learning.completed.slice(-5).reverse().map((e) => {
        const course = db.find('courses', e.courseId);
        return course ? courseListItem(ctx, course, e.completedAt ? `Completed ${formatDate(e.completedAt)}` : '') : null;
      }).filter(Boolean))],
    }) : null,
    learning.certificates.length ? card({
      title: 'Certificates earned',
      children: [list(learning.certificates.map((cert) => listItem({
        title: cert.courseTitle,
        meta: `${cert.certificateNumber} · ${formatDate(cert.issuedAt)}`,
        trailing: h('button.btn.btn--sm', { onClick: () => printCertificate(ctx, cert) }, icon('download', { size: 14 }), 'Download'),
      })))],
    }) : null,
    bookmarked.length ? card({
      title: 'Bookmarks',
      children: [list(bookmarked.map((course) => courseListItem(ctx, course, course.category)))],
    }) : null);
}

function courseListItem(ctx, course, meta) {
  if (!course) return null;
  return listItem({ title: course.title, meta: meta || course.category, onClick: () => openCourseModal(ctx, course) });
}

function dailyVerseCard() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const verse = DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
  return card({ title: 'Daily verse', children: [h('p.small', `"${verse.text}" — ${verse.ref}`)] });
}

function aiCoachCard(ctx, learning, recommended) {
  const output = h('div');
  const ask = async () => {
    output.textContent = '';
    output.appendChild(h('p.small.muted', 'Thinking…'));
    const result = await ctx.assistant.run('equip.coach', {
      name: ctx.user.name,
      completedCount: learning.completed.length,
      hours: learning.hours,
      nextCourse: recommended ? recommended.title : '',
    });
    output.textContent = '';
    output.appendChild(aiOutput({ result }));
  };
  return card({
    title: 'AI recommendations',
    children: [h('button.btn.btn--sm', { onClick: ask }, icon('sparkles', { size: 14 }), 'Get encouragement & next step'), output],
  });
}

/* ── course library ──────────────────────────────────────────────────────── */

function libraryTab(ctx, route) {
  const { db } = ctx;
  const category = route.query.category || '';
  const q = route.query.q || '';
  const courses = db.where('courses', (c) => !c.archived)
    .filter((c) => !category || c.category === category)
    .filter((c) => matches(c, q, ['title', 'description', 'instructor']))
    .sort((a, b) => a.title.localeCompare(b.title));
  const categories = [...new Set(db.all('courses').filter((c) => !c.archived).map((c) => c.category))].sort();

  return h('div.stack',
    h('div.row.row--wrap',
      searchField({ placeholder: 'Search courses…', value: q, onInput: (v) => ctx.navigate(`/equip?tab=library&category=${encodeURIComponent(category)}&q=${encodeURIComponent(v)}`) }),
      h('select.select', {
        style: { maxWidth: '220px' }, 'aria-label': 'Category',
        onChange: (e) => ctx.navigate(`/equip?tab=library&category=${encodeURIComponent(e.target.value)}&q=${encodeURIComponent(q)}`),
      },
        h('option', { value: '' }, 'All categories'),
        ...categories.map((c) => h('option', { value: c, selected: c === category }, c))),
      h('div.spacer'),
      newButton(ctx, 'equip', 'New course', () => openCourseEditModal(ctx, {}))),
    courses.length
      ? h('div.grid.grid--3', ...courses.map((c) => courseCard(ctx, c)))
      : emptyState({ title: 'No courses found', detail: 'Try a different search or category.', iconName: 'graduation' }));
}

function courseCard(ctx, course) {
  const { db, user } = ctx;
  const enrollment = user.memberId ? db.first('enrollments', (e) => e.memberId === user.memberId && e.courseId === course.id) : null;
  const locked = !canEnrollInCourse(user, course);
  const lessons = course.lessons || [];

  return card({
    tight: true,
    children: [
      h('div.row.row--between.row--wrap',
        h('div', null, h('strong', course.title), h('div.tiny.subtle', course.category)),
        course.leaderOnly ? badge('Leaders only', locked ? 'warn' : 'accent') : null),
      course.description ? h('p.small.muted', { style: { marginTop: '6px' } }, course.description) : null,
      h('div.chip-list', { style: { marginTop: '8px' } },
        badge(sentence(course.level || 'beginner'), ''),
        badge(`${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`, ''),
        course.duration ? badge(course.duration, '') : null,
        enrollment && enrollment.status !== 'not-started' ? badge(sentence(enrollment.status), enrollment.status === 'completed' ? 'ok' : 'info') : null),
      h('div.row', { style: { marginTop: '10px' } },
        h('button.btn.btn--sm.btn--primary', {
          disabled: locked,
          onClick: () => openCourseModal(ctx, course),
        }, locked ? 'Locked' : (enrollment && enrollment.status !== 'not-started' ? 'Continue' : 'Start')),
        ctx.can('equip:write')
          ? h('button.icon-btn', { 'aria-label': 'Edit course', onClick: () => openCourseEditModal(ctx, { doc: course }) }, icon('edit', { size: 15 }))
          : null),
    ],
  });
}

function openCourseEditModal(ctx, { doc = null } = {}) {
  openRecordModal(ctx, { collection: 'courses', doc, fields: COURSE_FIELDS });
}

/* ── course detail: lessons, quizzes, discussion, completion ─────────────── */

function findEnrollment(db, user, courseId) {
  if (!user.memberId) return null;
  return db.first('enrollments', (e) => e.memberId === user.memberId && e.courseId === courseId);
}

/** A read-only view of progress for rendering — never writes just from opening a course. */
function viewEnrollment(db, user, courseId) {
  return findEnrollment(db, user, courseId) || { memberId: user.memberId || null, courseId, status: 'not-started', completedLessons: [], bookmarked: false };
}

/** Materialises a real enrollment row the first time a learner actually does something. */
function ensureEnrollment(ctx, course) {
  const { db, user } = ctx;
  let enrollment = findEnrollment(db, user, course.id);
  if (!enrollment) {
    enrollment = db.insert('enrollments', blank('enrollments', {
      memberId: user.memberId, courseId: course.id, status: 'in-progress', startedAt: new Date().toISOString().slice(0, 10),
    }));
  }
  return enrollment;
}

function openCourseModal(ctx, course) {
  if (!canEnrollInCourse(ctx.user, course)) {
    const ref = modal({
      title: course.title,
      body: h('p.muted', 'This course is restricted to those holding a leadership role.'),
      actions: [h('button.btn', { onClick: () => ref.close() }, 'Close')],
    });
    return;
  }
  const container = h('div');
  const redraw = () => {
    container.textContent = '';
    container.appendChild(courseDetailBody(ctx, course, redraw));
  };
  redraw();
  const ref = modal({ title: course.title, wide: true, body: container, actions: [h('button.btn', { onClick: () => ref.close() }, 'Close')] });
}

function courseDetailBody(ctx, course, redraw) {
  const { db, user } = ctx;
  const enrollment = viewEnrollment(db, user, course.id);
  const lessons = course.lessons || [];
  const completedSet = new Set(enrollment.completedLessons || []);
  const allDone = lessons.length > 0 && lessons.every((_, i) => completedSet.has(String(i)));
  const cert = enrollment.certificateId ? db.find('certificates', enrollment.certificateId) : null;
  const prereqTitles = (course.prerequisites || []).map((id) => (db.find('courses', id) || {}).title).filter(Boolean);

  return h('div.stack',
    h('div.row.row--wrap',
      badge(sentence(course.level || 'beginner'), ''),
      course.duration ? badge(course.duration, '') : null,
      course.leaderOnly ? badge('Leader training', 'accent') : null,
      badge(sentence(enrollment.status), enrollment.status === 'completed' ? 'ok' : enrollment.status === 'in-progress' ? 'info' : ''),
      h('button.btn.btn--sm', { onClick: () => toggleBookmark(ctx, course, redraw) },
        icon('heart', { size: 14 }), enrollment.bookmarked ? 'Bookmarked' : 'Bookmark')),
    course.description ? h('p.small', course.description) : null,
    course.instructor ? h('p.tiny.subtle', `Instructor: ${course.instructor}`) : null,
    prereqTitles.length ? h('p.tiny.subtle', `Prerequisites: ${prereqTitles.join(', ')}`) : null,
    (course.objectives || []).length ? card({
      title: 'Objectives', tight: true,
      children: [h('ul', { style: { margin: 0, paddingLeft: '20px' } }, ...course.objectives.map((o) => h('li.small', o)))],
    }) : null,
    card({
      title: 'Lessons', tight: true,
      children: [lessons.length
        ? h('div.stack.stack--sm', ...lessons.map((lesson, i) => lessonRow(ctx, course, lesson, i, completedSet.has(String(i)), redraw)))
        : h('p.small.muted', 'No lessons added yet.')],
    }),
    (course.discussionQuestions || []).length ? card({
      title: 'Discussion questions', tight: true,
      children: [h('ul', { style: { margin: 0, paddingLeft: '20px' } }, ...course.discussionQuestions.map((q) => h('li.small', q)))],
    }) : null,
    allDone && enrollment.status !== 'completed'
      ? h('button.btn.btn--primary', { onClick: () => completeCourse(ctx, course, redraw) }, icon('check', { size: 15 }), 'Complete course & get certificate')
      : null,
    cert ? certificateCard(ctx, cert) : null);
}

function lessonRow(ctx, course, lesson, index, done, redraw) {
  const canTrack = !!ctx.user.memberId;
  return h('div.stack.stack--sm', { style: { borderBottom: '1px solid var(--border)', paddingBottom: '10px' } },
    h('div.row.row--between.row--wrap',
      h('div.row',
        h('input', {
          type: 'checkbox', checked: done, disabled: !canTrack,
          onChange: () => toggleLesson(ctx, course, index, redraw),
        }),
        h('div', null,
          h('div.small', { style: { fontWeight: '600' } }, `${index + 1}. ${lesson.title}`),
          h('div.tiny.subtle', `${sentence(lesson.type || 'reading')}${lesson.summary ? ` · ${lesson.summary}` : ''}`))),
      h('button.btn.btn--sm', { onClick: () => openLessonCoachModal(ctx, course, lesson) }, icon('sparkles', { size: 14 }), 'Ask the coach')),
    (lesson.quiz || []).length ? quizBlock(ctx, course, lesson, index) : null);
}

/** A single-question check — not a scored multi-question engine, just enough to make "Quizzes" real rather than a label. */
function quizBlock(ctx, course, lesson, lessonIndex) {
  const q = lesson.quiz[0];
  const name = `quiz-${course.id}-${lessonIndex}`;
  const radioInputs = q.options.map((_, i) => h('input', { type: 'radio', name, value: String(i) }));
  const feedback = h('p.tiny.subtle');
  const checkBtn = h('button.btn.btn--sm', {
    type: 'button',
    onClick: () => {
      const picked = radioInputs.findIndex((r) => r.checked);
      if (picked === -1) { feedback.textContent = 'Choose an answer first.'; return; }
      const correct = picked === q.answer;
      feedback.textContent = correct ? 'Correct!' : 'Not quite — review the lesson and try again.';
      if (correct && ctx.user.memberId) {
        const enrollment = ensureEnrollment(ctx, course);
        ctx.db.update('enrollments', enrollment.id, { quizScore: 100 });
      }
    },
  }, 'Check answer');
  return h('div.stack.stack--sm', { style: { marginLeft: '28px' } },
    h('p.small', { style: { fontWeight: '600' } }, q.question),
    ...q.options.map((opt, i) => h('label.small', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, radioInputs[i], opt)),
    h('div.row', checkBtn, feedback));
}

function openLessonCoachModal(ctx, course, lesson) {
  const output = h('div');
  const run = async (task, input_) => {
    output.textContent = '';
    output.appendChild(h('p.small.muted', 'Thinking…'));
    const result = await ctx.assistant.run(task, input_);
    output.textContent = '';
    output.appendChild(aiOutput({ result }));
  };
  const ref = modal({
    title: lesson.title,
    body: h('div.stack',
      lesson.summary ? h('p.small.muted', lesson.summary) : null,
      h('div.row.row--wrap',
        h('button.btn.btn--sm', { onClick: () => run('equip.summary', { title: lesson.title, content: lesson.summary }) }, 'Summarise'),
        h('button.btn.btn--sm', { onClick: () => run('equip.explain', { passage: course.scripture || '', question: lesson.title }) }, 'Explain'),
        h('button.btn.btn--sm', { onClick: () => run('equip.quiz', { title: lesson.title, passage: course.scripture || '' }) }, 'More study questions')),
      output),
    actions: [h('button.btn', { onClick: () => ref.close() }, 'Close')],
  });
}

function toggleBookmark(ctx, course, redraw) {
  if (!ctx.user.memberId) { toast('Link your account to a member profile to bookmark courses.'); return; }
  try {
    const enrollment = ensureEnrollment(ctx, course);
    ctx.db.update('enrollments', enrollment.id, { bookmarked: !enrollment.bookmarked });
    redraw();
  } catch (err) {
    toast(friendly(err).message, { variant: 'danger' });
  }
}

function toggleLesson(ctx, course, lessonIndex, redraw) {
  if (!ctx.user.memberId) { toast('Link your account to a member profile to track progress.'); return; }
  try {
    const enrollment = ensureEnrollment(ctx, course);
    const key = String(lessonIndex);
    const has = (enrollment.completedLessons || []).includes(key);
    const completedLessons = has
      ? enrollment.completedLessons.filter((k) => k !== key)
      : [...(enrollment.completedLessons || []), key];
    ctx.db.update('enrollments', enrollment.id, {
      completedLessons,
      status: enrollment.status === 'completed' ? 'completed' : completedLessons.length ? 'in-progress' : 'not-started',
    });
    redraw();
  } catch (err) {
    toast(friendly(err).message, { variant: 'danger' });
  }
}

function completeCourse(ctx, course, redraw) {
  if (!ctx.user.memberId) { toast('Link your account to a member profile to complete courses.'); return; }
  try {
    const enrollment = ensureEnrollment(ctx, course);
    ctx.db.update('enrollments', enrollment.id, { status: 'completed', completedAt: new Date().toISOString().slice(0, 10) });
    if (!enrollment.certificateId) {
      const cert = issueCertificate(ctx, course);
      ctx.db.update('enrollments', enrollment.id, { certificateId: cert.id });
    }
    toast('Course completed — certificate issued.', { variant: 'ok' });
    redraw();
    ctx.refresh();
  } catch (err) {
    toast(friendly(err).message, { variant: 'danger' });
  }
}

function issueCertificate(ctx, course) {
  const { db, user } = ctx;
  const year = new Date().getFullYear();
  const seq = String(db.all('certificates').length + 1).padStart(4, '0');
  return db.insert('certificates', blank('certificates', {
    memberId: user.memberId,
    courseId: course.id,
    courseTitle: course.title,
    instructor: course.instructor,
    issuedAt: new Date().toISOString().slice(0, 10),
    certificateNumber: `CERT-${year}-${seq}`,
    verificationId: uid('ver'),
  }));
}

function certificateCard(ctx, cert) {
  return card({
    title: 'Certificate earned',
    tight: true,
    children: [
      h('p.small', `${cert.certificateNumber} · issued ${formatDate(cert.issuedAt)}`),
      h('button.btn.btn--sm', { style: { marginTop: '6px' }, onClick: () => printCertificate(ctx, cert) }, icon('download', { size: 14 }), 'Download / print'),
    ],
  });
}

function printCertificate(ctx, cert) {
  const node = h('div', {
    style: {
      border: '3px solid #2F6F5E', borderRadius: '12px', padding: '48px', textAlign: 'center', fontFamily: 'Georgia, serif',
    },
  },
    h('p', { style: { letterSpacing: '3px', textTransform: 'uppercase', color: '#6B7280', fontSize: '12px' } }, `${ctx.tenant.name} · Equip`),
    h('h1', { style: { fontSize: '28px', margin: '18px 0 6px' } }, 'Certificate of Completion'),
    h('p', { style: { color: '#6B7280' } }, 'This certifies that'),
    h('p', { style: { fontSize: '24px', margin: '10px 0' } }, memberName(ctx.db, cert.memberId)),
    h('p', { style: { color: '#6B7280' } }, 'has successfully completed'),
    h('p', { style: { fontSize: '20px', margin: '10px 0', fontWeight: 'bold' } }, cert.courseTitle),
    cert.instructor ? h('p', { style: { color: '#6B7280' } }, `Instructor: ${cert.instructor}`) : null,
    h('p', { style: { marginTop: '24px' } }, formatDate(cert.issuedAt)),
    h('p', { style: { marginTop: '24px', fontSize: '11px', color: '#9CA3AF' } }, `Certificate No. ${cert.certificateNumber} · Verification ID ${cert.verificationId}`));
  printReport({ title: 'Certificate of Completion', subtitle: cert.courseTitle, nodes: [node] });
  ctx.db.log('export', `Printed certificate ${cert.certificateNumber}.`);
}

/* ── learning paths ──────────────────────────────────────────────────────── */

function pathsTab(ctx) {
  const { db } = ctx;
  const paths = db.all('learningPaths');
  return h('div.stack',
    h('div.row', h('div.spacer'), newButton(ctx, 'equip', 'New path', () => openPathEditModal(ctx, {}))),
    paths.length
      ? h('div.stack.stack--sm', ...paths.map((path) => pathCard(ctx, path)))
      : emptyState({ title: 'No learning paths yet', detail: 'A path strings courses together in order, and tracks progress automatically.', iconName: 'graduation' }));
}

function pathCard(ctx, path) {
  const { db, user } = ctx;
  const courses = (path.courseIds || []).map((id) => db.find('courses', id)).filter(Boolean);
  const completedIds = new Set(
    user.memberId ? db.where('enrollments', (e) => e.memberId === user.memberId && e.status === 'completed').map((e) => e.courseId) : [],
  );
  const done = courses.filter((c) => completedIds.has(c.id)).length;
  const next = courses.find((c) => !completedIds.has(c.id));

  return card({
    title: path.title,
    subtitle: path.audience,
    actions: ctx.can('equip:write')
      ? [h('button.icon-btn', { 'aria-label': 'Edit path', onClick: () => openPathEditModal(ctx, { doc: path }) }, icon('edit', { size: 15 }))]
      : [],
    children: [
      path.description ? h('p.small.muted', path.description) : null,
      progress(done, courses.length || 1, { variant: '' }),
      h('p.tiny.subtle', { style: { marginTop: '6px' } }, `${done} of ${courses.length} courses complete`),
      h('div.stack.stack--sm', { style: { marginTop: '10px' } },
        ...courses.map((c, i) => h('div.row.row--between',
          h('span.small', `${i + 1}. ${c.title}`),
          completedIds.has(c.id) ? badge('Done', 'ok') : (c.id === (next && next.id) ? badge('Next up', 'accent') : badge('Not started', ''))))),
      next ? h('button.btn.btn--sm.btn--primary', { style: { marginTop: '10px' }, onClick: () => openCourseModal(ctx, next) }, 'Continue path') : null,
    ].filter(Boolean),
  });
}

function openPathEditModal(ctx, { doc = null } = {}) {
  openRecordModal(ctx, { collection: 'learningPaths', doc, fields: PATH_FIELDS });
}

/* ── my learning (personal growth dashboard) ─────────────────────────────── */

function myLearningTab(ctx) {
  const { db, user } = ctx;
  if (!user.memberId) {
    return emptyState({
      title: 'Link your account to a member profile',
      detail: 'Ask a church administrator to set this in Settings → Users & roles, so your learning history can be tracked.',
      iconName: 'users',
    });
  }
  const member = db.find('members', user.memberId);
  const learning = learningProgress(db, user);
  const readiness = leadershipReadiness(db, user);
  const skills = [...new Set(learning.completed.map((e) => (db.find('courses', e.courseId) || {}).category).filter(Boolean))];
  const recommended = recommendNextCourse(db, user);
  const goal = member.learningGoal || 0;
  const completedThisYear = learning.completed.filter((e) => e.completedAt && new Date(e.completedAt).getFullYear() === new Date().getFullYear()).length;

  return h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: learning.completed.length, label: 'Courses completed' }),
      statCard({ value: learning.inProgress.length, label: 'Current courses' }),
      statCard({ value: learning.hours, label: 'Learning hours' }),
      statCard({ value: learning.certificates.length, label: 'Certificates' })),
    card({
      title: 'Leadership readiness',
      subtitle: 'Computed from leader-restricted courses completed — not an opinion, a count.',
      children: readiness.total
        ? [progress(readiness.score, 100, { variant: '' }), h('p.small.muted', { style: { marginTop: '8px' } }, `${readiness.completed} of ${readiness.total} leadership courses complete.`)]
        : [h('p.small.muted', 'No leader-training courses in the catalogue yet.')],
    }),
    card({
      title: 'Skills acquired',
      children: [skills.length ? h('div.chip-list', ...skills.map((s) => h('span.chip', s))) : h('p.small.muted', 'Complete a course to see skills appear here.')],
    }),
    card({
      title: 'Annual learning goal',
      children: [
        goal
          ? h('div.stack.stack--sm', progress(completedThisYear, goal, { variant: '' }), h('p.small.muted', `${completedThisYear} of ${goal} courses this year.`))
          : h('p.small.muted', 'No goal set yet.'),
        ctx.can('members:write')
          ? h('button.btn.btn--sm', { style: { marginTop: '8px' }, onClick: () => setLearningGoal(ctx, member) }, goal ? 'Change goal' : 'Set goal')
          : (!goal ? h('p.tiny.subtle', 'Ask a church administrator to set a goal for you.') : null),
      ].filter(Boolean),
    }),
    recommended ? card({ title: 'Recommended next step', children: [courseListItem(ctx, recommended, recommended.description)] }) : null,
    aiCoachCard(ctx, learning, recommended));
}

function setLearningGoal(ctx, member) {
  const goalInput = input({ type: 'number', value: member.learningGoal || '' });
  const ref = modal({
    title: 'Annual learning goal',
    body: field({ label: 'Courses to complete this year', control: goalInput }),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: () => {
          try {
            ctx.db.update('members', member.id, { learningGoal: goalInput.value ? Number(goalInput.value) : null });
            ref.close();
            ctx.refresh();
          } catch (err) {
            toast(friendly(err).message, { variant: 'danger' });
          }
        },
      }, 'Save'),
    ],
  });
}
