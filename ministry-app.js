'use strict';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const STORAGE_KEY = 'flcc_gmpi_v1';

let S = {
  team: [], vacations: [], holidays: [], events: [], schedules: [],
  currentSection: 'dashboard',
  calYear: 2026, calMonth: 5,
  dashYear: 2026, dashMonth: 5,
  darkMode: false,
  sortField: 'date', sortDir: 'asc',
  schedView: 'calendar',
  charts: {},
  editingId: null,
  pendingConfirm: null
};

// ── STORAGE ────────────────────────────────────────────────

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    team: S.team, vacations: S.vacations, holidays: S.holidays,
    events: S.events, schedules: S.schedules, darkMode: S.darkMode
  }));
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      S.team      = d.team      || deepCopy(FLCC_GMPI_DATA.team);
      S.vacations = d.vacations || deepCopy(FLCC_GMPI_DATA.vacations);
      S.holidays  = d.holidays  || deepCopy(FLCC_GMPI_DATA.holidays);
      S.events    = d.events    || deepCopy(FLCC_GMPI_DATA.events);
      S.schedules = d.schedules || [];
      S.darkMode  = d.darkMode  || false;
    } catch(e) { resetData(); }
  } else {
    resetData();
  }
}

function resetData() {
  S.team      = deepCopy(FLCC_GMPI_DATA.team);
  S.vacations = deepCopy(FLCC_GMPI_DATA.vacations);
  S.holidays  = deepCopy(FLCC_GMPI_DATA.holidays);
  S.events    = deepCopy(FLCC_GMPI_DATA.events);
  S.schedules = [];
}

function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

// ── UTILITIES ──────────────────────────────────────────────

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function todayStr() { return new Date().toISOString().slice(0,10); }

function isOnLeave(personId, dateStr) {
  if (!dateStr) return false;
  const d = +new Date(dateStr + 'T00:00:00');
  return S.vacations.some(v => {
    if (v.personId !== personId || v.status === 'pending' || !v.startDate || !v.endDate) return false;
    return d >= +new Date(v.startDate + 'T00:00:00') && d <= +new Date(v.endDate + 'T00:00:00');
  });
}

function getVacationsOnDate(dateStr) {
  if (!dateStr) return [];
  const d = +new Date(dateStr + 'T00:00:00');
  return S.vacations.filter(v => {
    if (!v.startDate || !v.endDate || v.status === 'pending') return false;
    return d >= +new Date(v.startDate + 'T00:00:00') && d <= +new Date(v.endDate + 'T00:00:00');
  });
}

function getHolidayOnDate(dateStr) { return S.holidays.find(h => h.date === dateStr) || null; }
function getScheduleOnDate(dateStr) { return S.schedules.find(s => s.date === dateStr) || null; }
function getEventsOnDate(dateStr)   { return S.events.filter(e => e.date === dateStr); }

function getSchedulesInMonth(year, month) {
  const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
  return S.schedules.filter(s => s.date.startsWith(prefix));
}

function formatDate(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

function formatDateShort(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function dayName(ds) {
  if (!ds) return '';
  return DAYS_SHORT[new Date(ds + 'T00:00:00').getDay()];
}

function daysBetween(s, e) {
  return Math.round((+new Date(e + 'T00:00:00') - +new Date(s + 'T00:00:00')) / 86400000) + 1;
}

function avatarColor(name) {
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6'];
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function calcHealthScore() {
  const today = todayStr();
  const active = S.team.filter(m => m.status === 'active');
  if (!active.length) return 100;
  const avail = active.filter(m => !isOnLeave(m.id, today));
  return Math.round((avail.length / active.length) * 100);
}

// ── TOAST ──────────────────────────────────────────────────

function toast(msg, type='success') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success:'fa-check-circle', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
  t.innerHTML = `<i class="fas ${icons[type]||icons.success}"></i><span>${esc(msg)}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

// ── MODAL ──────────────────────────────────────────────────

function openModal(id) { const el = document.getElementById(id); if(el){ el.classList.add('open'); document.body.style.overflow='hidden'; } }
function closeModal(id) { const el = document.getElementById(id); if(el){ el.classList.remove('open'); document.body.style.overflow=''; } }

function showConfirm(msg, cb) {
  const el = document.getElementById('confirmMessage');
  if (el) el.textContent = msg;
  S.pendingConfirm = cb;
  openModal('confirmModal');
}

// ── NAVIGATION ─────────────────────────────────────────────

function navigateTo(section) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-section="${section}"]`);
  if (link) link.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`section-${section}`);
  if (sec) sec.classList.add('active');
  const titles = {
    dashboard:'Dashboard', schedule:'Schedule Calendar', preachers:'Preachers',
    emcees:'EMCEEs', pastoral:'Pastoral Prayer', vacations:'Vacation Leaves',
    holidays:'Kuwait Holidays', events:'Church Events', conflicts:'Conflict Checker',
    reports:'Reports', prayer:'Prayer Needs'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[section] || section;
  S.currentSection = section;
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  }
  switch(section) {
    case 'dashboard':  renderDashboard(); break;
    case 'schedule':   renderScheduleSection(); break;
    case 'preachers':  renderTeamSection('Preacher'); break;
    case 'emcees':     renderTeamSection('EMCEE'); break;
    case 'pastoral':   renderTeamSection('Pastoral Prayer'); break;
    case 'vacations':  renderVacations(); break;
    case 'holidays':   renderHolidays(); break;
    case 'events':     renderEvents(); break;
    case 'conflicts':  renderConflicts(); break;
    case 'reports':    renderReports(); break;
    case 'prayer':     renderPrayer(); break;
  }
}

// ── DASHBOARD ──────────────────────────────────────────────

function renderDashboard() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const gEl = document.getElementById('timeGreeting');
  if (gEl) gEl.textContent = greet;
  const mEl = document.getElementById('currentMonthYear');
  if (mEl) mEl.textContent = `${MONTHS[S.dashMonth]} ${S.dashYear}`;
  renderStats();
  renderMinistryMap();
  renderDashboardSideLists();
  renderDashboardAlerts();
  renderUpcomingServices();
}

function renderStats() {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;
  const today = todayStr();
  const midMonth = `${S.dashYear}-${String(S.dashMonth+1).padStart(2,'0')}-15`;
  const totalScheduled = S.schedules.length;
  const preachers  = S.team.filter(m => m.roles.includes('Preacher') && m.status === 'active').length;
  const emcees     = S.team.filter(m => m.roles.includes('EMCEE')    && m.status === 'active').length;
  const upcoming   = S.events.filter(e => e.date && e.date >= today).length;
  const onLeave    = S.team.filter(m => m.status === 'active' && isOnLeave(m.id, midMonth)).length;
  const available  = S.team.filter(m => m.status === 'active' && !isOnLeave(m.id, midMonth)).length;
  const holServices = S.schedules.filter(s => getHolidayOnDate(s.date)).length;
  grid.innerHTML = `
    ${sc('Total Services',      totalScheduled,  'fa-calendar-check', 'primary',  'Scheduled this year')}
    ${sc('Active Preachers',    preachers,        'fa-microphone',     'success',  'Ministry preachers')}
    ${sc('Active EMCEEs',       emcees,           'fa-user-tie',       'info',     'Available hosts')}
    ${sc('Upcoming Events',     upcoming,         'fa-calendar-star',  'purple',   'Church events ahead')}
    ${sc('Available This Month', available,       'fa-users',          'success',  `${MONTHS_SHORT[S.dashMonth]} workers ready`)}
    ${sc('On Leave This Month', onLeave,          'fa-plane',          'warning',  `${MONTHS_SHORT[S.dashMonth]} members away`)}
    ${sc('Holiday Services',    holServices,      'fa-star-and-crescent','danger', 'Services on holidays')}
    ${sc('Health Score',        calcHealthScore()+'%', 'fa-heart-pulse', 'primary','Ministry availability')}
  `;
}

function sc(label, value, icon, color, sub) {
  return `<div class="stat-card stat-${color}">
    <div class="stat-icon"><i class="fas ${icon}"></i></div>
    <div class="stat-body">
      <div class="stat-value">${esc(String(value))}</div>
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-sub">${esc(sub)}</div>
    </div>
  </div>`;
}

