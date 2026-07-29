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
      db.insert('attendance', blank('attendance', {
        date: isoDate(date),
        service,
        memberIds: present.filter((_, idx) => (idx + week) % 7 !== 0),
        visitors,
        total: present.length + visitors,
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
    'checkins', 'budgets', 'transactions', 'projects', 'documents', 'knowledge', 'announcements']) {
    db.data.set(name, new Map());
    db.dirty.add(name);
  }
  db.log('seed.clear', 'Example data removed.');
  return db.flush();
}
