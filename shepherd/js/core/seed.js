/**
 * Example data.
 *
 * A church that has just signed up sees an empty product and cannot tell what
 * it is for. This builds a small but complete congregation — people, a rota, a
 * year of attendance, prayer, sermons, minutes, a budget — so every screen has
 * something honest in it on the first visit. It is opt-in at setup and can be
 * cleared from Settings.
 *
 * The names are ordinary Gulf-congregation names (Filipino, Indian, Egyptian,
 * Western) because that is who these churches actually are.
 */

import { isoDate, addDays } from './format.js';
import { blank } from './schema.js';
import { SERVICE_TEMPLATES } from './ai.js';

/**
 * A representative slice of the catalogue, not all sixteen categories in
 * full — ten courses across the categories a small church actually starts
 * with, each with real (if brief) lessons, a quiz and discussion questions,
 * so the library, a course detail screen and a completed certificate all
 * have something honest to show. The schema and the UI both support the
 * full sixteen-category catalogue the spec describes; this is what ships
 * with a fresh church, not a ceiling.
 */
const COURSES = [
  {
    title: 'New Believer Foundations', category: 'Foundations of the Christian Faith', level: 'beginner',
    duration: '3 lessons · 45 min', instructor: 'Pastor Ruth Antonio',
    description: 'The first steps of following Jesus: what changed, what to expect, and how to keep going.',
    objectives: ['Explain what happens at conversion', 'Build a habit of daily prayer and reading', 'Know where to bring questions'],
    lessons: [
      { title: 'What Just Happened to Me', type: 'video', summary: 'New life in Christ, in plain language — not a feeling to chase, a fact to stand on.' },
      { title: 'Talking With God', type: 'audio', summary: 'A simple pattern for prayer any new believer can start today.' },
      {
        title: 'Finding Your People', type: 'reading', summary: 'Why a small group and a Sunday habit matter more than a perfect prayer life.',
        quiz: [{ question: 'What matters most in the first month of following Jesus?', options: ['A perfect prayer life', 'Consistency, not perfection', 'Reading the whole Bible at once'], answer: 1 }],
      },
    ],
    discussionQuestions: ['What is one thing that has already changed since you decided to follow Jesus?', 'Who could you ask when you have a question you are embarrassed to ask?'],
  },
  {
    title: 'Growing as a Disciple', category: 'Discipleship', level: 'beginner',
    duration: '4 lessons · 1 hr', instructor: 'Pastor Jomar Antonio',
    description: 'Habits that make faith durable: Scripture, prayer, community, and service.',
    objectives: ['Build a rhythm of Scripture and prayer', 'Identify one place to serve'],
    prerequisites: [],
    lessons: [
      { title: 'A Rhythm, Not a Rulebook', type: 'video', summary: 'Discipleship as a way of life, not a checklist that runs out.' },
      { title: 'Scripture You Can Actually Keep Up With', type: 'reading', summary: 'A realistic reading plan for a full-time worker.' },
      { title: 'Serving Without Burning Out', type: 'audio', summary: 'Why every disciple serves somewhere, and how to pick where.' },
      {
        title: 'Community Is Not Optional', type: 'reading', summary: 'What a small group actually gives you that Sunday alone does not.',
        quiz: [{ question: 'What is discipleship best described as?', options: ['A checklist to finish', 'A rhythm of life', 'A class you graduate from'], answer: 1 }],
      },
    ],
    discussionQuestions: ['What rhythm already works for you, and what keeps breaking it?'],
  },
  {
    title: 'Prayer That Works', category: 'Prayer', level: 'beginner',
    duration: '3 lessons · 40 min', instructor: 'Sarah Whitfield',
    description: 'Practical prayer for people who feel like they are bad at it.',
    objectives: ['Pray with more honesty and less performance', 'Keep a simple prayer list'],
    lessons: [
      { title: 'Prayer Is a Conversation', type: 'video', summary: 'Why prayer does not need better vocabulary, only more honesty.' },
      {
        title: 'When Prayer Feels Unanswered', type: 'reading', summary: 'Lament as prayer that has not given up — Psalm 13 as a model.',
        quiz: [{ question: 'What does the lesson say lament is?', options: ['A lack of faith', 'Prayer that has not given up', 'Something to avoid'], answer: 1 }],
      },
      { title: 'Keeping a Prayer List That Lasts', type: 'audio', summary: 'A five-minute weekly habit that keeps intercession from fading.' },
    ],
    discussionQuestions: ['What is one prayer you have stopped praying because it felt unanswered?'],
  },
  {
    title: 'How to Study the Bible', category: 'Bible Study', level: 'beginner',
    duration: '4 lessons · 1 hr', instructor: 'Bijoy Thomas',
    description: 'Observation, interpretation, application — a simple method for reading any passage well.',
    objectives: ['Read a passage in its context', 'Ask three questions of any text: what it says, what it means, what it asks'],
    lessons: [
      { title: 'Context Is Everything', type: 'video', summary: 'Who wrote it, to whom, and why — before asking what it means for you.' },
      { title: 'What It Says', type: 'reading', summary: 'Slow, careful observation before interpretation.' },
      { title: 'What It Means', type: 'reading', summary: 'The doctrine underneath, stated simply.' },
      {
        title: 'What It Asks of Us', type: 'audio', summary: 'Turning meaning into one concrete change for the week.',
        quiz: [{ question: 'What comes first in this method?', options: ['Application', 'Observation', 'A commentary'], answer: 1 }],
      },
    ],
    discussionQuestions: ['Pick a verse you think you already understand — what did slowing down change?'],
  },
  {
    title: 'Worship Team Essentials', category: 'Worship Ministry', level: 'intermediate',
    duration: '3 lessons · 50 min', instructor: 'Elmer Villanueva',
    description: 'Leading sung worship as a team, not a performance — for anyone new to the rota.',
    objectives: ['Understand the order of service and its purpose', 'Rehearse and lead with humility'],
    lessons: [
      { title: 'Worship Is Not the Warm-Up', type: 'video', summary: 'The theology behind why the songs matter as much as the sermon.' },
      { title: 'Leading a Team Well', type: 'reading', summary: 'Cueing, communication, and covering for each other on stage.' },
      {
        title: 'Handling a Bad Sunday', type: 'audio', summary: 'What to do when the mix is wrong or a cue is missed — mid-song.',
        quiz: [{ question: 'What does the lesson say worship on stage is?', options: ['A performance', 'A team act of service', 'The worship leader\'s moment'], answer: 1 }],
      },
    ],
    discussionQuestions: ['Describe a Sunday that did not go to plan — what actually mattered by the end?'],
  },
  {
    title: 'Teaching Children Well', category: "Children's Ministry", level: 'intermediate',
    duration: '3 lessons · 55 min', instructor: 'Christine Okafor',
    description: 'Age-appropriate teaching, classroom management, and keeping children safe.',
    objectives: ['Plan a lesson children will remember', 'Manage a classroom without losing warmth'],
    lessons: [
      { title: 'How Children Actually Learn', type: 'video', summary: 'One big idea, a story, an activity — not a lecture in miniature.' },
      { title: 'A Room That Runs Itself', type: 'reading', summary: 'Structure and routine as kindness, not control.' },
      {
        title: 'Keeping Children Safe', type: 'reading', summary: 'The two-adult rule, sign-in/sign-out, and what to do if something concerns you.',
        quiz: [{ question: 'What is the minimum adult presence per classroom?', options: ['One trusted adult', 'Two adults, always', 'Whoever is available'], answer: 1 }],
      },
    ],
    discussionQuestions: ['What is the one thing you want a child to remember from a whole year in your class?'],
  },
  {
    title: 'Sharing Your Faith', category: 'Evangelism', level: 'beginner',
    duration: '3 lessons · 45 min', instructor: 'Renjith Mathew',
    description: 'Ordinary conversations about faith, without a script or a sales pitch.',
    objectives: ['Tell your own story in under two minutes', 'Ask better questions than you give answers'],
    lessons: [
      { title: 'Your Story Is Evidence', type: 'video', summary: 'A two-minute testimony that is honest, not polished.' },
      {
        title: 'Questions Open Doors Scripts Close', type: 'reading', summary: 'Curiosity over argument, every time.',
        quiz: [{ question: 'What does the lesson recommend leading with?', options: ['An argument', 'A question', 'A tract'], answer: 1 }],
      },
      { title: 'When Someone Says No', type: 'audio', summary: 'Leaving the door open instead of forcing it.' },
    ],
    discussionQuestions: ['Who is one person you already have a real relationship with who does not yet follow Jesus?'],
  },
  {
    title: 'Biblical Leadership', category: 'Leadership Development', level: 'advanced', leaderOnly: true,
    duration: '4 lessons · 1.5 hr', instructor: 'Senior Pastor',
    description: 'What Scripture actually asks of a leader — restricted to those carrying leadership responsibility.',
    objectives: ['Distinguish authority from control', 'Lead through seasons of conflict without losing people'],
    lessons: [
      { title: 'Leadership as Service', type: 'video', summary: 'Foot-washing as the model, not the exception.' },
      { title: 'Qualifications, Not Just Gifting', type: 'reading', summary: '1 Timothy 3 and Titus 1, read honestly.' },
      { title: 'Leading Through Conflict', type: 'reading', summary: 'Naming a problem without losing the person.' },
      {
        title: 'Finishing Well', type: 'audio', summary: 'Succession and handing off responsibility without clinging to it.',
        quiz: [{ question: 'What model does the lesson use for leadership?', options: ['Command and control', 'Foot-washing service', 'Popularity'], answer: 1 }],
      },
    ],
    discussionQuestions: ['Where has your authority been more about control than service recently?'],
  },
  {
    title: 'Church Governance', category: 'Church Administration', level: 'advanced', leaderOnly: true,
    duration: '3 lessons · 1 hr', instructor: 'Church Administrator',
    description: 'How decisions actually get made and recorded — for elders, committee chairs, and staff.',
    objectives: ['Understand the decision-and-minutes cycle', 'Know what needs a vote and what does not'],
    lessons: [
      { title: 'Who Decides What', type: 'video', summary: 'Reserved matters, delegated matters, and the difference.' },
      { title: 'Minutes That Actually Help', type: 'reading', summary: 'Recording the decision, the reason, and the review date.' },
      {
        title: 'When to Slow Down', type: 'reading', summary: 'The decisions worth a second meeting before they are made.',
        quiz: [{ question: 'What should good minutes always capture, beyond the decision?', options: ['Nothing extra', 'The reason and a review date', 'Just attendance'], answer: 1 }],
      },
    ],
    discussionQuestions: ['What is a decision your church made recently without writing down why?'],
  },
  {
    title: 'Child Protection Essentials', category: 'Pastoral Care', level: 'intermediate', leaderOnly: true,
    duration: '2 lessons · 40 min', instructor: 'Church Administrator',
    description: 'Every leader\'s responsibility to keep children and vulnerable people safe.',
    objectives: ['Recognise a concern', 'Know exactly who to tell, and how fast'],
    lessons: [
      { title: 'Your Duty of Care', type: 'video', summary: 'Every leader\'s baseline responsibility, no exceptions for tenure or role.' },
      {
        title: 'What to Do If You Are Concerned', type: 'reading', summary: 'Report, do not investigate — and never promise secrecy.',
        quiz: [{ question: 'If a child discloses something concerning, what should you never promise?', options: ['To listen', 'To keep it secret', 'To tell a leader'], answer: 1 }],
      },
    ],
    discussionQuestions: ['Do you know, right now, exactly who you would tell if you were concerned?'],
  },
];