function renderMinistryMap() {
  const titleEl = document.getElementById('ministryMapMonth');
  if (titleEl) titleEl.textContent = `${MONTHS[S.dashMonth]} ${S.dashYear}`;
  const map = document.getElementById('ministryMap');
  if (!map) return;
  const { dashYear: y, dashMonth: m } = S;
  const dim = new Date(y, m+1, 0).getDate();
  const fd  = new Date(y, m, 1).getDay();
  let h = '<div class="mini-cal"><div class="mini-cal-header">';
  DAYS_SHORT.forEach(d => { h += `<div class="mini-cal-dh">${d}</div>`; });
  h += '</div><div class="mini-cal-grid">';
  for (let i = 0; i < fd; i++) h += '<div class="mini-cal-cell empty"></div>';
  for (let day = 1; day <= dim; day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const hol  = getHolidayOnDate(ds);
    const evts = getEventsOnDate(ds);
    const sch  = getScheduleOnDate(ds);
    const ol   = getVacationsOnDate(ds);
    const isFri = new Date(ds + 'T00:00:00').getDay() === 5;
    let cls = 'mini-cal-cell';
    if (hol)        cls += ' day-holiday';
    else if (evts.length) cls += ' day-event';
    else if (sch)   cls += ' day-assigned';
    else if (isFri) cls += ' day-service';
    const dot = hol ? 'yellow' : evts.length ? 'purple' : sch ? 'blue' : isFri ? 'green' : '';
    h += `<div class="${cls}" title="${ds}${hol?' | '+hol.name:''}${sch?' | '+sch.preacher:''}">
      <span class="mini-day">${day}</span>
      ${ol.length ? `<span class="mini-badge red">${ol.length}</span>` : ''}
      ${dot ? `<span class="mini-dot ${dot}"></span>` : ''}
    </div>`;
  }
  h += '</div><div class="mini-legend">';
  h += '<span><span class="ld blue"></span>Assigned</span>';
  h += '<span><span class="ld yellow"></span>Holiday</span>';
  h += '<span><span class="ld purple"></span>Event</span>';
  h += '<span><span class="ld red"></span>On Leave</span>';
  h += '<span><span class="ld green"></span>Service Day</span>';
  h += '</div></div>';
  map.innerHTML = h;
}

function renderDashboardSideLists() {
  const midDate = `${S.dashYear}-${String(S.dashMonth+1).padStart(2,'0')}-15`;
  const today = todayStr();

  const availEl = document.getElementById('availableWorkers');
  if (availEl) {
    const avail = S.team.filter(m => m.status==='active' && !isOnLeave(m.id, midDate));
    availEl.innerHTML = avail.length
      ? avail.map(m => `<div class="worker-item">
          <span class="worker-avatar" style="background:${avatarColor(m.name)}">${m.name[0]}</span>
          <div><div class="worker-name">${esc(m.displayName)}</div><div class="worker-roles">${esc(m.roles.slice(0,2).join(', '))}</div></div>
          <span class="badge badge-success">Available</span></div>`).join('')
      : '<p class="empty-text">None this month</p>';
  }

  const leaveEl = document.getElementById('onLeaveWorkers');
  if (leaveEl) {
    const onLeave = S.team.filter(m => m.status==='active' && isOnLeave(m.id, midDate));
    leaveEl.innerHTML = onLeave.length
      ? onLeave.map(m => {
          const v = S.vacations.find(v => v.personId===m.id && v.startDate && v.endDate && isOnLeave(m.id, midDate));
          return `<div class="worker-item">
            <span class="worker-avatar" style="background:${avatarColor(m.name)}">${m.name[0]}</span>
            <div><div class="worker-name">${esc(m.displayName)}</div><div class="worker-roles">${v ? 'Until '+formatDateShort(v.endDate) : 'On leave'}</div></div>
            <span class="badge badge-warning">Away</span></div>`;
        }).join('')
      : '<p class="empty-text">All available!</p>';
  }

  const evtEl = document.getElementById('upcomingEvents');
  if (evtEl) {
    const upcoming = S.events.filter(e => e.date && e.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0,5);
    evtEl.innerHTML = upcoming.length
      ? upcoming.map(e => `<div class="event-item">
          <div class="event-dot event-${esc(e.category)}"></div>
          <div><div class="event-name">${esc(e.name)}</div><div class="event-date">${formatDateShort(e.date)}</div></div>
        </div>`).join('')
      : '<p class="empty-text">No upcoming events</p>';
  }
}

