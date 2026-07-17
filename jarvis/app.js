// Demo dashboard for the JARVIS Agentic Core. Wires the DOM to core.js's
// tick()/approve()/deny()/recordFeedback() plus the Knowledge/Faith/Family/
// Creator agents' direct capabilities — no logic lives here, this file only
// renders whatever core.js returns and forwards clicks.
import * as core from './js/core.js';
import { getPreference } from './js/memory.js';

const $ = (sel) => document.querySelector(sel);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text) node.textContent = opts.text;
  if (opts.html) node.innerHTML = opts.html;
  for (const child of children) node.appendChild(child);
  return node;
}

function agentBadge(agentKey) {
  const agent = core.getAgents()[agentKey];
  return el('span', { className: 'jv-badge', text: agent ? agent.name : agentKey });
}

function renderUnderstandings(list) {
  const ul = $('#jv-understand-list');
  ul.innerHTML = '';
  if (list.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'Nothing stood out this tick.' }));
    return;
  }
  for (const u of list) {
    const li = el('li', { className: 'jv-item' });
    li.appendChild(el('div', { text: u.situation }));
    li.appendChild(el('div', { className: 'jv-item-empty', text: u.intent }));
    ul.appendChild(li);
  }
}

function renderExecuted(executed) {
  const ul = $('#jv-executed-list');
  ul.innerHTML = '';
  if (executed.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'Nothing executed this tick.' }));
    return;
  }
  for (const { step, result } of executed) {
    const li = el('li', { className: 'jv-item' });
    const head = el('div');
    head.appendChild(agentBadge(step.agent));
    head.appendChild(document.createTextNode(step.message));
    li.appendChild(head);
    li.appendChild(el('div', { className: 'jv-item-empty', text: result.detail }));

    if (step.tool && step.tool.name !== 'remember') {
      const actions = el('div', { className: 'jv-item-actions' });
      const up = el('button', { text: '👍 Helpful' });
      const down = el('button', { text: '👎 Not helpful' });
      const given = el('div', { className: 'jv-feedback-given' });
      up.addEventListener('click', () => {
        core.recordFeedback(step.id, 'positive');
        actions.remove();
        given.textContent = 'Thanks — noted.';
        renderStyleLine();
      });
      down.addEventListener('click', () => {
        core.recordFeedback(step.id, 'negative');
        actions.remove();
        given.textContent = "Noted — I'll try differently next time.";
        renderStyleLine();
      });
      actions.appendChild(up);
      actions.appendChild(down);
      li.appendChild(actions);
      li.appendChild(given);
    }
    ul.appendChild(li);
  }
}

function renderPending(pending) {
  const ul = $('#jv-pending-list');
  ul.innerHTML = '';
  if (pending.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'Nothing awaiting approval.' }));
    return;
  }
  for (const step of pending) {
    const li = el('li', { className: 'jv-item jv-pending' });
    const head = el('div');
    head.appendChild(agentBadge(step.agent));
    head.appendChild(document.createTextNode(`To ${step.target}: "${step.message}"`));
    li.appendChild(head);

    const actions = el('div', { className: 'jv-item-actions' });
    const approveBtn = el('button', { text: 'Approve & send' });
    const denyBtn = el('button', { text: 'Deny' });
    const outcome = el('div', { className: 'jv-feedback-given' });
    approveBtn.addEventListener('click', async () => {
      const { result } = await core.approve(step.id);
      outcome.textContent = result.detail;
      actions.remove();
    });
    denyBtn.addEventListener('click', () => {
      const { result } = core.deny(step.id);
      outcome.textContent = result.detail;
      actions.remove();
    });
    actions.appendChild(approveBtn);
    actions.appendChild(denyBtn);
    li.appendChild(actions);
    li.appendChild(outcome);
    ul.appendChild(li);
  }
}

function renderDeferred(deferred) {
  const ul = $('#jv-deferred-list');
  ul.innerHTML = '';
  if (deferred.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'Nothing deferred.' }));
    return;
  }
  for (const step of deferred) {
    const li = el('li', { className: 'jv-item' });
    li.appendChild(el('div', { className: 'jv-item-empty', text: step.message }));
    ul.appendChild(li);
  }
}