const LEARNING_PATHS = [
  {
    title: 'New Believer Path', audience: 'Anyone in their first year of faith',
    description: 'The foundation every new believer needs, in the order that actually helps.',
    courseTitles: ['New Believer Foundations', 'Growing as a Disciple', 'Prayer That Works', 'How to Study the Bible'],
  },
  {
    title: 'Ministry Leader Path', audience: 'Ministry heads, elders and staff stepping into greater responsibility',
    description: 'The training every leader needs before they carry more responsibility.',
    courseTitles: ['Biblical Leadership', 'Church Governance', 'Child Protection Essentials'],
  },
];

const PEOPLE = [
  ['Ruth Antonio', 'female', 'Philippines', 'Salmiya'], ['Jomar Antonio', 'male', 'Philippines', 'Salmiya'],
  ['Grace Villanueva', 'female', 'Philippines', 'Hawally'], ['Elmer Villanueva', 'male', 'Philippines', 'Hawally'],
  ['Anjali Thomas', 'female', 'India', 'Abbasiya'], ['Bijoy Thomas', 'male', 'India', 'Abbasiya'],
  ['Sherry Mathew', 'female', 'India', 'Farwaniya'], ['Renjith Mathew', 'male', 'India', 'Farwaniya'],
  ['Mina Girgis', 'female', 'Egypt', 'Mangaf'], ['Peter Girgis', 'male', 'Egypt', 'Mangaf'],
  ['Sarah Whitfield', 'female', 'United Kingdom', 'Mishref'], ['Daniel Whitfield', 'male', 'United Kingdom', 'Mishref'],
  ['Joy Mendoza', 'female', 'Philippines', 'Fahaheel'], ['Rico Mendoza', 'male', 'Philippines', 'Fahaheel'],
  ['Divya Nair', 'female', 'India', 'Jleeb'], ['Arun Nair', 'male', 'India', 'Jleeb'],
  ['Christine Okafor', 'female', 'Nigeria', 'Khaitan'], ['Emeka Okafor', 'male', 'Nigeria', 'Khaitan'],
  ['Lorna Bautista', 'female', 'Philippines', 'Jabriya'], ['Nestor Bautista', 'male', 'Philippines', 'Jabriya'],
  ['Hannah Kim', 'female', 'South Korea', 'Salwa'], ['Samuel Kim', 'male', 'South Korea', 'Salwa'],
  ['Marilyn Castro', 'female', 'Philippines', 'Salmiya'], ['Jenny Rodrigues', 'female', 'India', 'Abbasiya'],
  ['Paul Sebastian', 'male', 'India', 'Salmiya'], ['Ana Lucero', 'female', 'Philippines', 'Mahboula'],
  ['Kevin Fernandes', 'male', 'India', 'Fintas'], ['Rowena Dizon', 'female', 'Philippines', 'Mangaf'],
  ['Michael Adeyemi', 'male', 'Nigeria', 'Farwaniya'], ['Blessing Adeyemi', 'female', 'Nigeria', 'Farwaniya'],
  ['Cherry Lim', 'female', 'Philippines', 'Salmiya'], ['Roberto Lim', 'male', 'Philippines', 'Salmiya'],
  ['Sneha Varghese', 'female', 'India', 'Abbasiya'], ['Tony Varghese', 'male', 'India', 'Abbasiya'],
  ['Faith Owusu', 'female', 'Ghana', 'Hawally'], ['Isaac Owusu', 'male', 'Ghana', 'Hawally'],
];