function renderDashboardAlerts() {
  const el = document.getElementById('dashboardAlerts');
  if (!el) return;
  const conflicts = runAllConflictChecks().filter(c => c.severity === 'high').slice(0, 3);
  if (!conflicts.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="alert-banner">
    <div class="alert-title"><i class="fas fa-triangle-exclamation"></i> Active Conflicts Detected</div>
    ${conflicts.map(c => `<div class="alert-item alert-${c.severity}">
      <i class="fas fa-circle-exclamation"></i>
      <div><strong>${esc(c.title)}</strong><p>${esc(c.message)}</p></div>
    </div>`).join('')}
    <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="navigateTo('conflicts')">View All Conflicts</button>
  </div>`;
}

function renderUpcomingServices() {
  const el = document.getElementById('upcomingServices');
  if (!el) return;
  const today = todayStr();
  const upcoming = S.schedules.filter(s => s.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0,6);
  if (!upcoming.length) {
    el.innerHTML = '<p class="empty-text">No upcoming services. <button class="btn-link" onclick="openScheduleModal()">Add one</button></p>';
    return;
  }
  el.innerHTML = '<div class="services-list">' + upcoming.map(s => {
    const hol  = getHolidayOnDate(s.date);
    const evts = getEventsOnDate(s.date);
    const d = new Date(s.date + 'T00:00:00');
    return `<div class="service-row${hol ? ' has-holiday' : ''}">
      <div class="service-date"><div class="sdate-day">${d.getDate()}</div><div class="sdate-month">${MONTHS_SHORT[d.getMonth()]}</div></div>
      <div class="service-info">
        <div class="service-theme">${s.theme ? esc(s.theme) : '<em style="color:var(--text-muted)">No theme set</em>'}</div>
        <div class="service-meta">
          ${s.preacher     ? `<span><i class="fas fa-microphone"></i> ${esc(s.preacher)}</span>` : ''}
          ${s.emcee        ? `<span><i class="fas fa-user-tie"></i> ${esc(s.emcee)}</span>` : ''}
          ${s.pastoralPrayer ? `<span><i class="fas fa-hands-praying"></i> ${esc(s.pastoralPrayer)}</span>` : ''}
        </div>
        ${evts.length ? `<div class="service-event"><i class="fas fa-star"></i> ${evts.map(e=>esc(e.name)).join(', ')}</div>` : ''}
        ${hol ? `<div class="service-holiday"><i class="fas fa-star-and-crescent"></i> ${esc(hol.name)}</div>` : ''}
      </div>
      <div class="service-actions"><button class="btn-icon-sm" onclick="editSchedule('${s.id}')" title="Edit"><i class="fas fa-pencil"></i></button></div>
    </div>`;
  }).join('') + '</div>';
}

function dashPrevMonth() {
  if (S.dashMonth===0) { S.dashMonth=11; S.dashYear--; } else S.dashMonth--;
  renderMinistryMap(); renderDashboardSideLists();
  const mEl = document.getElementById('currentMonthYear');
  if (mEl) mEl.textContent = `${MONTHS[S.dashMonth]} ${S.dashYear}`;
}

function dashNextMonth() {
  if (S.dashMonth===11) { S.dashMonth=0; S.dashYear++; } else S.dashMonth++;
  renderMinistryMap(); renderDashboardSideLists();
  const mEl = document.getElementById('currentMonthYear');
  if (mEl) mEl.textContent = `${MONTHS[S.dashMonth]} ${S.dashYear}`;
}

// ── SCHEDULE ───────────────────────────────────────────────

function renderScheduleSection() {
  populateScheduleFilters();
  if (S.schedView === 'calendar') renderScheduleCalendar();
  else renderScheduleTable();
}

function setScheduleView(view, btn) {
  S.schedView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('calendarView')?.classList.toggle('hidden', view!=='calendar');
  document.getElementById('tableView')?.classList.toggle('hidden', view!=='table');
  if (view==='calendar') renderScheduleCalendar(); else renderScheduleTable();
}

function populateScheduleFilters() {
  const ms = document.getElementById('filterMonth');
  if (ms && ms.options.length===1) MONTHS.forEach((m,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=`${m} 2026`; ms.appendChild(o); });
  const ps = document.getElementById('filterPerson');
  if (ps && ps.options.length===1) S.team.forEach(m=>{ const o=document.createElement('option'); o.value=m.displayName; o.textContent=m.displayName; ps.appendChild(o); });
  const es = document.getElementById('filterEvent');
  if (es && es.options.length===1) S.events.forEach(e=>{ if(e.name){ const o=document.createElement('option'); o.value=e.name; o.textContent=e.name; es.appendChild(o); }});
}

function renderScheduleCalendar() {
  const title = document.getElementById('calMonthTitle');
  if (title) title.textContent = `${MONTHS[S.calMonth]} ${S.calYear}`;
  const container = document.getElementById('scheduleCalendar');
  if (!container) return;
  const y=S.calYear, m=S.calMonth;
  const dim = new Date(y, m+1, 0).getDate();
  const fd  = new Date(y, m, 1).getDay();
  const today = todayStr();
  let h = '<div class="cal-grid">';
  DAYS_SHORT.forEach(d => { h += `<div class="cal-dh">${d}</div>`; });
  for (let i=0; i<fd; i++) h += '<div class="cal-cell cal-empty"></div>';
  for (let day=1; day<=dim; day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const hol  = getHolidayOnDate(ds);
    const sch  = getScheduleOnDate(ds);
    const evts = getEventsOnDate(ds);
    const ol   = getVacationsOnDate(ds);
    const isFri = new Date(ds + 'T00:00:00').getDay() === 5;
    const isToday = ds === today;
    let cls = 'cal-cell';
    if (isToday) cls += ' today';
    if (hol)        cls += ' cal-holiday';
    else if (evts.length) cls += ' cal-event';
    else if (sch)   cls += ' cal-assigned';
    else if (isFri) cls += ' cal-service-day';
    h += `<div class="${cls}" onclick="openDayDetail('${ds}')">
      <div class="cal-day-num${isToday ? ' today-num' : ''}">${day}</div>
      ${hol  ? `<div class="cal-tag tag-holiday"><i class="fas fa-star-and-crescent"></i> ${esc(hol.name.split(' ').slice(0,3).join(' '))}</div>` : ''}
      ${evts.map(e=>`<div class="cal-tag tag-event"><i class="fas fa-star"></i> ${esc(e.name.length>14?e.name.slice(0,14)+'…':e.name)}</div>`).join('')}
      ${sch  ? `<div class="cal-tag tag-assigned"><i class="fas fa-microphone"></i> ${esc(sch.preacher||'TBA')}</div>` : ''}
      ${ol.length ? `<div class="cal-leave-badge">${ol.length} on leave</div>` : ''}
    </div>`;
  }
  h += '</div>';
  container.innerHTML = h;
}

function calPrevMonth() {
  if (S.calMonth===0) { S.calMonth=11; S.calYear--; } else S.calMonth--;
  renderScheduleCalendar();
}
function calNextMonth() {
  if (S.calMonth===11) { S.calMonth=0; S.calYear++; } else S.calMonth++;
  renderScheduleCalendar();
}

function renderScheduleTable() {
  const tbody = document.getElementById('scheduleTableBody');
  if (!tbody) return;
  let data = [...S.schedules];
  const fm = document.getElementById('filterMonth')?.value;
  const fp = document.getElementById('filterPerson')?.value;
  const fe = document.getElementById('filterEvent')?.value;
  if (fm !== '' && fm !== undefined) data = data.filter(s => new Date(s.date+'T00:00:00').getMonth() === parseInt(fm));
  if (fp) data = data.filter(s => s.preacher===fp || s.emcee===fp || s.pastoralPrayer===fp);
  if (fe) data = data.filter(s => s.event===fe);
  data.sort((a,b) => {
    const va = a[S.sortField]||'', vb = b[S.sortField]||'';
    return S.sortDir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No schedules found. <button class="btn-link" onclick="openScheduleModal()">Add one</button></td></tr>`; return; }
  tbody.innerHTML = data.map(s => {
    const hol  = getHolidayOnDate(s.date);
    const evts = getEventsOnDate(s.date);
    const cx   = getScheduleConflicts(s);
    return `<tr class="${hol?'row-holiday':''} ${cx.length?'row-conflict':''}">
      <td><div class="date-cell"><strong>${formatDateShort(s.date)}</strong><span class="day-name">${dayName(s.date)}</span></div>
        ${hol ? `<span class="badge badge-yellow"><i class="fas fa-star-and-crescent"></i> ${esc(hol.name)}</span>` : ''}
        ${cx.length ? `<span class="badge badge-red" title="${cx.map(c=>c.message).join('; ')}"><i class="fas fa-triangle-exclamation"></i> Conflict</span>` : ''}</td>
      <td>${s.theme ? esc(s.theme) : '<em class="muted">—</em>'}</td>
      <td>${s.preacher     ? `<span class="person-tag">${esc(s.preacher)}</span>`      : '<em class="muted">—</em>'}</td>
      <td>${s.pastoralPrayer ? `<span class="person-tag">${esc(s.pastoralPrayer)}</span>` : '<em class="muted">—</em>'}</td>
      <td>${s.emcee        ? `<span class="person-tag">${esc(s.emcee)}</span>`         : '<em class="muted">—</em>'}</td>
      <td>${[...evts.map(e=>`<span class="event-tag">${esc(e.name)}</span>`), s.event&&!evts.length?`<span class="event-tag">${esc(s.event)}</span>`:[]].join('')}</td>
      <td><div class="row-actions">
        <button class="btn-icon-sm" onclick="editSchedule('${s.id}')" title="Edit"><i class="fas fa-pencil"></i></button>
        <button class="btn-icon-sm danger" onclick="deleteSchedule('${s.id}')" title="Delete"><i class="fas fa-trash"></i></button>
      </div></td></tr>`;
  }).join('');
}

function sortScheduleTable(field) {
  S.sortDir = S.sortField===field && S.sortDir==='asc' ? 'desc' : 'asc';
  S.sortField = field;
  renderScheduleTable();
}

function applyScheduleFilters() {
  if (S.schedView==='table') renderScheduleTable();
}

function openDayDetail(ds) {
  const tEl = document.getElementById('dayModalTitle');
  if (tEl) tEl.textContent = `${dayName(ds)}, ${formatDate(ds)}`;
  const body = document.getElementById('dayModalBody');
  if (!body) return;
  const hol  = getHolidayOnDate(ds);
  const sch  = getScheduleOnDate(ds);
  const evts = getEventsOnDate(ds);
  const ol   = getVacationsOnDate(ds);
  const cx   = sch ? getScheduleConflicts(sch) : [];
  let h = '';
  if (hol) h += `<div class="info-box info-yellow"><i class="fas fa-star-and-crescent"></i><strong>Kuwait Holiday: ${esc(hol.name)}</strong></div>`;
  evts.forEach(e => { h += `<div class="info-box info-purple"><i class="fas fa-star"></i><strong>Event: ${esc(e.name)}</strong></div>`; });
  if (sch) {
    h += `<div class="detail-section"><h4>Service Assignment</h4><div class="detail-grid">
      ${sch.theme          ? `<div class="detail-row"><span>Theme</span><strong>${esc(sch.theme)}</strong></div>` : ''}
      ${sch.preacher       ? `<div class="detail-row"><span>Preacher</span><strong>${esc(sch.preacher)}</strong></div>` : ''}
      ${sch.pastoralPrayer ? `<div class="detail-row"><span>Pastoral Prayer</span><strong>${esc(sch.pastoralPrayer)}</strong></div>` : ''}
      ${sch.emcee          ? `<div class="detail-row"><span>EMCEE</span><strong>${esc(sch.emcee)}</strong></div>` : ''}
      ${sch.event          ? `<div class="detail-row"><span>Event</span><strong>${esc(sch.event)}</strong></div>` : ''}
      ${sch.notes          ? `<div class="detail-row"><span>Notes</span><em>${esc(sch.notes)}</em></div>` : ''}
    </div>
    ${cx.map(c=>`<div class="info-box info-red" style="margin-top:8px"><i class="fas fa-triangle-exclamation"></i> ${esc(c.message)}</div>`).join('')}
    </div>`;
  }
  if (ol.length) {
    h += `<div class="detail-section"><h4>Members On Leave</h4><div class="leave-list">
      ${ol.map(v=>`<div class="leave-item">
        <span class="worker-avatar small" style="background:${avatarColor(v.personName)}">${v.personName[0]}</span>
        <span>${esc(v.personName)}</span>
        <span class="muted">until ${formatDateShort(v.endDate)}</span>
      </div>`).join('')}</div></div>`;
  }
  if (!h) h = '<p class="empty-text">No activity on this day.</p>';
  const btn = document.getElementById('dayModalScheduleBtn');
  if (btn) {
    if (sch) { btn.textContent = 'Edit Service'; btn.onclick = () => { closeModal('dayModal'); editSchedule(sch.id); }; }
    else { btn.innerHTML = '<i class="fas fa-plus"></i> Add Service'; btn.onclick = () => { closeModal('dayModal'); openScheduleModal(ds); }; }
  }
  body.innerHTML = h;
  openModal('dayModal');
}

