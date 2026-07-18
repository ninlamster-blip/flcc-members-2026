// Home Engine — V0.4's "Home: Apple TV, HomePod, Bose, Home Assistant."
//
// Rather than three separate one-off integrations (Apple TV/AirPlay,
// HomePod/HomeKit, and Bose SoundTouch each speak their own local-network
// protocol, none of them reachable from a plain static PWA), this talks to
// a Home Assistant instance's REST API — the common layer real setups
// already use to bridge exactly those three ecosystems into one place, and
// a clean, documented HTTP API a no-build-step app can actually call.
//
// Own localStorage key, own connection settings — a *different* service
// from JARVIS's own AI connection (js/ai-client.js), configured
// separately in the Home panel. Same offline-first shape as knowledge.js:
// every function returns a well-formed { ok, detail } instead of throwing
// when nothing is configured.
const BASE_URL_KEY = 'flcc-jarvis-home-url-v1';
const TOKEN_KEY = 'flcc-jarvis-home-token-v1';

const CACHE_KEY = 'flcc-jarvis-home:v1';

function defaultCache() {
  return { devices: [], fetchedAt: null };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...defaultCache(), ...JSON.parse(raw) } : defaultCache();
  } catch {
    return defaultCache();
  }
}

let cache = loadCache();

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getConnection() {
  try {
    return {
      baseUrl: localStorage.getItem(BASE_URL_KEY) || '',
      token: localStorage.getItem(TOKEN_KEY) || '',
    };
  } catch {
    return { baseUrl: '', token: '' };
  }
}

export function saveConnection(baseUrl, token) {
  localStorage.setItem(BASE_URL_KEY, baseUrl.trim());
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function isConnected() {
  const { baseUrl, token } = getConnection();
  return !!(baseUrl && token);
}

function headers() {
  return {
    Authorization: `Bearer ${getConnection().token}`,
    'Content-Type': 'application/json',
  };
}

export function getCachedDevices() {
  return cache;
}

// Only media_player entities — the domain Home Assistant's Apple
// TV/AirPlay (HomePod)/Bose SoundTouch integrations all surface their
// devices under, regardless of brand.
export async function refreshDevices() {
  const { baseUrl } = getConnection();
  if (!isConnected()) return { ok: false, detail: 'No Home Assistant connection configured yet.' };
  try {
    const res = await fetch(baseUrl.replace(/\/+$/, '') + '/api/states', { headers: headers() });
    if (!res.ok) return { ok: false, detail: `Home Assistant returned HTTP ${res.status}.` };
    const states = await res.json();
    const devices = states
      .filter((s) => s.entity_id.startsWith('media_player.'))
      .map((s) => ({
        entityId: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state, // 'playing' | 'paused' | 'idle' | 'off' | ...
        volume: s.attributes?.volume_level ?? null,
      }));
    cache = { devices, fetchedAt: Date.now() };
    saveCache();
    return { ok: true, detail: `${devices.length} device(s) found.` };
  } catch (err) {
    return { ok: false, detail: `Couldn't reach Home Assistant: ${err.message}` };
  }
}

export function playingDeviceNames() {
  return cache.devices.filter((d) => d.state === 'playing').map((d) => d.name);
}

const SERVICE_BY_ACTION = {
  play: 'media_play',
  pause: 'media_pause',
  turnOff: 'turn_off',
  volumeUp: 'volume_up',
  volumeDown: 'volume_down',
};

async function callService(domain, service, data) {
  const { baseUrl } = getConnection();
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `HTTP ${res.status}`);
  }
}

// One device, one action — used by the UI's per-device controls.
export async function controlDevice(entityId, action) {
  if (!isConnected()) return { ok: false, detail: 'No Home Assistant connection configured yet.' };
  const service = SERVICE_BY_ACTION[action];
  if (!service) return { ok: false, detail: `Unknown action: ${action}` };
  try {
    await callService('media_player', service, { entity_id: entityId });
    return { ok: true, detail: `${action} sent to ${entityId}.` };
  } catch (err) {
    return { ok: false, detail: `Home Assistant request failed: ${err.message}` };
  }
}

// Every currently-playing device, paused at once — what Plan's
// "pause for family devotion" suggestion actually runs when approved.
export async function pauseAllPlaying() {
  if (!isConnected()) return { ok: false, detail: 'No Home Assistant connection configured yet.' };
  const playing = cache.devices.filter((d) => d.state === 'playing');
  if (playing.length === 0) return { ok: true, detail: 'Nothing was playing.' };
  try {
    await callService('media_player', 'media_pause', { entity_id: playing.map((d) => d.entityId) });
    return { ok: true, detail: `Paused: ${playing.map((d) => d.name).join(', ')}.` };
  } catch (err) {
    return { ok: false, detail: `Home Assistant request failed: ${err.message}` };
  }
}

export function eraseHomeCache() {
  cache = defaultCache();
  saveCache();
}
