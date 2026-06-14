// FLCC-GMPI Prayer Map Philippines — Application Logic

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  churches: [],
  filtered: [],
  selected: null,
  map: null,
  markerLayer: null,
  markers: {},          // id → L.marker
  filters: {
    region: 'all',
    status: 'all',
    type: 'all',
    search: ''
  },
  searchTimeout: null
};

// ── Status / Type Helpers ─────────────────────────────────────────────────
const STATUS_LABEL = {
  stable: 'Stable',
  needs_support: 'Needs Support',
  urgent: 'Urgent Prayer'
};

const STATUS_EMOJI = {
  stable: '🟢',
  needs_support: '🟡',
  urgent: '🔴'
};

const STATUS_COLOR = {
  stable: { bg: '#22C55E', border: '#16A34A', glow: 'rgba(34,197,94,0.35)' },
  needs_support: { bg: '#EAB308', border: '#CA8A04', glow: 'rgba(234,179,8,0.35)' },
  urgent: { bg: '#EF4444', border: '#DC2626', glow: 'rgba(239,68,68,0.4)' }
};

const TYPE_ICON = { church: '⛪', mission: '✝', outreach: '🤝' };
const TYPE_LABEL = { church: 'Church', mission: 'Mission', outreach: 'Outreach' };

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'Luzon', label: 'Luzon', icon: '🏔' },
  { value: 'Visayas', label: 'Visayas', icon: '🏝' },
  { value: 'Mindanao', label: 'Mindanao', icon: '🌴' }
];

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.churches = loadChurches();
  state.filtered = [...state.churches];

  initMap();
  renderMarkers();
  renderSidebarStats();
  renderPrayerFocus();
  renderUrgentList();
  setupEventListeners();
});

// ── Map ───────────────────────────────────────────────────────────────────
function initMap() {
  state.map = L.map('map', {
    center: [12.0, 122.0],
    zoom: 6,
    zoomControl: false,
    attributionControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(state.map);

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  // Close panel on map click (empty area)
  state.map.on('click', () => {
    if (state.selected) closePanel();
  });
}

// ── Marker Creation ───────────────────────────────────────────────────────
function createMarkerIcon(church) {
  const c = STATUS_COLOR[church.status] || STATUS_COLOR.stable;
  const icon = TYPE_ICON[church.ministry_type] || '⛪';
  const isUrgent = church.status === 'urgent';

  const pulse = isUrgent
    ? `<div class="map-marker-pulse" style="background:${c.glow};"></div>`
    : '';

  return L.divIcon({
    className: '',
    html: `
      <div class="map-marker-wrap">
        ${pulse}
        <div class="map-marker-pin"
             style="background:${c.bg};border:2.5px solid ${c.border};box-shadow:0 2px 8px ${c.glow},0 1px 3px rgba(0,0,0,.25);">
          <span class="map-marker-inner" style="font-size:11px;">${icon}</span>
        </div>
      </div>`,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -36]
  });
}

function renderMarkers() {
  // Clear existing
  Object.values(state.markers).forEach(m => m.remove());
  state.markers = {};

  state.filtered.forEach(church => {
    const marker = L.marker(church.coordinates, {
      icon: createMarkerIcon(church),
      title: church.name
    });

    marker.bindTooltip(
      `<b>${church.name}</b><br><span style="color:#78716C;font-weight:400">${church.city}, ${church.region}</span>`,
      { direction: 'top', offset: [0, -34], className: 'leaflet-tooltip' }
    );

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      openPanel(church);
    });

    marker.addTo(state.map);
    state.markers[church.id] = marker;
  });
}