function openScheduleModal(prefillDate) {
  S.editingId = null;
  document.getElementById('scheduleModalTitle').textContent = 'Add Schedule';
  document.getElementById('scheduleForm').reset();
  document.getElementById('scheduleId').value = '';
  if (prefillDate) document.getElementById('schedDate').value = prefillDate;
  populateScheduleDropdowns();
  clearConflictPreview();
  openModal('scheduleModal');
}

function editSchedule(id) {
  const s = S.schedules.find(x => x.id===id);
  if (!s) return;
  S.editingId = id;
  document.getElementById('scheduleModalTitle').textContent = 'Edit Schedule';
  document.getElementById('scheduleId').value = s.id;
  document.getElementById('schedDate').value = s.date;
  document.getElementById('schedTheme').value = s.theme||'';
  populateScheduleDropdowns();
  document.getElementById('schedPreacher').value    = s.preacher||'';
  document.getElementById('schedPastoral').value    = s.pastoralPrayer||'';
  document.getElementById('schedEmcee').value       = s.emcee||'';
  document.getElementById('schedEvent').value       = s.event||'';
  document.getElementById('schedNotes').value       = s.notes||'';
  checkModalConflicts();
  openModal('scheduleModal');
}

function populateScheduleDropdowns() {
  const preachers  = S.team.filter(m => m.roles.includes('Preacher')         && m.status==='active');
  const pastorals  = S.team.filter(m => m.roles.includes('Pastoral Prayer')  && m.status==='active');
  const emcees     = S.team.filter(m => m.roles.includes('EMCEE')            && m.status==='active');
  const buildOpts  = (selId, members, ph) => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">${ph}</option>`;
    members.forEach(m => { const o = document.createElement('option'); o.value=m.displayName; o.textContent=m.displayName; sel.appendChild(o); });
    sel.value = prev;
  };
  buildOpts('schedPreacher', preachers, 'Select Preacher');
  buildOpts('schedPastoral', pastorals, 'Select Person');
  buildOpts('schedEmcee',    emcees,    'Select EMCEE');
  const es = document.getElementById('schedEvent');
  if (es) {
    const prev = es.value;
    es.innerHTML = '<option value="">No Special Event</option>';
    S.events.forEach(e => { if(e.name){ const o=document.createElement('option'); o.value=e.name; o.textContent=e.name; es.appendChild(o); }});
    es.value = prev;
  }
}

function checkModalConflicts() {
  const ds = document.getElementById('schedDate')?.value;
  const preacher = document.getElementById('schedPreacher')?.value;
  if (!ds) { clearConflictPreview(); return; }
  const cx = [];
  const hol = getHolidayOnDate(ds);
  if (hol) cx.push({ type:'warning', msg:`⚠️ This date is a Kuwait Holiday: ${hol.name}` });
  if (preacher) {
    const m = S.team.find(m => m.displayName===preacher);
    if (m && isOnLeave(m.id, ds)) cx.push({ type:'error', msg:`🔴 RED ALERT: ${preacher} is on vacation on ${formatDateShort(ds)}!` });
  }
  const prev = document.getElementById('modalConflictPreview');
  if (prev) {
    if (cx.length) { prev.innerHTML = cx.map(c=>`<div class="conflict-msg conflict-${c.type}">${esc(c.msg)}</div>`).join(''); prev.classList.remove('hidden'); }
    else { prev.innerHTML=''; prev.classList.add('hidden'); }
  }
  if (ds && preacher) showRecommendations(ds, preacher);
  else { const r=document.getElementById('modalRecommendations'); if(r){ r.innerHTML=''; r.classList.add('hidden'); } }
}

function showRecommendations(ds, currentPreacher) {
  const el = document.getElementById('modalRecommendations');
  if (!el) return;
  const m = S.team.find(m => m.displayName===currentPreacher);
  if (!m || !isOnLeave(m.id, ds)) { el.innerHTML=''; el.classList.add('hidden'); return; }
  const threeAgo = new Date(ds+'T00:00:00'); threeAgo.setMonth(threeAgo.getMonth()-3);
  const ago = threeAgo.toISOString().slice(0,10);
  const available = S.team.filter(t => t.status==='active' && t.roles.includes('Preacher') && !isOnLeave(t.id, ds) && t.id!==m.id);
  const ranked = available.map(t => ({
    member: t,
    count: S.schedules.filter(s => s.preacher===t.displayName && s.date>=ago && s.date<=ds).length
  })).sort((a,b) => a.count-b.count).slice(0,3);
  if (!ranked.length) { el.innerHTML=''; el.classList.add('hidden'); return; }
  el.innerHTML = `<div class="reco-header"><i class="fas fa-lightbulb"></i> Suggested Alternatives for ${esc(currentPreacher)}</div>
    ${ranked.map(({member:t, count}) => `
      <div class="reco-item" onclick="document.getElementById('schedPreacher').value='${esc(t.displayName)}'; checkModalConflicts()">
        <span class="worker-avatar small" style="background:${avatarColor(t.name)}">${t.name[0]}</span>
        <span>${esc(t.displayName)}</span>
        <span class="muted">${count} recent</span>
        <span class="badge badge-success">Available</span>
      </div>`).join('')}`;
  el.classList.remove('hidden');
}

function clearConflictPreview() {
  const p=document.getElementById('modalConflictPreview'); if(p){ p.innerHTML=''; p.classList.add('hidden'); }
  const r=document.getElementById('modalRecommendations'); if(r){ r.innerHTML=''; r.classList.add('hidden'); }
}

function saveSchedule() {
  const id    = document.getElementById('scheduleId').value;
  const date  = document.getElementById('schedDate').value;
  if (!date) { toast('Please select a date','error'); return; }
  const entry = {
    id: id || genId(),
    date,
    theme:         document.getElementById('schedTheme').value.trim(),
    preacher:      document.getElementById('schedPreacher').value,
    pastoralPrayer:document.getElementById('schedPastoral').value,
    emcee:         document.getElementById('schedEmcee').value,
    event:         document.getElementById('schedEvent').value,
    notes:         document.getElementById('schedNotes').value.trim()
  };
  if (id) {
    const idx = S.schedules.findIndex(s => s.id===id);
    if (idx>=0) S.schedules[idx]=entry; else S.schedules.push(entry);
  } else {
    S.schedules.push(entry);
  }
  saveData(); closeModal('scheduleModal');
  toast(id ? 'Schedule updated' : 'Schedule added');
  if (S.currentSection==='schedule') renderScheduleSection();
  if (S.currentSection==='dashboard') renderDashboard();
}

function deleteSchedule(id) {
  showConfirm('Delete this schedule entry?', () => {
    S.schedules = S.schedules.filter(s => s.id!==id);
    saveData(); toast('Schedule deleted','warning');
    if (S.currentSection==='schedule') renderScheduleSection();
    if (S.currentSection==='dashboard') renderDashboard();
  });
}

// ── TEAM ───────────────────────────────────────────────────

function renderTeamSection(role) {
  const gridIds = { 'Preacher':'preachersGrid', 'EMCEE':'emceesGrid', 'Pastoral Prayer':'pastoralGrid' };
  const grid = document.getElementById(gridIds[role]);
  if (!grid) return;
  const members = S.team.filter(m => m.roles.includes(role));
  const today = todayStr();
  if (!members.length) { grid.innerHTML='<p class="empty-text">No members yet.</p>'; return; }
  grid.innerHTML = members.map(m => {
    const onLeaveNow = isOnLeave(m.id, today);
    return `<div class="team-card${onLeaveNow?' on-leave':''}">
      <div class="team-card-header">
        <div class="team-avatar" style="background:${avatarColor(m.name)}">${m.name[0]}</div>
        <div class="team-info">
          <div class="team-name">${esc(m.displayName)}</div>
          <div class="team-status">${onLeaveNow
            ? '<span class="badge badge-warning"><i class="fas fa-plane"></i> On Leave</span>'
            : '<span class="badge badge-success"><i class="fas fa-check"></i> Available</span>'}</div>
        </div>
        <div class="team-menu"><button class="btn-icon-sm" onclick="editTeamMember('${m.id}')"><i class="fas fa-pencil"></i></button></div>
      </div>
      <div class="team-roles">${m.roles.map(r=>`<span class="role-badge">${esc(r)}</span>`).join('')}</div>
      <div class="team-stats">
        <div class="ts-item"><span class="ts-num">${countRecentAssignments(m.displayName)}</span><span class="ts-label">Recent (3mo)</span></div>
        <div class="ts-item"><span class="ts-num">${countTotalAssignments(m.displayName)}</span><span class="ts-label">All-time</span></div>
      </div>
      ${m.note ? `<div class="team-note"><i class="fas fa-circle-info"></i> ${esc(m.note)}</div>` : ''}
    </div>`;
  }).join('');
}