const MINISTRIES = [
  ['Worship', 'Leads the congregation in sung worship at every service.', 'Thursday 7pm', 6],
  ['Children', 'Teaches and cares for children during Friday worship.', 'Friday 9am', 8],
  ['Youth', 'Walks with teenagers through school, family and faith.', 'Friday 6pm', 4],
  ['Ushering & Welcome', 'The first face a visitor sees.', 'Rotating', 6],
  ['Prayer', 'Keeps the prayer chain and the Tuesday prayer meeting.', 'Tuesday 8pm', 5],
  ['Media & Sound', 'Sound, slides and the recording.', 'Rotating', 4],
  ['Care & Visitation', 'Hospital visits, bereavement, practical help.', 'As needed', 5],
  ['Evangelism', 'Outreach, first contact and the road to baptism.', 'Saturday mornings', 4],
  ['Discipleship', 'Small groups and the path from new believer to leader.', 'Wednesday 7pm', 4],
];

const SONGS = [
  ['Great Is Thy Faithfulness', 'Thomas Chisholm', 'Bb', 72, ['faithfulness', 'provision'], 'Lamentations 3:22-23', 'adoration'],
  ['How Great Is Our God', 'Chris Tomlin', 'C', 78, ['greatness', 'trinity'], 'Psalm 104', 'adoration'],
  ['Cornerstone', 'Hillsong', 'C', 70, ['hope', 'foundation'], 'Matthew 7:24-27', 'declaration'],
  ['10,000 Reasons', 'Matt Redman', 'G', 73, ['thanksgiving', 'worship'], 'Psalm 103', 'celebration'],
  ['In Christ Alone', 'Getty & Townend', 'D', 68, ['gospel', 'assurance'], 'Colossians 1', 'declaration'],
  ['What a Beautiful Name', 'Hillsong', 'D', 68, ['jesus', 'name'], 'Philippians 2', 'adoration'],
  ['Way Maker', 'Sinach', 'E', 70, ['miracles', 'presence'], 'Isaiah 43:19', 'declaration'],
  ['Goodness of God', 'Bethel', 'Ab', 63, ['goodness', 'testimony'], 'Psalm 23', 'reflection'],
  ['Salamat Panginoon', 'Traditional', 'G', 76, ['thanksgiving', 'tagalog'], 'Psalm 100', 'celebration'],
  ['Be Thou My Vision', 'Irish hymn', 'Eb', 66, ['guidance', 'devotion'], 'Proverbs 3:5-6', 'reflection'],
  ['The Lord Is My Salvation', 'Getty', 'G', 72, ['salvation', 'hope'], 'Psalm 27', 'declaration'],
  ['Christ Our Hope in Life and Death', 'Getty', 'C', 70, ['death', 'hope', 'comfort'], '1 Corinthians 15', 'reflection'],
];

