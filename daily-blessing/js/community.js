// Talks to the optional Worker-backed community counter. Fails silently and
// falls back to a local-only message if no backend is configured or reachable
// — the rest of the app never depends on this succeeding.
import { todayKey } from './utils.js';

const DEVICE_ID_KEY = 'flcc-daily-blessing:device-id';

function deviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function endpoint() {
  // Same-origin: the app is served by the same Worker/Pages deployment.
  return '/api/daily-blessing/community';
}

export async function fetchCommunityCount() {
  try {
    const res = await fetch(`${endpoint()}?date=${todayKey()}`, { method: 'GET' });
    if (!res.ok) return { configured: false };
    return await res.json();
  } catch {
    return { configured: false };
  }
}

export async function reportOpened() {
  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayKey(), deviceId: deviceId() }),
    });
    if (!res.ok) return { configured: false };
    return await res.json();
  } catch {
    return { configured: false };
  }
}