function countRecentAssignments(displayName) {
  const ago = new Date(); ago.setMonth(ago.getMonth()-3);
  const agoStr = ago.toISOString().slice(0,10);
  return S.schedules.filter(s => (s.preacher===displayName||s.emcee===displayName||s.pastoralPrayer===displayName) && s.date>=agoStr).length;
}

function countTotalAssignments(displayName) {
  return S.schedules.filter(s => s.preacher===displayName||s.emcee===displayName||s.pastoralPrayer===displayName).length;
}

function openAddMemberModal(role) {
  S.editingId = null;
  document.getElementById('teamModalTitle').textContent = `Add ${role}`;
  document.getElementById('teamForm').reset();
  document.getElementById('teamMemberId').value = '';
  document.querySelectorAll('input[name="memberRole"]').forEach(cb => { cb.checked = cb.value===role; });
  openModal('teamModal');
}

function editTeamMember(id) {
  const m = S.team.find(t => t.id===id);
  if (!m) return;
  S.editingId = id;
  document.getElementById('teamModalTitle').textContent = 'Edit Team Member';
  document.getElementById('teamMemberId').value = m.id;
  document.getElementById('memberName').value = m.name;
  document.getElementById('memberDisplayName').value = m.displayName;
  document.getElementById('memberStatus').value = m.status;
  document.getElementById('memberNote').value = m.note||'';
  document.querySelectorAll('input[name="memberRole"]').forEach(cb => { cb.checked = m.roles.includes(cb.value); });
  openModal('teamModal');
}

function saveTeamMember() {
  const id   = document.getElementById('teamMemberId').value;
  const name = document.getElementById('memberName').value.trim();
  if (!name) { toast('Name is required','error'); return; }
  const displayName = document.getElementById('memberDisplayName').value.trim() || name;
  const status = document.getElementById('memberStatus').value;
  const note   = document.getElementById('memberNote').value.trim();
  const roles  = [...document.querySelectorAll('input[name="memberRole"]:checked')].map(cb => cb.value);
  if (!roles.length) { toast('Select at least one role','error'); return; }
  if (id) {
    const idx = S.team.findIndex(m => m.id===id);
    if (idx>=0) S.team[idx] = { ...S.team[idx], name, displayName, status, note, roles };
  } else {
    S.team.push({ id:genId(), name, displayName, status, note, roles });
  }
  saveData(); closeModal('teamModal'); toast(id?'Member updated':'Member added');
  if (S.currentSection==='preachers') renderTeamSection('Preacher');
  else if (S.currentSection==='emcees') renderTeamSection('EMCEE');
  else if (S.currentSection==='pastoral') renderTeamSection('Pastoral Prayer');
}

// ── VACATION ───────────────────────────────────────────────