function renderMemory() {
  const mem = core.getMemorySnapshot();
  $('#jv-mem-short').textContent = JSON.stringify(mem.shortTerm, null, 2);
  $('#jv-mem-long').textContent = JSON.stringify(mem.longTerm, null, 2);
  $('#jv-mem-learned').textContent = JSON.stringify(mem.learned, null, 2);
}

function renderStyleLine() {
  $('#jv-style-line').textContent =
    `Current learned message style: "${getPreference('style', 'encouraging-first')}".`;
}

function renderKnowledgeStatus() {
  $('#jv-knowledge-status').textContent = core.knowledgeConnected()
    ? 'AI connection found (shares FLCC Kasama\'s Ask FLCC setup on this device) — news and Q&A both available.'
    : 'No AI connection configured on this device yet — set up a Worker URL in FLCC Kasama\'s Settings to enable live news and Q&A.';
}

function renderNewsList() {
  const { items, fetchedAt } = core.getCachedNews();
  const ul = $('#jv-news-list');
  ul.innerHTML = '';
  if (items.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'No headlines cached yet — try "Refresh news".' }));
    return;
  }
  const when = fetchedAt ? new Date(fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  ul.appendChild(el('li', { className: 'jv-item-empty', text: `Fetched ${when}` }));
  for (const item of items.slice(0, 8)) {
    const li = el('li', { className: 'jv-item' });
    li.appendChild(el('div', { text: `${item.sourceIcon || ''} ${item.headline}`.trim() }));
    li.appendChild(el('div', { className: 'jv-item-empty', text: item.source }));
    ul.appendChild(li);
  }
}

function renderHomeStatus() {
  $('#jv-home-status').textContent = core.homeConnected()
    ? 'Home Assistant connection configured — device list and controls below are live.'
    : 'No Home Assistant connection configured yet — enter its URL and a Long-Lived Access Token below.';
}

function renderDeviceList() {
  const { devices, fetchedAt } = core.getCachedDevices();
  const ul = $('#jv-device-list');
  ul.innerHTML = '';
  if (devices.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'No devices cached yet — try "Refresh devices".' }));
    return;
  }
  const when = fetchedAt ? new Date(fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  ul.appendChild(el('li', { className: 'jv-item-empty', text: `Fetched ${when}` }));
  for (const device of devices) {
    const li = el('li', { className: 'jv-item' });
    li.appendChild(el('div', { text: `${device.name} — ${device.state}` }));

    const actions = el('div', { className: 'jv-item-actions' });
    const outcome = el('div', { className: 'jv-feedback-given' });
    for (const [label, action] of [['▶️', 'play'], ['⏸️', 'pause'], ['🔉', 'volumeDown'], ['🔊', 'volumeUp'], ['⏻', 'turnOff']]) {
      const btn = el('button', { text: label });
      btn.addEventListener('click', async () => {
        const result = await core.controlDevice(device.entityId, action);
        outcome.textContent = result.detail;
      });
      actions.appendChild(btn);
    }
    li.appendChild(actions);
    li.appendChild(outcome);
    ul.appendChild(li);
  }
}

function renderFamilyList() {
  const { family } = core.getMemorySnapshot().longTerm;
  const ul = $('#jv-family-list');
  ul.innerHTML = '';
  if (family.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'No family members on file yet.' }));
    return;
  }
  for (const f of family) {
    const li = el('li', { className: 'jv-item' });
    li.appendChild(el('div', { text: f.name }));
    if (f.note) li.appendChild(el('div', { className: 'jv-item-empty', text: f.note }));
    ul.appendChild(li);
  }
}

function renderReminderList() {
  const { reminders } = core.getMemorySnapshot().longTerm;
  const ul = $('#jv-reminder-list');
  ul.innerHTML = '';
  if (reminders.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'No reminders yet.' }));
    return;
  }
  for (const r of reminders) {
    ul.appendChild(el('li', { className: 'jv-item', text: r.text }));
  }
}

function renderGoalList() {
  const { goals } = core.getMemorySnapshot().longTerm;
  const ul = $('#jv-goal-list');
  ul.innerHTML = '';
  if (goals.length === 0) {
    ul.appendChild(el('li', { className: 'jv-item-empty', text: 'No goals on file yet.' }));
    return;
  }
  for (const g of goals) {
    ul.appendChild(el('li', { className: 'jv-item', text: g.text }));
  }
}