const SERMON_TITLES = [
  ['The God Who Sees', 'Genesis 16:1-16', 'God meets the overlooked by name.'],
  ['Bread for the Journey', '1 Kings 19:1-18', 'God feeds the exhausted before he corrects them.'],
  ['Far From Home, Not From God', 'Jeremiah 29:1-14', 'Faithfulness in a place you did not choose.'],
  ['The Cost of Following', 'Luke 9:57-62', 'Discipleship is a decision with a price attached.'],
  ['One Body, Many Nations', '1 Corinthians 12:12-27', 'A church of many passports is not a problem to solve.'],
  ['When Prayer Feels Unanswered', 'Psalm 13', 'Lament is prayer that has not given up.'],
  ['Money and the Kingdom', 'Luke 16:1-13', 'What we do with money says what we believe.'],
  ['Rest Is Not Laziness', 'Mark 6:30-44', 'Sabbath as resistance to a culture of overwork.'],
];

const PRAYERS = [
  ['Visa renewal for the Mendoza family', 'work', true],
  ['Healing after surgery', 'health', true],
  ['Safe travel home for the holidays', 'travel', false],
  ['Work permit transfer', 'work', false],
  ['Strength for a mother caring for a sick child', 'family', true],
  ['New job after redundancy', 'work', false],
  ['Peace in a difficult marriage', 'family', false],
  ['Thanksgiving: a son passed his exams', 'thanksgiving', false],
  ['Wisdom for the leadership as we plan next year', 'spiritual', false],
  ['For those separated from their children', 'family', false],
];

const GIVING_CATEGORIES = ['Tithes', 'Offerings', 'Missions', 'Building fund', 'Benevolence'];
const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Ministry supplies', 'Benevolence', 'Events', 'Media & equipment', 'Staff support'];

/**
 * Fill an empty tenant with a demonstration congregation.
 * @param {import('./db.js').Database} db
 * @param {{user?: object, now?: Date}} [opts]
 */