function renderVacations() {
  const ps = document.getElementById('vacPersonFilter');
  if (ps && ps.options.length===1) S.team.forEach(m => { const o=document.createElement('option'); o.value=m.id; o.textContent=m.displayName; ps.appendChild(o); });
  const ms = document.getElementById('vacMonthFilter');
  if (ms && ms.options.length===1) MONTHS.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; ms.appendChild(o); });
  const el = document.getElementById('vacationList');
  if (!el) return;
  const pf = ps?.value;
  const mf = ms?.value;
  let data = [...S.vacations];
  if (pf) data = data.filter(v => v.personId===pf);
  if (mf!=='' && mf!==undefined) data = data.filter(v => v.startDate && new Date(v.startDate+'T00:00:00').getMonth()===parseInt(mf));
  const grouped = {};
  data.forEach(v => { if(!grouped[v.personId]) grouped[v.personId]={personName:v.personName, vacations:[]}; grouped[v.personId].vacations.push(v); });
  if (!Object.keys(grouped).length) { el.innerHTML='<p class="empty-text">No vacation records found.</p>'; return; }
  const today = todayStr();
  el.innerHTML = Object.values(grouped).map(g => `
    <div class="vacation-group">
      <div class="vg-header">
        <span class="worker-avatar small" style="background:${avatarColor(g.personName)}">${g.personName[0]}</span>
        <strong>${esc(g.personName)}</strong>
        <span class="vg-count">${g.vacations.length} period(s)</span>
      </div>
      <div class="vg-periods">${g.vacations.map(v => {
        const isActive   = v.startDate && v.endDate && today>=v.startDate && today<=v.endDate;
        const isPast     = v.endDate && today>v.endDate;
        const isPending  = v.status==='pending';
        const statusCls  = isPending ? 'pending' : isActive ? 'active' : isPast ? 'past' : 'upcoming';
        return `<div class="vac-card vac-${statusCls}">
          <div class="vac-dates">${v.startDate && v.endDate ? `<strong>${formatDateShort(v.startDate)}</strong> → <strong>${formatDateShort(v.endDate)}</strong>` : '<em>Dates pending</em>'}</div>
          <div class="vac-badges">
            <span class="badge badge-${isPending?'warning':isActive?'danger':isPast?'secondary':'primary'}">${isPending?'Pending':isActive?'Currently Away':isPast?'Completed':'Upcoming'}</span>
            ${v.startDate && v.endDate ? `<span class="muted">${daysBetween(v.startDate,v.endDate)} days</span>` : ''}
          </div>
          ${v.notes ? `<div class="vac-notes">${esc(v.notes)}</div>` : ''}
          <div class="vac-actions">
            <button class="btn-icon-sm" onclick="editVacation('${v.id}')"><i class="fas fa-pencil"></i></button>
            <button class="btn-icon-sm danger" onclick="deleteVacation('${v.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
      }).join('')}</div>
    </div>`).join('');
}

function openVacationModal() {
  S.editingId = null;
  document.getElementById('vacationModalTitle').textContent = 'Add Vacation Leave';
  document.getElementById('vacationForm').reset();
  document.getElementById('vacationId').value = '';
  const ps = document.getElementById('vacPerson');
  ps.innerHTML = '<option value="">Select Person</option>';
  S.team.forEach(m => { const o=document.createElement('option'); o.value=m.id; o.textContent=m.displayName; ps.appendChild(o); });
  openModal('vacationModal');
}

function editVacation(id) {
  const v = S.vacations.find(x => x.id===id);
  if (!v) return;
  S.editingId = id;
  document.getElementById('vacationModalTitle').textContent = 'Edit Vacation Leave';
  document.getElementById('vacationId').value = v.id;
  const ps = document.getElementById('vacPerson');
  ps.innerHTML = '<option value="">Select Person</option>';
  S.team.forEach(m => { const o=document.createElement('option'); o.value=m.id; o.textContent=m.displayName; ps.appendChild(o); });
  ps.value = v.personId;
  document.getElementById('vacStatus').value = v.status||'confirmed';
  document.getElementById('vacStart').value  = v.startDate||'';
  document.getElementById('vacEnd').value    = v.endDate||'';
  document.getElementById('vacNotes').value  = v.notes||'';
  openModal('vacationModal');
}

function saveVacation() {
  const id       = document.getElementById('vacationId').value;
  const personId = document.getElementById('vacPerson').value;
  if (!personId) { toast('Select a person','error'); return; }
  const member = S.team.find(m => m.id===personId);
  const entry = {
    id: id||genId(),
    personId,
    personName: member ? member.name : personId,
    startDate: document.getElementById('vacStart').value,
    endDate:   document.getElementById('vacEnd').value,
    status:    document.getElementById('vacStatus').value,
    notes:     document.getElementById('vacNotes').value.trim()
  };
  if (id) { const idx=S.vacations.findIndex(v=>v.id===id); if(idx>=0) S.vacations[idx]=entry; else S.vacations.push(entry); }
  else S.vacations.push(entry);
  saveData(); closeModal('vacationModal'); toast(id?'Vacation updated':'Vacation added');
  renderVacations();
}

function deleteVacation(id) {
  showConfirm('Delete this vacation record?', () => {
    S.vacations = S.vacations.filter(v => v.id!==id);
    saveData(); toast('Deleted','warning'); renderVacations();
  });
}

// ── HOLIDAYS ───────────────────────────────────────────────

function renderHolidays() {
  const el = document.getElementById('holidayList');
  if (!el) return;
  const today = todayStr();
  const sorted = [...S.holidays].sort((a,b) => a.date.localeCompare(b.date));
  el.innerHTML = `<div class="holiday-grid">${sorted.map(h => {
    const isPast = h.date < today;
    const isToday = h.date===today;
    return `<div class="holiday-card${isPast?' past':''}${isToday?' today-highlight':''}">
      <div class="hol-icon hol-${h.type}"><i class="fas fa-star-and-crescent"></i></div>
      <div class="hol-body">
        <div class="hol-name">${esc(h.name)}</div>
        <div class="hol-date">${formatDate(h.date)} <span class="day-chip">${dayName(h.date)}</span></div>
        ${h.notes ? `<div class="hol-notes">${esc(h.notes)}</div>` : ''}
        <span class="badge badge-${h.type==='national'?'success':h.type==='islamic'?'warning':'secondary'}">${esc(h.type)}</span>
      </div>
      <div class="hol-actions">
        <button class="btn-icon-sm" onclick="editHoliday('${h.id}')"><i class="fas fa-pencil"></i></button>
        <button class="btn-icon-sm danger" onclick="deleteHoliday('${h.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openHolidayModal() {
  S.editingId = null;
  document.getElementById('holidayModalTitle').textContent = 'Add Holiday';
  document.getElementById('holidayForm').reset();
  document.getElementById('holidayId').value = '';
  openModal('holidayModal');
}

function editHoliday(id) {
  const h = S.holidays.find(x=>x.id===id); if(!h) return;
  S.editingId=id;
  document.getElementById('holidayModalTitle').textContent = 'Edit Holiday';
  document.getElementById('holidayId').value = h.id;
  document.getElementById('holName').value  = h.name;
  document.getElementById('holDate').value  = h.date;
  document.getElementById('holType').value  = h.type;
  document.getElementById('holNotes').value = h.notes||'';
  openModal('holidayModal');
}

function saveHoliday() {
  const id   = document.getElementById('holidayId').value;
  const name = document.getElementById('holName').value.trim();
  const date = document.getElementById('holDate').value;
  if (!name) { toast('Name required','error'); return; }
  if (!date) { toast('Date required','error'); return; }
  const entry = { id:id||genId(), name, date, type:document.getElementById('holType').value, notes:document.getElementById('holNotes').value.trim() };
  if (id) { const idx=S.holidays.findIndex(h=>h.id===id); if(idx>=0) S.holidays[idx]=entry; else S.holidays.push(entry); }
  else S.holidays.push(entry);
  saveData(); closeModal('holidayModal'); toast(id?'Holiday updated':'Holiday added');
  renderHolidays();
}

function deleteHoliday(id) {
  showConfirm('Delete this holiday?', () => {
    S.holidays=S.holidays.filter(h=>h.id!==id); saveData(); toast('Deleted','warning'); renderHolidays();
  });
}

// ── EVENTS ─────────────────────────────────────────────────

function renderEvents() {
  const el = document.getElementById('eventList');
  if (!el) return;
  const today = todayStr();
  const sorted = [...S.events].sort((a,b)=>{ if(!a.date&&!b.date) return a.name.localeCompare(b.name); if(!a.date)return 1; if(!b.date)return -1; return a.date.localeCompare(b.date); });
  const icons = { special:'fa-star', celebration:'fa-party-horn', outreach:'fa-hand-holding-heart', training:'fa-graduation-cap', other:'fa-calendar' };
  el.innerHTML = `<div class="events-grid">${sorted.map(e => {
    const isPast = e.date && e.date<today;
    const isUp   = e.date && e.date>=today;
    return `<div class="event-card${isPast?' past':''}">
      <div class="evt-icon evt-${e.category}"><i class="fas ${icons[e.category]||'fa-calendar'}"></i></div>
      <div class="evt-body">
        <div class="evt-name">${esc(e.name)}</div>
        <div class="evt-date">${e.date ? formatDate(e.date) : '<em>Date TBD</em>'}</div>
        ${e.notes ? `<div class="evt-notes">${esc(e.notes)}</div>` : ''}
        <span class="badge badge-${isPast?'secondary':isUp?'success':'warning'}">${isPast?'Past':isUp?'Upcoming':'No Date'}</span>
      </div>
      <div class="evt-actions">
        <button class="btn-icon-sm" onclick="editEvent('${e.id}')"><i class="fas fa-pencil"></i></button>
        <button class="btn-icon-sm danger" onclick="deleteEvent('${e.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openEventModal() {
  S.editingId=null;
  document.getElementById('eventModalTitle').textContent='Add Church Event';
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value='';
  openModal('eventModal');
}

function editEvent(id) {
  const e=S.events.find(x=>x.id===id); if(!e) return;
  S.editingId=id;
  document.getElementById('eventModalTitle').textContent='Edit Church Event';
  document.getElementById('eventId').value=e.id;
  document.getElementById('evtName').value=e.name;
  document.getElementById('evtDate').value=e.date||'';
  document.getElementById('evtCategory').value=e.category||'special';
  document.getElementById('evtNotes').value=e.notes||'';
  openModal('eventModal');
}

function saveEvent() {
  const id  = document.getElementById('eventId').value;
  const name= document.getElementById('evtName').value.trim();
  if (!name) { toast('Event name required','error'); return; }
  const entry={ id:id||genId(), name, date:document.getElementById('evtDate').value, category:document.getElementById('evtCategory').value, notes:document.getElementById('evtNotes').value.trim() };
  if (id) { const idx=S.events.findIndex(e=>e.id===id); if(idx>=0) S.events[idx]=entry; else S.events.push(entry); }
  else S.events.push(entry);
  saveData(); closeModal('eventModal'); toast(id?'Event updated':'Event added');
  renderEvents();
}

function deleteEvent(id) {
  showConfirm('Delete this event?', () => {
    S.events=S.events.filter(e=>e.id!==id); saveData(); toast('Deleted','warning'); renderEvents();
  });
}

// ── CONFLICT CHECKER ───────────────────────────────────────

function getScheduleConflicts(sched) {
  const cx = [];
  const ds = sched.date;
  if (sched.preacher) {
    const m = S.team.find(m => m.displayName===sched.preacher);
    if (m && isOnLeave(m.id, ds)) cx.push({ severity:'high', type:'vacation', title:'Preacher On Vacation', message:`${sched.preacher} is on vacation on ${formatDateShort(ds)}` });
  }
  if (sched.emcee) {
    const m = S.team.find(m => m.displayName===sched.emcee);
    if (m && isOnLeave(m.id, ds)) cx.push({ severity:'high', type:'vacation', title:'EMCEE On Vacation', message:`${sched.emcee} (EMCEE) is on vacation on ${formatDateShort(ds)}` });
  }
  if (sched.pastoralPrayer) {
    const m = S.team.find(m => m.displayName===sched.pastoralPrayer);
    if (m && isOnLeave(m.id, ds)) cx.push({ severity:'medium', type:'vacation', title:'Prayer Leader On Vacation', message:`${sched.pastoralPrayer} (Pastoral Prayer) is on vacation on ${formatDateShort(ds)}` });
  }
  const names = [sched.preacher, sched.emcee, sched.pastoralPrayer].filter(Boolean);
  const seen = new Set();
  names.forEach(n => { if(seen.has(n)) cx.push({ severity:'high', type:'duplicate', title:'Duplicate Assignment', message:`${n} is assigned to multiple roles on ${formatDateShort(ds)}` }); seen.add(n); });
  return cx;
}

function runAllConflictChecks() {
  const cx = [];
  S.schedules.forEach(s => cx.push(...getScheduleConflicts(s)));
  S.schedules.forEach(s => {
    const hol = getHolidayOnDate(s.date);
    if (hol) cx.push({ severity:'medium', type:'holiday', title:'Service on Kuwait Holiday', message:`Service on ${formatDateShort(s.date)} falls on "${hol.name}"` });
  });
  const sorted = [...S.schedules].filter(s=>s.preacher).sort((a,b)=>a.date.localeCompare(b.date));
  for (let i=0; i<sorted.length-2; i++) {
    const p=sorted[i].preacher;
    if (sorted[i+1].preacher===p && sorted[i+2].preacher===p)
      cx.push({ severity:'low', type:'consecutive', title:'Consecutive Preaching', message:`${p} is scheduled 3+ consecutive services — consider alternating` });
  }
  return cx;
}

function renderConflicts() {
  const el = document.getElementById('conflictResults');
  if (!el) return;
  const cx = runAllConflictChecks();
  if (!cx.length) {
    el.innerHTML=`<div class="no-conflicts"><i class="fas fa-shield-check text-success" style="font-size:3rem"></i><h3>No Conflicts Detected!</h3><p>All schedules look good. Your ministry plan is conflict-free.</p></div>`;
    return;
  }
  const high   = cx.filter(c=>c.severity==='high');
  const medium = cx.filter(c=>c.severity==='medium');
  const low    = cx.filter(c=>c.severity==='low');
  const grp = (title, items, cls, icon) => !items.length ? '' : `
    <div class="conflict-group">
      <h4 class="cg-title"><i class="fas ${icon}"></i> ${title} (${items.length})</h4>
      ${items.map(c=>`<div class="conflict-item conflict-${cls}">
        <div class="ci-header">${esc(c.title)}</div>
        <div class="ci-msg">${esc(c.message)}</div>
        <div class="ci-type">${esc(c.type)}</div>
      </div>`).join('')}
    </div>`;
  el.innerHTML = `
    <div class="conflict-summary">
      <div class="cs-stat cs-red"><strong>${high.length}</strong><span>Critical</span></div>
      <div class="cs-stat cs-amber"><strong>${medium.length}</strong><span>Warnings</span></div>
      <div class="cs-stat cs-yellow"><strong>${low.length}</strong><span>Recommendations</span></div>
    </div>
    ${grp('Critical Conflicts', high,   'high',   'fa-circle-exclamation')}
    ${grp('Warnings',           medium, 'medium', 'fa-triangle-exclamation')}
    ${grp('Recommendations',    low,    'low',    'fa-lightbulb')}`;
}

function runConflictCheck() { navigateTo('conflicts'); }

// ── PRAYER ─────────────────────────────────────────────────

function renderPrayer() {
  const el = document.getElementById('prayerDashboard');
  if (!el) return;
  const today = todayStr();
  const soon  = new Date(); soon.setDate(soon.getDate()+30);
  const soonStr = soon.toISOString().slice(0,10);
  const back  = new Date(); back.setDate(back.getDate()-14);
  const backStr = back.toISOString().slice(0,10);
  const onLeave    = S.team.filter(m => m.status==='active' && isOnLeave(m.id, today));
  const leaving    = S.team.filter(m => m.status==='active' && !isOnLeave(m.id,today) && S.vacations.some(v=>v.personId===m.id&&v.startDate&&v.startDate>=today&&v.startDate<=soonStr));
  const returned   = S.team.filter(m => S.vacations.some(v=>v.personId===m.id&&v.endDate&&v.endDate>=backStr&&v.endDate<today));
  el.innerHTML = `<div class="prayer-grid">
    <div class="prayer-card prayer-urgent">
      <div class="pc-header"><i class="fas fa-plane"></i><h3>Currently On Leave / Travelling</h3><span class="badge badge-danger">${onLeave.length}</span></div>
      ${onLeave.length ? `<div class="pc-list">${onLeave.map(m=>`<div class="pc-person">
        <span class="worker-avatar small" style="background:${avatarColor(m.name)}">${m.name[0]}</span>
        <div><div class="pc-name">${esc(m.displayName)}</div>
        <div class="pc-points">
          <span>✈ Safe travels & journey mercies</span>
          <span>❤ Good health & divine protection</span>
          <span>🙏 Spiritual refreshment & renewal</span>
          ${m.note?`<span>📝 ${esc(m.note)}</span>`:''}
        </div></div></div>`).join('')}</div>`
      : '<div class="card-body"><p class="empty-text">No one currently on leave.</p></div>'}
    </div>
    <div class="prayer-card prayer-upcoming">
      <div class="pc-header"><i class="fas fa-calendar-check"></i><h3>Leaving Soon (Next 30 Days)</h3><span class="badge badge-warning">${leaving.length}</span></div>
      ${leaving.length ? `<div class="pc-list">${leaving.map(m=>{
        const v=S.vacations.find(v=>v.personId===m.id&&v.startDate>=today&&v.startDate<=soonStr);
        return `<div class="pc-person">
          <span class="worker-avatar small" style="background:${avatarColor(m.name)}">${m.name[0]}</span>
          <div><div class="pc-name">${esc(m.displayName)}</div>
          <div class="pc-sub">Departs: ${v?formatDateShort(v.startDate):'Soon'}</div>
          <div class="pc-points"><span>🙏 Safe preparation & departure</span><span>❤ Continued ministry impact</span></div>
          </div></div>`;}).join('')}</div>`
      : '<div class="card-body"><p class="empty-text">No departures in next 30 days.</p></div>'}
    </div>
    <div class="prayer-card prayer-returned">
      <div class="pc-header"><i class="fas fa-house"></i><h3>Recently Returned</h3><span class="badge badge-success">${returned.length}</span></div>
      ${returned.length ? `<div class="pc-list">${returned.map(m=>`<div class="pc-person">
        <span class="worker-avatar small" style="background:${avatarColor(m.name)}">${m.name[0]}</span>
        <div><div class="pc-name">${esc(m.displayName)}</div>
        <div class="pc-points"><span>🎉 Welcome back & thanksgiving</span><span>💪 Strength to re-engage in ministry</span></div>
        </div></div>`).join('')}</div>`
      : '<div class="card-body"><p class="empty-text">No recent returns (past 14 days).</p></div>'}
    </div>
    <div class="prayer-card prayer-general">
      <div class="pc-header"><i class="fas fa-heart"></i><h3>General Ministry Prayer Focus</h3></div>
      <div class="prayer-focus-list">
        <div class="pf-item"><i class="fas fa-users"></i><div><strong>Ministry Team Unity</strong><p>Strength, unity, and passion in serving together</p></div></div>
        <div class="pf-item"><i class="fas fa-book-open"></i><div><strong>Preaching Anointing</strong><p>God's wisdom and anointing on every message</p></div></div>
        <div class="pf-item"><i class="fas fa-church"></i><div><strong>Church Growth</strong><p>Fruitfulness in soul-winning and discipleship</p></div></div>
        <div class="pf-item"><i class="fas fa-globe"></i><div><strong>Kuwait Ministry</strong><p>Open doors and divine favour in the Gulf region</p></div></div>
        <div class="pf-item"><i class="fas fa-shield"></i><div><strong>Protection for All</strong><p>Divine covering for all team members and families</p></div></div>
      </div>
    </div>
  </div>`;
}

// ── REPORTS ────────────────────────────────────────────────

let chartInst = {};

function renderReports() {
  const rs = document.getElementById('reportMonth');
  if (rs && rs.options.length===1) MONTHS.forEach((m,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=`${m} 2026`; rs.appendChild(o); });
  renderReportStats();
  setTimeout(() => { renderMonthlyChart(); renderPreacherChart(); renderHealthChart(); }, 60);
  renderReportTable();
}

function renderReportStats() {
  const el = document.getElementById('reportStats');
  if (!el) return;
  const pCounts = {}; S.schedules.forEach(s => { if(s.preacher) pCounts[s.preacher]=(pCounts[s.preacher]||0)+1; });
  const eCounts = {}; S.schedules.forEach(s => { if(s.emcee) eCounts[s.emcee]=(eCounts[s.emcee]||0)+1; });
  const topP = Object.entries(pCounts).sort((a,b)=>b[1]-a[1])[0];
  const topE = Object.entries(eCounts).sort((a,b)=>b[1]-a[1])[0];
  const today = todayStr();
  const gaps  = S.schedules.filter(s=>s.date>=today && !s.preacher).length;
  const uniqP = new Set(S.schedules.map(s=>s.preacher).filter(Boolean)).size;
  el.innerHTML = `
    ${sc('Total Services',    S.schedules.length, 'fa-calendar-check', 'primary', 'All scheduled services')}
    ${sc('Unique Preachers',  uniqP,              'fa-microphone',     'success', 'Distinct speakers')}
    ${sc('Top Preacher',      topP?topP[0]:'—',  'fa-trophy',         'warning', topP?`${topP[1]} services`:'No data yet')}
    ${sc('Top EMCEE',         topE?topE[0]:'—',  'fa-user-tie',       'info',    topE?`${topE[1]} services`:'No data yet')}
    ${sc('Unassigned Services',gaps,              'fa-circle-exclamation', gaps>0?'danger':'success', 'Missing preacher')}
    ${sc('Health Score',      calcHealthScore()+'%','fa-heart-pulse',  'primary', 'Ministry availability')}`;
}

function renderMonthlyChart() {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  if (chartInst.monthly) { chartInst.monthly.destroy(); delete chartInst.monthly; }
  const counts = Array(12).fill(0);
  S.schedules.forEach(s => { counts[new Date(s.date+'T00:00:00').getMonth()]++; });
  chartInst.monthly = new Chart(canvas, {
    type:'bar',
    data:{ labels:MONTHS_SHORT, datasets:[{ label:'Services', data:counts, backgroundColor:'#3b82f6', borderRadius:6 }] },
    options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
  });
}

function renderPreacherChart() {
  const canvas = document.getElementById('preacherChart');
  if (!canvas) return;
  if (chartInst.preacher) { chartInst.preacher.destroy(); delete chartInst.preacher; }
  const counts = {};
  S.schedules.forEach(s => { if(s.preacher) counts[s.preacher]=(counts[s.preacher]||0)+1; });
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if (!entries.length) { canvas.parentElement.innerHTML='<p class="empty-text">No schedule data yet</p>'; return; }
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed','#06b6d4','#ec4899','#84cc16'];
  chartInst.preacher = new Chart(canvas, {
    type:'doughnut',
    data:{ labels:entries.map(e=>e[0]), datasets:[{ data:entries.map(e=>e[1]), backgroundColor:colors, borderWidth:2 }] },
    options:{ responsive:true, plugins:{legend:{position:'right'}} }
  });
}

function renderHealthChart() {
  const canvas = document.getElementById('healthChart');
  if (!canvas) return;
  if (chartInst.health) { chartInst.health.destroy(); delete chartInst.health; }
  const scores = MONTHS.map((_,i) => {
    const mid = `2026-${String(i+1).padStart(2,'0')}-15`;
    const active = S.team.filter(m=>m.status==='active');
    if (!active.length) return 100;
    return Math.round(active.filter(m=>!isOnLeave(m.id,mid)).length/active.length*100);
  });
  chartInst.health = new Chart(canvas, {
    type:'line',
    data:{ labels:MONTHS_SHORT, datasets:[{ label:'Availability %', data:scores, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.1)', fill:true, tension:.4, pointBackgroundColor:'#10b981' }] },
    options:{ responsive:true, scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'}}}, plugins:{legend:{display:false}} }
  });
}

function renderReportTable() {
  const el = document.getElementById('reportTable');
  if (!el) return;
  if (!S.schedules.length) { el.innerHTML='<p class="empty-text">No schedule data to report.</p>'; return; }
  const sorted = [...S.schedules].sort((a,b)=>a.date.localeCompare(b.date));
  el.innerHTML = `<div class="table-wrapper"><table class="data-table">
    <thead><tr><th>Date</th><th>Theme</th><th>Preacher</th><th>Pastoral Prayer</th><th>EMCEE</th><th>Event</th><th>Status</th></tr></thead>
    <tbody>${sorted.map(s => {
      const cx = getScheduleConflicts(s);
      const hol= getHolidayOnDate(s.date);
      return `<tr>
        <td>${formatDateShort(s.date)} <small class="muted">${dayName(s.date)}</small></td>
        <td>${s.theme?esc(s.theme):'<em>—</em>'}</td>
        <td>${s.preacher?esc(s.preacher):'<em>—</em>'}</td>
        <td>${s.pastoralPrayer?esc(s.pastoralPrayer):'<em>—</em>'}</td>
        <td>${s.emcee?esc(s.emcee):'<em>—</em>'}</td>
        <td>${s.event?esc(s.event):'<em>—</em>'}</td>
        <td>${cx.length?`<span class="badge badge-red"><i class="fas fa-triangle-exclamation"></i> Conflict</span>`:hol?`<span class="badge badge-yellow"><i class="fas fa-star-and-crescent"></i> Holiday</span>`:`<span class="badge badge-success"><i class="fas fa-check"></i> OK</span>`}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

// ── SEARCH ─────────────────────────────────────────────────

function handleSearch(q) {
  const el = document.getElementById('searchResults');
  if (!el) return;
  q = q.trim().toLowerCase();
  if (!q || q.length<2) { el.innerHTML=''; el.classList.remove('visible'); window._searchResults=[]; return; }
  const results = [];
  S.schedules.forEach(s => {
    if ((s.date&&s.date.includes(q))||(s.theme&&s.theme.toLowerCase().includes(q))||(s.preacher&&s.preacher.toLowerCase().includes(q))||(s.emcee&&s.emcee.toLowerCase().includes(q))||(s.event&&s.event.toLowerCase().includes(q)))
      results.push({ type:'schedule', icon:'fa-calendar', label:`${formatDateShort(s.date)}${s.preacher?' — '+s.preacher:''}`, action:()=>{ navigateTo('schedule'); setTimeout(()=>openDayDetail(s.date),100); } });
  });
  S.team.forEach(m => {
    if (m.name.toLowerCase().includes(q)||m.displayName.toLowerCase().includes(q))
      results.push({ type:'team', icon:'fa-user', label:`${m.displayName} (${m.roles.join(', ')})`, action:()=>navigateTo(m.roles.includes('EMCEE')&&!m.roles.includes('Preacher')?'emcees':'preachers') });
  });
  S.events.forEach(e => {
    if (e.name.toLowerCase().includes(q))
      results.push({ type:'event', icon:'fa-star', label:`${e.name}${e.date?' — '+formatDateShort(e.date):''}`, action:()=>navigateTo('events') });
  });
  S.vacations.forEach(v => {
    if (v.personName.toLowerCase().includes(q))
      results.push({ type:'vacation', icon:'fa-plane', label:`${v.personName} — ${v.startDate?formatDateShort(v.startDate):'Pending'}`, action:()=>navigateTo('vacations') });
  });
  window._searchResults = results;
  if (!results.length) { el.innerHTML='<div class="sr-empty">No results found</div>'; el.classList.add('visible'); return; }
  el.innerHTML = results.slice(0,8).map((r,i)=>`<div class="sr-item" onclick="searchResultClick(${i})"><i class="fas ${r.icon}"></i><span>${esc(r.label)}</span><span class="sr-type">${esc(r.type)}</span></div>`).join('');
  el.classList.add('visible');
}

function searchResultClick(i) {
  const r = window._searchResults?.[i];
  if (r) { r.action(); closeSearch(); }
}

function closeSearch() {
  const el=document.getElementById('searchResults'); if(el){el.innerHTML='';el.classList.remove('visible');}
  const inp=document.getElementById('searchInput'); if(inp) inp.value='';
}

// ── EXPORT ─────────────────────────────────────────────────

function exportCSV() {
  const headers = ['Date','Day','Theme','Preacher','Pastoral Prayer','EMCEE','Event','Notes'];
  const rows = [...S.schedules].sort((a,b)=>a.date.localeCompare(b.date)).map(s=>[
    s.date, dayName(s.date), s.theme||'', s.preacher||'', s.pastoralPrayer||'', s.emcee||'', s.event||'', s.notes||''
  ]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download='FLCC-GMPI-Schedule-2026.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported successfully');
}

function exportPDF() { window.print(); toast('Print dialog opened','info'); }

// ── THEME ──────────────────────────────────────────────────

function toggleTheme() {
  S.darkMode = !S.darkMode;
  document.documentElement.setAttribute('data-theme', S.darkMode?'dark':'light');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = S.darkMode ? '<i class="fas fa-sun"></i><span>Light Mode</span>' : '<i class="fas fa-moon"></i><span>Dark Mode</span>';
  saveData();
}

// ── INIT ───────────────────────────────────────────────────

function init() {
  loadData();
  document.documentElement.setAttribute('data-theme', S.darkMode?'dark':'light');

  const now = new Date();
  S.dashMonth = now.getMonth();
  S.dashYear  = now.getFullYear();
  S.calMonth  = now.getMonth();
  S.calYear   = now.getFullYear();

  const dateEl = document.getElementById('headerDate');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
    if (S.darkMode) themeBtn.innerHTML = '<i class="fas fa-sun"></i><span>Light Mode</span>';
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.section); });
  });

  const menuBtn = document.getElementById('menuBtn');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const scBtn    = document.getElementById('sidebarClose');
  if (menuBtn) menuBtn.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('visible'); });
  if (overlay) overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); });
  if (scBtn)   scBtn.addEventListener('click',  () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', e => handleSearch(e.target.value));
    searchInput.addEventListener('keydown', e => { if(e.key==='Escape') closeSearch(); });
    document.addEventListener('click', e => { if(!e.target.closest('.search-wrapper')) closeSearch(); });
  }

  document.getElementById('confirmBtn')?.addEventListener('click', () => {
    if (S.pendingConfirm) { S.pendingConfirm(); S.pendingConfirm=null; }
    closeModal('confirmModal');
  });

  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if(e.target===ov) closeModal(ov.id); });
  });

  window._searchResults = [];
  navigateTo('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