function renderAgentLists() {
  renderFamilyList();
  renderReminderList();
  renderGoalList();
}

async function runTick(signals) {
  const report = await core.tick(signals);

  $('#jv-context-card').hidden = false;
  $('#jv-context-line').textContent = report.contextSummary || '(nothing observed)';

  $('#jv-understand-card').hidden = false;
  renderUnderstandings(report.understandings);

  $('#jv-plan-card').hidden = false;
  renderExecuted(report.executed);
  renderPending(report.pending);
  renderDeferred(report.deferred);

  renderStyleLine();
  renderMemory();
}

$('#jv-observe-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const allenStatus = data.get('allenStatus');
  const jaredGamingHours = Number(data.get('jaredGamingHours')) || 0;
  const devotionScheduled = data.get('devotionScheduled') === 'on';
  const environmentNote = data.get('environmentNote') || '';

  await runTick({
    presence: { Allen: allenStatus },
    events: devotionScheduled ? [{ label: 'Family devotion', note: '' }] : [],
    environmentNote,
    raw: { jaredGamingHours },
  });
});

$('#jv-refresh-news').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  const result = await core.refreshNews();
  btn.disabled = false;
  btn.textContent = 'Refresh news';
  renderNewsList();
  if (!result.ok) $('#jv-knowledge-status').textContent = result.detail;
});

$('#jv-ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = new FormData(e.target).get('query')?.toString().trim();
  if (!query) return;
  const answerEl = $('#jv-ask-answer');
  answerEl.textContent = 'Thinking…';
  const result = await core.askGlobalKnowledge(query);
  answerEl.textContent = result.detail;
});

$('#jv-home-connect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const baseUrl = data.get('baseUrl')?.toString().trim();
  const token = data.get('token')?.toString().trim();
  if (!baseUrl || !token) return;
  core.saveHomeConnection(baseUrl, token);
  e.target.reset();
  renderHomeStatus();
});

$('#jv-refresh-devices').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  const result = await core.refreshDevices();
  btn.disabled = false;
  btn.textContent = 'Refresh devices';
  renderDeviceList();
  if (!result.ok) $('#jv-home-status').textContent = result.detail;
});

$('#jv-faith-prayer').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const out = $('#jv-faith-output');
  out.textContent = 'Writing…';
  const result = await core.generatePrayer();
  out.textContent = result.detail;
  btn.disabled = false;
});

$('#jv-family-idea').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const out = $('#jv-family-output');
  out.textContent = 'Thinking…';
  const result = await core.suggestConnectionIdea();
  out.textContent = result.detail;
  btn.disabled = false;
});

$('#jv-family-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const name = data.get('name')?.toString().trim();
  const note = data.get('note')?.toString().trim() || '';
  if (!name) return;
  core.addFamilyMember(name, note);
  e.target.reset();
  renderFamilyList();
  renderMemory();
});

$('#jv-creator-idea').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const out = $('#jv-creator-output');
  out.textContent = 'Thinking…';
  const result = await core.generateIdea();
  out.textContent = result.detail;
  btn.disabled = false;
});

$('#jv-reminder-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = new FormData(e.target).get('text')?.toString().trim();
  if (!text) return;
  core.createReminder(text);
  e.target.reset();
  renderReminderList();
  renderMemory();
});

$('#jv-goal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = new FormData(e.target).get('text')?.toString().trim();
  if (!text) return;
  core.addGoal(text);
  e.target.reset();
  renderGoalList();
  renderMemory();
});

$('#jv-export').addEventListener('click', () => {
  const blob = new Blob([core.exportMemory()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jarvis-memory.json';
  a.click();
  URL.revokeObjectURL(url);
});

$('#jv-erase').addEventListener('click', () => {
  if (!confirm('Erase all JARVIS memory on this device? This cannot be undone.')) return;
  core.eraseMemory();
  renderMemory();
  renderStyleLine();
  renderAgentLists();
});

renderStyleLine();
renderMemory();
renderKnowledgeStatus();
renderNewsList();
renderHomeStatus();
renderDeviceList();
renderAgentLists();