export function seedTenant(db, { user = null, now = new Date() } = {}) {
  const actorWas = db.actor;
  // The seeder writes across every collection; permission checks belong to the
  // human who asked for it, and they were checked before we got here.
  const opts = { skipPermission: true, skipAudit: true };
  if (user) db.setActor(user);

  /* Ministries */
  const ministries = MINISTRIES.map(([name, purpose, meetingDay, minVolunteers]) =>
    db.insert('ministries', blank('ministries', { name, purpose, meetingDay, minVolunteers }), opts));

  /* Families and people */
  const members = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const [fullName, gender, nationality, area] = PEOPLE[i];
    const surname = fullName.split(' ').pop();
    let family = db.first('families', (f) => f.name === `${surname} family`);
    if (!family) family = db.insert('families', blank('families', { name: `${surname} family`, area }), opts);

    const yearsAgo = (i % 9) + 1;
    const status = i < 26 ? 'member' : i < 32 ? 'regular' : 'visitor';
    const member = db.insert('members', blank('members', {
      fullName,
      gender,
      nationality,
      area,
      language: nationality === 'Philippines' ? 'English' : 'English',
      phone: `+965 9${String(700000 + i * 137).slice(0, 6)}`,
      email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      status,
      joinedOn: isoDate(addDays(now, -365 * yearsAgo - (i * 3))),
      membershipDate: status === 'member' ? isoDate(addDays(now, -365 * yearsAgo + 60)) : null,
      birthDate: isoDate(new Date(1968 + (i % 30), i % 12, ((i * 7) % 27) + 1)),
      baptised: status === 'member',
      baptismDate: status === 'member' ? isoDate(addDays(now, -365 * yearsAgo + 90)) : null,
      newBeliever: i >= 30 && i <= 33,
      maritalStatus: i < 22 ? 'married' : 'single',
      anniversary: i < 22 ? isoDate(new Date(2000 + (i % 20), (i + 4) % 12, ((i * 5) % 26) + 1)) : null,
      familyId: family.id,
      familyRole: i % 2 === 0 ? 'spouse' : 'head',
      ministries: [ministries[i % ministries.length].name].concat(i % 5 === 0 ? [ministries[(i + 3) % ministries.length].name] : []),
      emergencyName: PEOPLE[(i + 1) % PEOPLE.length][0],
      emergencyPhone: `+965 6${String(500000 + i * 211).slice(0, 6)}`,
      emergencyRelation: 'Church family',
      careLevel: i % 11 === 0 ? 'watch' : 'none',
    }), opts);
    members.push(member);
  }

  /* Ministry heads */
  ministries.forEach((ministry, i) => {
    db.update('ministries', ministry.id, { leadId: members[i * 2].id }, opts);
  });

  /* A year of attendance, twice a week, with a plausible dip in summer */
  const services = ['Friday Worship', 'Sunday Worship'];
  for (let week = 52; week >= 0; week--) {
    for (const service of services) {
      const date = addDays(now, -week * 7 - (service === 'Friday Worship' ? 2 : 0));
      const summerDip = [5, 6, 7].includes(date.getMonth()) ? 0.72 : 1;
      const base = service === 'Friday Worship' ? 0.78 : 0.55;
      const share = Math.round(members.length * base * summerDip * (0.85 + ((week % 5) * 0.06)));
      const present = members.slice(0, Math.min(members.length, Math.max(8, share))).map((m) => m.id);
      const visitors = (week % 4 === 0 ? 3 : 1) + (service === 'Friday Worship' ? 2 : 0);
      const attended = present.filter((_, idx) => (idx + week) % 7 !== 0);
      db.insert('attendance', blank('attendance', {
        date: isoDate(date),
        service,
        memberIds: attended,
        visitors,
        total: attended.length + visitors,
      }), opts);
    }
  }

  /* Care and follow-ups */
  const careItems = [
    ['follow-up', 'Has not been at worship for a month', 'urgent', -6],
    ['visit', 'Hospital visit after surgery', 'urgent', -1],
    ['call', 'Check in after job loss', 'normal', 2],
    ['need', 'Family needs help with rent this month', 'urgent', 1],
    ['message', 'Welcome message to a first-time visitor', 'normal', 3],
    ['bereavement', 'Father passed away back home', 'urgent', 0],
    ['follow-up', 'New believer — arrange discipleship', 'normal', 5],
  ];
  careItems.forEach(([type, summary, priority, dueOffset], i) => {
    db.insert('care', blank('care', {
      memberId: members[(i * 4) % members.length].id,
      type, summary, priority,
      dueDate: isoDate(addDays(now, dueOffset)),
      detail: '',
      completedAt: i > 4 ? new Date(addDays(now, -3)).toISOString() : null,
      assignedTo: user ? user.id : null,
    }), opts);
  });

  /* Prayer */
  const chain = db.insert('prayerChains', blank('prayerChains', {
    name: 'Tuesday prayer chain',
    purpose: 'Urgent requests circulated the same day.',
    memberIds: members.slice(0, 10).map((m) => m.id),
  }), opts);
  PRAYERS.forEach(([title, category, urgent], i) => {
    db.insert('prayers', blank('prayers', {
      title, category, urgent,
      memberId: members[(i * 3) % members.length].id,
      visibility: i % 5 === 0 ? 'leaders' : 'wall',
      status: i % 4 === 3 ? 'answered' : i % 3 === 0 ? 'praying' : 'open',
      answeredNote: i % 4 === 3 ? 'Answered — reported at Tuesday prayer.' : '',
      answeredOn: i % 4 === 3 ? isoDate(addDays(now, -9)) : null,
      prayedCount: (i * 7) % 23,
      chainId: urgent ? chain.id : null,
      createdAt: new Date(addDays(now, -i * 4)).toISOString(),
    }), opts);
  });

  /* Worship */
  const songs = SONGS.map(([title, author, key, bpm, themes, scripture, mood]) =>
    db.insert('songs', blank('songs', {
      title, author, key, bpm, themes, scripture, mood,
      language: title === 'Salamat Panginoon' ? 'Tagalog' : 'English',
      lyrics: '',
    }), opts));
  for (let week = 0; week < 8; week++) {
    const date = addDays(now, (week - 4) * 7);
    db.insert('setlists', blank('setlists', {
      title: 'Friday Worship',
      date: isoDate(date),
      songIds: [songs[week % songs.length].id, songs[(week + 3) % songs.length].id, songs[(week + 6) % songs.length].id, songs[(week + 9) % songs.length].id],
      leadId: members[(week * 2) % members.length].id,
      team: ['Keys', 'Acoustic', 'Bass', 'Drums', 'Vocals ×2'],
      rehearsal: new Date(addDays(date, -1)).toISOString(),
    }), opts);
  }

  /* Annual worship service schedule — the weeks line up with the Friday
     attendance already seeded above, so past services show "recorded" and
     future ones show "pending" exactly as they would in a real church.
     Friday and Sunday are seeded from the same two templates a real church
     picks when creating a service, and one upcoming service is forced onto
     the communion override so the indicator is visible without waiting for
     the calendar to land on a first Friday or first Sunday. */
  const makeService = (serviceType, date, idx) => db.insert('serviceSchedule', blank('serviceSchedule', {
    date: isoDate(date),
    serviceType,
    ...SERVICE_TEMPLATES[serviceType],
    theme: SERMON_TITLES[idx % SERMON_TITLES.length][0],
    scripture: SERMON_TITLES[idx % SERMON_TITLES.length][1],
    preacherId: members[0].id,
    presidingLeaderId: members[(idx + 3) % members.length].id,
    worshipSongLeaderId: members[(idx + 1) % members.length].id,
    emceeId: members[(idx + 6) % members.length].id,
    communionOverride: idx === 2 ? 'yes' : 'auto',
    communionMinisterId: members[0].id,
    mediaId: members[(idx + 2) % members.length].id,
    soundId: members[(idx + 5) % members.length].id,
    usherId: members[(idx + 8) % members.length].id,
    securityId: members[(idx + 9) % members.length].id,
    hospitalityId: members[(idx + 14) % members.length].id,
    prayerTeamId: members[(idx + 15) % members.length].id,
    photographyId: idx % 3 === 0 ? members[(idx + 16) % members.length].id : null,
    childrenYouthLeaderId: members[(idx + 11) % members.length].id,
    childrenYouthAssistantId: members[(idx + 12) % members.length].id,
    childrenYouthClassroom: idx % 2 === 0 ? 'Room 1' : 'Room 2',
    status: date < now ? 'completed' : 'confirmed',
  }), opts);
  [3, 2, 1, 0].forEach((week, idx) => makeService('friday', addDays(now, -week * 7 - 2), idx));
  [1, 2, 3, 4].forEach((week, idx) => makeService('friday', addDays(now, week * 7 - 2), idx + 4));
  [3, 2, 1, 0].forEach((week, idx) => makeService('sunday', addDays(now, -week * 7), idx + 1));
  [1, 2, 3, 4].forEach((week, idx) => makeService('sunday', addDays(now, week * 7), idx + 5));

  /* Preaching */
  const series = db.insert('series', blank('series', {
    title: 'Far From Home',
    bigIdea: 'What it means to follow Jesus in a country you did not grow up in.',
    startDate: isoDate(addDays(now, -35)),
    endDate: isoDate(addDays(now, 21)),
    book: 'Jeremiah & Luke',
  }), opts);
  SERMON_TITLES.forEach(([title, passage, bigIdea], i) => {
    const date = addDays(now, (i - 5) * 7);
    db.insert('sermons', blank('sermons', {
      title, passage, bigIdea,
      date: isoDate(date),
      seriesId: i < 5 ? series.id : null,
      preacherId: members[0].id,
      status: date < now ? 'preached' : 'drafting',
      tags: ['migrant life', 'discipleship'],
    }), opts);
  });
  [['The ferry that waited', 'illustration', 'A story about a boat that held its departure for one late passenger — and what it says about grace.'],
   ['Bonhoeffer on cheap grace', 'quote', '"Cheap grace is the preaching of forgiveness without requiring repentance." — Dietrich Bonhoeffer, The Cost of Discipleship'],
   ['Migrant workers in the Gulf', 'statistic', 'A majority of the population in several Gulf states are expatriate workers — verify current figures with an official source before quoting from the pulpit.'],
  ].forEach(([title, kind, body]) => db.insert('illustrations', blank('illustrations', { title, kind, body }), opts));

  /* Events */
  const eventSeeds = [
    ['Church Retreat 2026', 'retreat', 21, 'Kuwait Chalets, Khiran', 850],
    ['Baptism Service', 'baptism', 12, 'Main hall', 60],
    ['Leaders Training Day', 'training', 30, 'Church office', 120],
    ['Christmas Fellowship', 'fellowship', 60, 'Main hall', 400],
    ['Friday Worship', 'service', 3, 'Main hall', 0],
  ];
  eventSeeds.forEach(([title, type, inDays, venue, budget], i) => {
    const event = db.insert('events', blank('events', {
      title, type, venue, budget,
      startsAt: new Date(addDays(now, inDays).setHours(18, 30, 0, 0)).toISOString(),
      endsAt: new Date(addDays(now, inDays).setHours(21, 0, 0, 0)).toISOString(),
      ownerId: members[i].id,
      status: i === 0 ? 'planning' : 'confirmed',
      capacity: 120,
      description: '',
      checkinCode: `SHP-${String(1000 + i * 7)}`,
    }), opts);
    ['Set-up team', 'Welcome desk', 'Sound & slides', 'Refreshments', 'Clean-up'].forEach((task, t) => {
      db.insert('eventTasks', blank('eventTasks', {
        eventId: event.id,
        title: task,
        ownerId: (t + i) % 3 === 0 ? null : members[(i * 5 + t) % members.length].id,
        dueDate: isoDate(addDays(now, Math.max(0, inDays - 2))),
        role: task,
      }), opts);
    });
  });

  /* Leadership */
  const committee = db.insert('committees', blank('committees', {
    name: 'Church Council',
    mandate: 'Governance, budget and the annual plan.',
    chairId: members[0].id,
    memberIds: members.slice(0, 6).map((m) => m.id),
    cadence: 'Monthly, first Tuesday',
  }), opts);
  for (let i = 0; i < 4; i++) {
    const meeting = db.insert('meetings', blank('meetings', {
      title: `Church Council — ${['January', 'February', 'March', 'April'][i]}`,
      date: new Date(addDays(now, -(4 - i) * 30).setHours(19, 30, 0, 0)).toISOString(),
      committeeId: committee.id,
      attendees: members.slice(0, 6).map((m) => m.id),
      agenda: '1. Prayer\n2. Minutes\n3. Finance\n4. Ministry reports\n5. Any other business',
      minutes: 'The council agreed to raise the benevolence budget for the coming quarter.\n'
        + 'Youth ministry asked for two more volunteers; the care team will approach families directly.\n'
        + 'Decided: the annual retreat will move to the second weekend to avoid exam season.',
    }), opts);
    if (i === 3) {
      db.insert('decisions', blank('decisions', {
        title: 'Retreat moves to the second weekend',
        date: isoDate(addDays(now, -30)),
        decision: 'The annual retreat will be held on the second weekend of the month from now on.',
        rationale: 'The first weekend clashes with school examinations, which kept families away two years running.',
        meetingId: meeting.id,
        area: 'Events',
      }), opts);
    }
    ['Recruit two youth volunteers', 'Get three quotes for the sound desk', 'Draft the benevolence policy'].forEach((title, t) => {
      if ((t + i) % 2) return;
      db.insert('actionItems', blank('actionItems', {
        title,
        meetingId: meeting.id,
        ownerId: members[t].id,
        dueDate: isoDate(addDays(now, 7 * (t + 1))),
        status: i < 2 ? 'done' : 'open',
      }), opts);
    });
  }
  [['Grow midweek small groups from 4 to 7', 60, 100, '%'],
   ['Every new believer paired with a mentor within 30 days', 40, 100, '%'],
   ['Complete the benevolence policy and publish it', 25, 100, '%'],
  ].forEach(([title, progress, target, unit]) => db.insert('goals', blank('goals', {
    title, progress, target, unit, year: now.getFullYear(), ownerId: members[0].id,
  }), opts));

  /* Annual planning — vision, objectives, KPIs and budget, per ministry. */
  const worshipMinistry = ministries.find((m) => m.name === 'Worship');
  const childrenMinistry = ministries.find((m) => m.name === 'Children');
  if (worshipMinistry) {
    db.insert('annualPlans', blank('annualPlans', {
      ministryId: worshipMinistry.id,
      year: now.getFullYear(),
      title: 'Worship Ministry Plan',
      vision: 'Lead the congregation into unhurried, Christ-centred worship, in a room that sounds like how many nations already call this church home.',
      objectives: ['Recruit two more vocalists', 'Introduce one Tagalog song a month', 'Build a rehearsal recording library'],
      kpis: ['4 vocalists on rotation', '12 songs recorded', 'Rehearsal attendance above 80%'],
      budget: 1200,
      volunteerNeeds: 'Two vocalists, one keyboardist.',
      status: 'active',
    }), opts);
  }
  if (childrenMinistry) {
    db.insert('annualPlans', blank('annualPlans', {
      ministryId: childrenMinistry.id,
      year: now.getFullYear(),
      title: "Children's Ministry Plan",
      vision: "Every child under our roof knows the Bible's big story by the time they reach youth group.",
      objectives: ['Finish the two-year curriculum cycle', 'Train two new teachers', 'Reduce teacher turnover'],
      kpis: ['90% curriculum completion', '2 teachers trained', 'Under 20% turnover'],
      budget: 400,
      status: 'active',
    }), opts);
  }

  /* Finance */
  const year = now.getFullYear();
  const budgetLines = [['Rent', 9600], ['Utilities', 1800], ['Ministry supplies', 2400], ['Benevolence', 3600], ['Events', 3000], ['Media & equipment', 1500], ['Staff support', 7200]];
  budgetLines.forEach(([category, amount]) => db.insert('budgets', blank('budgets', {
    name: `${category} ${year}`, year, category, amount, department: category,
  }), opts));

  const project = db.insert('projects', blank('projects', { name: 'Sound desk replacement', goal: 2200 }), opts);
  for (let week = 26; week >= 0; week--) {
    const date = isoDate(addDays(now, -week * 7));
    GIVING_CATEGORIES.forEach((category, c) => {
      if ((week + c) % 3 === 0 || c < 2) {
        db.insert('transactions', blank('transactions', {
          kind: 'giving', date, category,
          amount: Number((c === 0 ? 420 + (week % 9) * 18 : 60 + ((week * (c + 2)) % 90)).toFixed(3)),
          method: c % 2 ? 'knet' : 'cash',
          description: `${category} — week of ${date}`,
          memberId: (week + c) % 4 === 0 ? members[(week + c) % members.length].id : null,
          anonymous: (week + c) % 4 !== 0,
          projectId: category === 'Building fund' ? project.id : null,
        }), opts);
      }
    });
    if (week % 4 === 0) {
      EXPENSE_CATEGORIES.forEach((category, c) => {
        if ((week + c) % 2) return;
        db.insert('transactions', blank('transactions', {
          kind: 'expense', date, category,
          amount: Number((category === 'Rent' ? 800 : 40 + ((week * (c + 3)) % 210)).toFixed(3)),
          description: `${category}`,
          department: category,
          method: 'transfer',
          status: week === 0 && c > 3 ? 'pending-approval' : 'approved',
        }), opts);
      });
    }
  }

  /* Documents */
  [['Child Protection Policy', 'policy', 'Adopted by the council. Reviewed annually.', null],
   ['Tenancy agreement — main hall', 'lease', 'Landlord contact and renewal terms.', addDays(now, 45)],
   ['Public liability insurance', 'insurance', 'Certificate and policy schedule.', addDays(now, 12)],
   ['Benevolence Fund Guidelines', 'policy', 'Who may request help, and how it is approved.', null],
   ['Volunteer Handbook', 'training', 'Given to every new volunteer.', null],
   ['Council minutes — archive', 'minutes', 'Signed minutes, previous years.', null],
  ].forEach(([title, category, description, expiresOn]) => db.insert('documents', blank('documents', {
    title, category, description,
    expiresOn: expiresOn ? isoDate(expiresOn) : null,
    tags: [category],
    content: `${title}\n\n${description}\n\n(Example record — replace with the real document.)`,
    fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
    mimeType: 'text/plain',
    size: 400,
  }), opts));

  /* Knowledge */
  [['Who approves benevolence requests?', 'Requests up to KD 100 are approved by the pastor; anything above goes to the council. See the Benevolence Fund Guidelines in the vault.'],
   ['What did the council decide about the retreat weekend?', 'From the April meeting: the retreat moves to the second weekend of the month, because the first clashed with school examinations.'],
   ['How do we welcome a first-time visitor?', 'The welcome desk takes their name and number with consent, a leader greets them before they leave, and someone messages them within 48 hours.'],
  ].forEach(([question, answer]) => db.insert('knowledge', blank('knowledge', { question, answer, tags: ['policy'] }), opts));

  /* Communications */
  [['Retreat registration is open', 'Registration for the church retreat is open until the end of the month. Places are limited — speak to the coordinator after the service.', 'whatsapp', 'sent'],
   ['Prayer meeting moves to Tuesday', 'From next week the prayer meeting is on Tuesday at 8pm, in the side hall.', 'app', 'sent'],
   ['Volunteers needed for children\'s ministry', 'We need two more volunteers for Friday mornings. Training and a DBS-equivalent check are provided.', 'email', 'draft'],
  ].forEach(([title, body, channel, status]) => db.insert('announcements', blank('announcements', {
    title, body, channel, status,
    sentAt: status === 'sent' ? new Date(addDays(now, -5)).toISOString() : null,
  }), opts));

  /* Equip — learning & training */
  const courseByTitle = new Map();
  for (const spec of COURSES) {
    const { prerequisites: prereqTitles, ...rest } = spec;
    const course = db.insert('courses', blank('courses', {
      ...rest,
      prerequisites: (prereqTitles || []).map((t) => courseByTitle.get(t)).filter(Boolean),
    }), opts);
    courseByTitle.set(spec.title, course);
  }
  for (const path of LEARNING_PATHS) {
    db.insert('learningPaths', blank('learningPaths', {
      title: path.title,
      description: path.description,
      audience: path.audience,
      courseIds: path.courseTitles.map((t) => courseByTitle.get(t).id),
    }), opts);
  }
  // A little learning history for the member the signed-in account links to
  // below, so the Equip dashboard has a completed course, a certificate and
  // one course in progress on the very first visit, not an empty screen.
  const foundations = courseByTitle.get('New Believer Foundations');
  const discipleship = courseByTitle.get('Growing as a Disciple');
  const prayerCourse = courseByTitle.get('Prayer That Works');
  if (foundations) {
    db.insert('enrollments', blank('enrollments', {
      memberId: members[0].id, courseId: foundations.id, status: 'completed',
      completedLessons: (foundations.lessons || []).map((_, i) => String(i)),
      startedAt: isoDate(addDays(now, -40)), completedAt: isoDate(addDays(now, -30)),
    }), opts);
    db.insert('certificates', blank('certificates', {
      memberId: members[0].id, courseId: foundations.id, courseTitle: foundations.title,
      instructor: foundations.instructor, issuedAt: isoDate(addDays(now, -30)),
      certificateNumber: `CERT-${new Date(addDays(now, -30)).getFullYear()}-0001`,
      verificationId: `ver_${foundations.id}${members[0].id}`.slice(0, 24),
    }), opts);
  }
  if (discipleship) {
    db.insert('enrollments', blank('enrollments', {
      memberId: members[0].id, courseId: discipleship.id, status: 'in-progress',
      completedLessons: (discipleship.lessons || []).slice(0, 2).map((_, i) => String(i)),
      startedAt: isoDate(addDays(now, -10)),
    }), opts);
  }
  if (prayerCourse) {
    db.insert('enrollments', blank('enrollments', { memberId: members[1].id, courseId: prayerCourse.id, status: 'not-started' }), opts);
  }

  // Link the signed-in account to a member profile, so the role-based
  // dashboard, the leader task centre and ministry workspace access — all of
  // which key off a user's linked member — have something real to show on
  // the very first login rather than the "link your profile" empty state.
  if (user && !user.memberId && db.find('users', user.id)) {
    db.update('users', user.id, { memberId: members[0].id }, { skipPermission: true, skipAudit: true });
    user.memberId = members[0].id;
  }

  db.setActor(actorWas);
  if (user) db.setActor(user);
  db.log('seed', 'Example data added.');
  return db;
}

/** Remove example data, leaving users and settings alone. */
export function clearSeedData(db) {
  for (const name of ['members', 'families', 'attendance', 'care', 'counseling', 'ministries',
    'committees', 'meetings', 'actionItems', 'decisions', 'goals', 'songs', 'setlists',
    'series', 'sermons', 'illustrations', 'prayers', 'prayerChains', 'events', 'eventTasks',
    'checkins', 'budgets', 'transactions', 'projects', 'documents', 'knowledge', 'announcements',
    'serviceSchedule', 'annualPlans']) {
    db.data.set(name, new Map());
    db.dirty.add(name);
  }
  db.log('seed.clear', 'Example data removed.');
  return db.flush();
}