// ── Filtering ─────────────────────────────────────────────────────────────
function applyFilters() {
  const { region, status, type, search } = state.filters;
  const q = search.toLowerCase().trim();

  state.filtered = state.churches.filter(c => {
    if (region !== 'all' && c.island_group !== region) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (type !== 'all' && c.ministry_type !== type) return false;
    if (q) {
      const haystack = [c.name, c.city, c.province, c.region,
        c.lead_pastor, c.island_group].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  renderMarkers();
  renderSidebarStats();
  renderUrgentList();
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function renderSidebarStats() {
  const all = state.churches;
  const showing = state.filtered;

  const total = showing.length;
  const stable = showing.filter(c => c.status === 'stable').length;
  const needs = showing.filter(c => c.status === 'needs_support').length;
  const urgent = showing.filter(c => c.status === 'urgent').length;

  setTextSafe('stat-total', total);
  setTextSafe('stat-stable', stable);
  setTextSafe('stat-needs', needs);
  setTextSafe('stat-urgent', urgent);
}

function setTextSafe(elemId, value) {
  const el = document.getElementById(elemId);
  if (el) el.textContent = value;
}

function renderPrayerFocus() {
  const churches = state.churches;
  if (!churches.length) return;

  // Rotate daily based on day-of-year
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const church = churches[dayOfYear % churches.length];

  const container = document.getElementById('prayer-focus-container');
  if (!container) return;

  container.innerHTML = `
    <div class="prayer-focus-church">${church.name}</div>
    <div class="prayer-focus-pastor">${church.lead_pastor} · ${church.city}</div>
    <div class="prayer-focus-requests">
      ${church.prayer_requests.slice(0, 3).map(r =>
        `<div class="prayer-focus-request">${r}</div>`
      ).join('')}
    </div>
  `;

  container.parentElement.onclick = () => openPanel(church);
}

function renderUrgentList() {
  const urgent = state.filtered.filter(c => c.status === 'urgent');
  const container = document.getElementById('urgent-list');
  if (!container) return;

  if (!urgent.length) {
    container.innerHTML = '<div class="no-results">No urgent items matching current filters</div>';
    return;
  }

  container.innerHTML = urgent.map(c => `
    <div class="urgent-item fade-in" data-id="${c.id}">
      <div class="urgent-pulse"></div>
      <div>
        <div class="urgent-item-name">${c.name}</div>
        <div class="urgent-item-region">${c.city} · ${c.region}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.urgent-item').forEach(el => {
    el.addEventListener('click', () => {
      const church = state.churches.find(c => c.id === +el.dataset.id);
      if (church) openPanel(church);
    });
  });
}

// ── Church Detail Panel ───────────────────────────────────────────────────
function openPanel(church) {
  state.selected = church;
  const panel = document.getElementById('church-panel');
  const body = document.getElementById('panel-body');
  if (!panel || !body) return;

  // Fly map to marker
  state.map.flyTo(church.coordinates, Math.max(state.map.getZoom(), 9), {
    duration: 0.8
  });

  // Build content
  const sc = STATUS_COLOR[church.status];
  const statusLabel = STATUS_LABEL[church.status];
  const typeLabel = TYPE_LABEL[church.ministry_type] || church.ministry_type;
  const isUrgent = church.status === 'urgent';

  const needsHtml = church.needs.map(n => `
    <div class="need-item ${n.startsWith('URGENT') ? 'urgent-item-highlight' : ''}">
      <span class="need-bullet">◆</span>${n}
    </div>
  `).join('');

  const prayerHtml = church.prayer_requests.map(r => `
    <div class="prayer-item ${r.startsWith('URGENT') ? 'urgent-prayer' : ''}">
      <span class="prayer-bullet ${r.startsWith('URGENT') ? 'urgent' : ''}">🙏</span>${r}
    </div>
  `).join('');

  const initials = church.lead_pastor.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('');

  body.innerHTML = `
    <div class="panel-church-hero fade-in">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <h2 class="panel-church-name">${church.name}</h2>
        <span class="type-chip ${church.ministry_type}">${typeLabel}</span>
      </div>
      <div class="panel-status-badge ${church.status}">
        <span>${STATUS_EMOJI[church.status]}</span>
        ${statusLabel}
      </div>
      <div class="panel-location" style="margin-top:6px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${church.city}, ${church.province} · <strong>${church.region}</strong> · ${church.island_group}
      </div>
    </div>

    <div class="panel-meta-grid">
      <div class="panel-meta-item">
        <div class="panel-meta-label">Island Group</div>
        <div class="panel-meta-value">${church.island_group}</div>
      </div>
      <div class="panel-meta-item">
        <div class="panel-meta-label">Est. Year</div>
        <div class="panel-meta-value">${church.year_established}</div>
      </div>
      <div class="panel-meta-item">
        <div class="panel-meta-label">Members</div>
        <div class="panel-meta-value">${church.members ? church.members.toLocaleString() : '—'}</div>
      </div>
      <div class="panel-meta-item">
        <div class="panel-meta-label">Ministry</div>
        <div class="panel-meta-value">${typeLabel}</div>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-section-title">Lead Pastor</div>
      <div class="pastor-card">
        <div class="pastor-avatar">${initials}</div>
        <div class="pastor-info">
          <div class="pastor-name">${church.lead_pastor}</div>
          <div class="pastor-title">Lead Pastor / Church Planter</div>
        </div>
      </div>
      <div class="contact-links">
        ${church.contact_phone ? `
          <a href="tel:${church.contact_phone.replace(/\s/g,'')}" class="contact-link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            ${church.contact_phone}
          </a>
        ` : ''}
        ${church.contact_email ? `
          <a href="mailto:${church.contact_email}" class="contact-link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            ${church.contact_email}
          </a>
        ` : ''}
      </div>
    </div>

    ${church.needs.length ? `
      <div class="panel-section">
        <div class="panel-section-title">Current Needs</div>
        <div class="needs-list">${needsHtml}</div>
      </div>
    ` : ''}

    ${church.prayer_requests.length ? `
      <div class="panel-section">
        <div class="panel-section-title">Prayer Requests</div>
        <div class="prayer-list">${prayerHtml}</div>
      </div>
    ` : ''}
  `;

  panel.classList.add('open');

  // Leaflet must know its container resized after the CSS transition
  setTimeout(() => state.map && state.map.invalidateSize(), 240);

  // Highlight active marker
  highlightMarker(church.id);
}

function closePanel() {
  state.selected = null;
  const panel = document.getElementById('church-panel');
  if (panel) panel.classList.remove('open');
  setTimeout(() => state.map && state.map.invalidateSize(), 240);
  // Reset marker highlights
  state.filtered.forEach(c => {
    if (state.markers[c.id]) {
      state.markers[c.id].setIcon(createMarkerIcon(c));
    }
  });
}

function highlightMarker(id) {
  // Reset all, then highlight selected
  state.filtered.forEach(c => {
    if (state.markers[c.id]) {
      if (c.id === id) {
        // Make selected marker slightly larger
        const mc = STATUS_COLOR[c.status] || STATUS_COLOR.stable;
        const icon = TYPE_ICON[c.ministry_type] || '⛪';
        state.markers[c.id].setIcon(L.divIcon({
          className: '',
          html: `
            <div class="map-marker-wrap">
              <div class="map-marker-pin"
                   style="width:34px;height:34px;background:${mc.bg};border:3px solid ${mc.border};box-shadow:0 0 0 4px ${mc.glow},0 3px 10px ${mc.glow};">
                <span class="map-marker-inner" style="font-size:14px;">${icon}</span>
              </div>
            </div>`,
          iconSize: [34, 40],
          iconAnchor: [17, 40]
        }));
      } else {
        state.markers[c.id].setIcon(createMarkerIcon(c));
      }
    }
  });
}

// ── Search ────────────────────────────────────────────────────────────────
function handleSearch(query) {
  const results = document.getElementById('search-results');
  if (!results) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    results.classList.remove('visible');
    state.filters.search = '';
    applyFilters();
    return;
  }

  state.filters.search = q;
  applyFilters();

  const matches = state.churches.filter(c => {
    const hay = [c.name, c.city, c.province, c.region, c.lead_pastor].join(' ').toLowerCase();
    return hay.includes(q);
  }).slice(0, 8);

  if (!matches.length) {
    results.innerHTML = '<div class="no-results">No churches found</div>';
    results.classList.add('visible');
    return;
  }

  results.innerHTML = matches.map(c => `
    <div class="search-result-item" data-id="${c.id}">
      <div class="search-result-dot ${c.status}"></div>
      <div class="search-result-main">
        <div class="search-result-name">${c.name}</div>
        <div class="search-result-meta">${c.city}, ${c.region} · ${c.lead_pastor}</div>
      </div>
    </div>
  `).join('');

  results.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const church = state.churches.find(c => c.id === +el.dataset.id);
      if (church) {
        results.classList.remove('visible');
        document.getElementById('search-input').value = '';
        state.filters.search = '';
        applyFilters();
        openPanel(church);
      }
    });
  });

  results.classList.add('visible');
}

// ── Event Listeners ───────────────────────────────────────────────────────
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => handleSearch(e.target.value), 200);
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) handleSearch(searchInput.value);
    });

    document.addEventListener('click', e => {
      if (!searchInput.contains(e.target) && !searchResults?.contains(e.target)) {
        searchResults?.classList.remove('visible');
      }
    });
  }

  // Region filter pills
  document.querySelectorAll('[data-filter-region]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-region]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.region = pill.dataset.filterRegion;
      applyFilters();
      // Fly to region
      flyToRegion(state.filters.region);
    });
  });

  // Status filter pills
  document.querySelectorAll('[data-filter-status]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-status]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.status = pill.dataset.filterStatus;
      applyFilters();
    });
  });

  // Type filter pills
  document.querySelectorAll('[data-filter-type]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-type]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.type = pill.dataset.filterType;
      applyFilters();
    });
  });

  // Panel back button
  const backBtn = document.getElementById('panel-back-btn');
  if (backBtn) backBtn.addEventListener('click', closePanel);

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        overlay?.classList.toggle('visible');
      } else {
        sidebar.classList.toggle('collapsed');
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('mobile-open');
      overlay.classList.remove('visible');
    });
  }

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.selected) closePanel();
      if (searchResults?.classList.contains('visible')) {
        searchResults.classList.remove('visible');
        document.getElementById('search-input').value = '';
        state.filters.search = '';
        applyFilters();
      }
      sidebar?.classList.remove('mobile-open');
      overlay?.classList.remove('visible');
    }
  });
}

// ── Region Fly-to ─────────────────────────────────────────────────────────
const REGION_BOUNDS = {
  all: { center: [12.0, 122.0], zoom: 6 },
  Luzon: { center: [16.5, 121.0], zoom: 7 },
  Visayas: { center: [10.8, 123.5], zoom: 8 },
  Mindanao: { center: [7.8, 124.5], zoom: 7 }
};

function flyToRegion(region) {
  const target = REGION_BOUNDS[region] || REGION_BOUNDS.all;
  state.map.flyTo(target.center, target.zoom, { duration: 1.0 });
}

// ── Export for admin panel ────────────────────────────────────────────────
window.FLCC_APP = {
  getChurches: () => state.churches,
  reloadChurches: () => {
    state.churches = loadChurches();
    state.filtered = [...state.churches];
    renderMarkers();
    renderSidebarStats();
    renderPrayerFocus();
    renderUrgentList();
  }
};
