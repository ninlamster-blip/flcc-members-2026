'use strict';

const FLCC_GMPI_DATA = {
  meta: {
    churchName: 'FLCC-GMPI',
    fullName: 'FLCC — Grace Ministry Philippines International',
    leadPastor: 'Pastor Michelle',
    serviceDay: 'Friday',
    year: 2026
  },
  team: [
    { id: 'jp',     name: 'JP',     displayName: 'Ptr. JP',     roles: ['Preacher','Pastoral Prayer','EMCEE'], status: 'active',   note: '' },
    { id: 'ver',    name: 'Ver',    displayName: 'Ptr. Ver',    roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: '' },
    { id: 'rodel',  name: 'Rodel',  displayName: 'Ptr. Rodel',  roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: '' },
    { id: 'oca',    name: 'Oca',    displayName: 'Ptr. Oca',    roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: 'Vacation dates pending' },
    { id: 'ellen',  name: 'Ellen',  displayName: 'Ptra. Ellen', roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: 'Retiring mid-August 2026' },
    { id: 'cathy',  name: 'Cathy',  displayName: 'Ptra. Cathy', roles: ['Preacher','Pastoral Prayer','EMCEE'], status: 'active',   note: '' },
    { id: 'anson',  name: 'Anson',  displayName: 'Ptr. Anson',  roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: '' },
    { id: 'verna',  name: 'Verna',  displayName: 'Ptra. Verna', roles: ['Preacher','Pastoral Prayer','EMCEE'], status: 'active',   note: '' },
    { id: 'doddie', name: 'Doddie', displayName: 'Ptr. Doddie', roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: '' },
    { id: 'mike',   name: 'Mike',   displayName: 'Ptr. Mike',   roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: 'Not travelling' },
    { id: 'froi',   name: 'Froi',   displayName: 'Ptr. Froi',   roles: ['Preacher','Pastoral Prayer','EMCEE'], status: 'active',   note: '' },
    { id: 'mitch',  name: 'Mitch',  displayName: 'Ptra. Mitch', roles: ['Preacher','Pastoral Prayer','EMCEE'], status: 'active',   note: '' },
    { id: 'justin', name: 'Justin', displayName: 'Ptr. Justin', roles: ['Preacher','Pastoral Prayer'],          status: 'active',   note: '' },
    { id: 'wing',   name: 'Wing',   displayName: 'Ptr. Wing',   roles: ['Preacher','Pastoral Prayer','EMCEE'], status: 'active',   note: '' }
  ],
  vacations: [
    { id: 'v1',  personId: 'jp',     personName: 'JP',     startDate: '2026-02-02', endDate: '2026-04-26', status: 'confirmed', notes: 'First leave period' },
    { id: 'v2',  personId: 'jp',     personName: 'JP',     startDate: '2026-06-11', endDate: '2026-10-01', status: 'confirmed', notes: 'Second leave period' },
    { id: 'v3',  personId: 'ver',    personName: 'Ver',    startDate: '2026-08-21', endDate: '2026-10-10', status: 'confirmed', notes: '' },
    { id: 'v4',  personId: 'rodel',  personName: 'Rodel',  startDate: '2026-01-24', endDate: '2026-01-31', status: 'confirmed', notes: 'Short leave' },
    { id: 'v5',  personId: 'rodel',  personName: 'Rodel',  startDate: '2026-05-31', endDate: '2026-07-07', status: 'confirmed', notes: '' },
    { id: 'v6',  personId: 'oca',    personName: 'Oca',    startDate: '',           endDate: '',           status: 'pending',   notes: 'Vacation dates TBD' },
    { id: 'v7',  personId: 'ellen',  personName: 'Ellen',  startDate: '2026-08-15', endDate: '2026-12-31', status: 'confirmed', notes: 'Retiring mid-August 2026' },
    { id: 'v8',  personId: 'cathy',  personName: 'Cathy',  startDate: '2026-10-27', endDate: '2026-11-30', status: 'confirmed', notes: '' },
    { id: 'v9',  personId: 'anson',  personName: 'Anson',  startDate: '2026-05-08', endDate: '2026-06-07', status: 'confirmed', notes: 'First leave period' },
    { id: 'v10', personId: 'anson',  personName: 'Anson',  startDate: '2026-12-19', endDate: '2027-01-16', status: 'confirmed', notes: 'Second leave (into 2027)' },
    { id: 'v11', personId: 'verna',  personName: 'Verna',  startDate: '2026-06-16', endDate: '2026-08-30', status: 'confirmed', notes: '' },
    { id: 'v12', personId: 'doddie', personName: 'Doddie', startDate: '2026-12-01', endDate: '2026-12-31', status: 'confirmed', notes: '' },
    { id: 'v13', personId: 'froi',   personName: 'Froi',   startDate: '2026-09-16', endDate: '2026-10-31', status: 'confirmed', notes: '' },
    { id: 'v14', personId: 'mitch',  personName: 'Mitch',  startDate: '2026-10-30', endDate: '2026-12-03', status: 'confirmed', notes: '' },
    { id: 'v15', personId: 'justin', personName: 'Justin', startDate: '2026-06-25', endDate: '2026-08-07', status: 'confirmed', notes: '' },
    { id: 'v16', personId: 'wing',   personName: 'Wing',   startDate: '2026-12-01', endDate: '2026-12-31', status: 'confirmed', notes: '' }
  ],
  holidays: [
    { id: 'h1',  name: "New Year's Day",        date: '2026-01-01', type: 'public',   notes: '' },
    { id: 'h2',  name: 'Isra & Miraj',           date: '2026-01-27', type: 'islamic',  notes: "Prophet's Ascension Night" },
    { id: 'h3',  name: 'National Day',           date: '2026-02-25', type: 'national', notes: 'Kuwait National Day' },
    { id: 'h4',  name: 'Liberation Day',         date: '2026-02-26', type: 'national', notes: 'Kuwait Liberation Day' },
    { id: 'h5',  name: 'Eid Al Fitr (Day 1)',    date: '2026-03-31', type: 'islamic',  notes: 'Eid Al Fitr Celebration' },
    { id: 'h6',  name: 'Eid Al Fitr (Day 2)',    date: '2026-04-01', type: 'islamic',  notes: '' },
    { id: 'h7',  name: 'Eid Al Fitr (Day 3)',    date: '2026-04-02', type: 'islamic',  notes: '' },
    { id: 'h8',  name: 'Arafat Day',             date: '2026-06-26', type: 'islamic',  notes: 'Day of Arafat' },
    { id: 'h9',  name: 'Eid Al Adha (Day 1)',    date: '2026-06-27', type: 'islamic',  notes: 'Feast of Sacrifice' },
    { id: 'h10', name: 'Eid Al Adha (Day 2)',    date: '2026-06-28', type: 'islamic',  notes: '' },
    { id: 'h11', name: 'Eid Al Adha (Day 3)',    date: '2026-06-29', type: 'islamic',  notes: '' },
    { id: 'h12', name: 'Islamic New Year',        date: '2026-07-17', type: 'islamic',  notes: 'Hijri New Year 1448' },
    { id: 'h13', name: "Prophet's Birthday",      date: '2026-09-25', type: 'islamic',  notes: 'Mawlid Al Nabi' }
  ],
  events: [
    { id: 'e1', name: 'Leadership Summit (LS)',         date: '2026-06-05', category: 'special',     notes: '' },
    { id: 'e2', name: 'Church Anniversary',              date: '',           category: 'celebration', notes: 'Date TBD' },
    { id: 'e3', name: "Mother's Day",                    date: '2026-05-08', category: 'celebration', notes: 'Second Friday of May' },
    { id: 'e4', name: "Father's Day",                    date: '2026-06-19', category: 'celebration', notes: 'Third Friday of June' },
    { id: 'e5', name: "Pastor's Appreciation Day",      date: '',           category: 'celebration', notes: 'Date TBD' },
    { id: 'e6', name: 'Thanksgiving Service',            date: '2026-11-27', category: 'special',     notes: '' },
    { id: 'e7', name: 'Christmas Service',               date: '2026-12-25', category: 'celebration', notes: 'Christmas Celebration' },
    { id: 'e8', name: 'Watch Night / New Year Service',  date: '2026-12-31', category: 'special',     notes: 'Year-end Watch Night' },
    { id: 'e9', name: 'Easter / Resurrection Sunday',   date: '2026-04-05', category: 'special',     notes: 'Resurrection Sunday' }
  ],
  schedules: []
};
